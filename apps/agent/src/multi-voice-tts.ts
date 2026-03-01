import {
  type APIConnectOptions,
  tokenize,
  tts,
  log,
} from '@livekit/agents';

const getLogger = () => log();

/**
 * A no-op ChunkedStream that immediately closes without producing audio.
 * Used when a speaker tag is parsed but the remaining text is empty.
 */
class NoOpChunkedStream extends tts.ChunkedStream {
  label = 'multi-voice.NoOp';

  constructor(ttsInstance: tts.TTS) {
    super('', ttsInstance);
  }

  protected async run() {
    this.queue.close();
  }
}

/**
 * Routes TTS synthesis to the correct TTS instance based on
 * [SpeakerName]: tags in LLM output. Tracks the last speaker so that
 * follow-up sentences without a tag still use the correct voice.
 */
export class MultiVoiceTTS extends tts.TTS {
  label = 'multi-voice.TTS';

  private voices = new Map<string, tts.TTS>();
  private defaultVoiceName = '';
  private lastSpeaker: string | null = null;

  constructor() {
    super(24000, 1, { streaming: true });
  }

  addVoice(name: string, ttsInstance: tts.TTS): void {
    this.voices.set(name, ttsInstance);
    if (this.voices.size === 1) {
      this.defaultVoiceName = name;
    }
  }

  private parseSpeakerTag(text: string): {
    speaker: string | null;
    cleanText: string;
  } {
    const match = text.match(/^\[([^\]]+)\]:\s*/);
    if (!match) {
      return { speaker: null, cleanText: text };
    }
    return {
      speaker: match[1],
      cleanText: text.slice(match[0].length).trim(),
    };
  }

  synthesize(
    text: string,
    connOptions?: APIConnectOptions,
    abortSignal?: AbortSignal,
  ): tts.ChunkedStream {
    const { speaker, cleanText } = this.parseSpeakerTag(text);

    if (speaker) {
      this.lastSpeaker = speaker;
    }

    const activeSpeaker = speaker ?? this.lastSpeaker ?? this.defaultVoiceName;

    if (!cleanText) {
      return new NoOpChunkedStream(this);
    }

    let voiceTTS = this.voices.get(activeSpeaker);
    if (!voiceTTS) {
      getLogger().warn(
        { activeSpeaker, defaultVoiceName: this.defaultVoiceName },
        'Speaker not found in voices map, falling back to default',
      );
      voiceTTS = this.voices.get(this.defaultVoiceName);
    }

    if (!voiceTTS) {
      throw new Error(
        'MultiVoiceTTS has no registered voices — call addVoice() first',
      );
    }

    return voiceTTS.synthesize(cleanText, connOptions, abortSignal);
  }

  stream(): tts.SynthesizeStream {
    if (this.voices.size === 0) {
      throw new Error(
        'MultiVoiceTTS has no registered voices — call addVoice() first',
      );
    }
    return new MultiVoiceStreamAdapter(this, this.voices, this.defaultVoiceName);
  }

  async close(): Promise<void> {
    for (const voice of this.voices.values()) {
      await voice.close();
    }
  }

  get getLastSpeaker(): string | null {
    return this.lastSpeaker;
  }
}

const SPEAKER_TAG_RE = /^\[([^\]]+)\]:\s*/;

/**
 * Streaming adapter for MultiVoiceTTS that tokenizes incoming text into
 * sentences, parses [SpeakerName]: tags to resolve the correct inner TTS
 * instance, then delegates to that TTS's stream() and forwards audio frames.
 */
class MultiVoiceStreamAdapter extends tts.SynthesizeStream {
  #voices: Map<string, tts.TTS>;
  #defaultVoiceName: string;
  #lastSpeaker: string | null = null;
  #tokenizer: tokenize.SentenceStream;
  label = 'multi-voice.SynthesizeStream';

  constructor(
    multiVoiceTTS: MultiVoiceTTS,
    voices: Map<string, tts.TTS>,
    defaultVoiceName: string,
  ) {
    super(multiVoiceTTS);
    this.#voices = voices;
    this.#defaultVoiceName = defaultVoiceName;
    this.#tokenizer = new tokenize.basic.SentenceTokenizer().stream();
  }

  protected async run(): Promise<void> {
    const forwardInput = async () => {
      for await (const input of this.input) {
        if (this.abortController.signal.aborted) break;
        if (input === tts.SynthesizeStream.FLUSH_SENTINEL) {
          this.#tokenizer.flush();
        } else {
          this.#tokenizer.pushText(input);
        }
      }
      this.#tokenizer.endInput();
      this.#tokenizer.close();
    };

    const synthesizeTask = async () => {
      type PendingSynthesis = {
        sentence: string;
        activeSpeaker: string;
        frames: tts.SynthesizedAudio[];
        done: boolean;
        error: Error | null;
        notifyFrame: (() => void) | null;
      };

      const pending: PendingSynthesis[] = [];
      let producerDone = false;
      let notifyConsumer: (() => void) | null = null;

      const producer = async () => {
        for await (const ev of this.#tokenizer) {
          if (this.abortController.signal.aborted) break;

          const sentence = ev.token.trim();
          if (!sentence) continue;

          const match = sentence.match(SPEAKER_TAG_RE);
          let speaker: string | null = null;
          let cleanText = sentence;
          if (match) {
            speaker = match[1];
            cleanText = sentence.slice(match[0].length).trim();
          }

          if (speaker) {
            this.#lastSpeaker = speaker;
          }

          const activeSpeaker =
            speaker ?? this.#lastSpeaker ?? this.#defaultVoiceName;

          if (!cleanText) continue;

          let voiceTTS = this.#voices.get(activeSpeaker);
          if (!voiceTTS) {
            getLogger().warn(
              { activeSpeaker, defaultVoiceName: this.#defaultVoiceName },
              'Speaker not found in voices map, falling back to default',
            );
            voiceTTS = this.#voices.get(this.#defaultVoiceName);
          }
          if (!voiceTTS) continue;

          const item: PendingSynthesis = {
            sentence: cleanText,
            activeSpeaker,
            frames: [],
            done: false,
            error: null,
            notifyFrame: null,
          };
          pending.push(item);
          notifyConsumer?.();
          notifyConsumer = null;

          const ttsInstance = voiceTTS;
          const abortSignal = this.abortController.signal;
          (async () => {
            try {
              const audioStream = ttsInstance.synthesize(
                cleanText,
                undefined,
                abortSignal,
              );
              for await (const audio of audioStream) {
                item.frames.push(audio);
                item.notifyFrame?.();
                item.notifyFrame = null;
              }
            } catch (e) {
              item.error = e as Error;
            } finally {
              item.done = true;
              item.notifyFrame?.();
              item.notifyFrame = null;
            }
          })();
        }
        producerDone = true;
        notifyConsumer?.();
        notifyConsumer = null;
      };

      const consumer = async () => {
        let idx = 0;
        while (true) {
          while (idx >= pending.length && !producerDone) {
            await new Promise<void>((r) => {
              notifyConsumer = r;
            });
          }
          if (idx >= pending.length) break;

          const item = pending[idx++];
          let frameIdx = 0;
          while (true) {
            while (frameIdx >= item.frames.length && !item.done) {
              await new Promise<void>((r) => {
                item.notifyFrame = r;
              });
            }
            if (frameIdx >= item.frames.length) break;
            if (this.abortController.signal.aborted) break;
            this.queue.put(item.frames[frameIdx++]);
          }

          if (item.error) {
            if (item.error.name === 'AbortError') break;
            getLogger().error(
              {
                error: item.error,
                activeSpeaker: item.activeSpeaker,
                sentence: item.sentence.slice(0, 50),
              },
              'MultiVoice streaming sentence synthesis failed',
            );
          }
        }
        this.queue.put(tts.SynthesizeStream.END_OF_STREAM);
      };

      await Promise.all([producer(), consumer()]);
    };

    await Promise.all([forwardInput(), synthesizeTask()]);
  }
}
