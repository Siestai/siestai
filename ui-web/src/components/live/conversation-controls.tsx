"use client";

import { useState, useEffect, useCallback } from "react";
import {
  useLocalParticipant,
  useVoiceAssistant,
} from "@livekit/components-react";
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  PhoneOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

function useAgentVolume() {
  const { audioTrack } = useVoiceAssistant();
  const [volume, setVolumeState] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  const applyVolume = useCallback((newVolume: number) => {
    const audioEl = document.querySelector("audio") as HTMLAudioElement | null;
    if (audioEl) {
      audioEl.volume = newVolume;
      audioEl.muted = newVolume === 0;
    }
  }, []);

  const setVolume = useCallback(
    (newVolume: number) => {
      setVolumeState(newVolume);
      setIsMuted(newVolume === 0);
      applyVolume(newVolume);
    },
    [applyVolume]
  );

  const toggleMute = useCallback(() => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    applyVolume(newMuted ? 0 : volume);
  }, [isMuted, volume, applyVolume]);

  // Sync volume when audio track changes
  useEffect(() => {
    applyVolume(isMuted ? 0 : volume);
  }, [audioTrack, applyVolume, isMuted, volume]);

  return { volume, isMuted, setVolume, toggleMute };
}

interface ConversationControlsProps {
  variant?: "default" | "compact";
  onEndSession: () => void;
}

export function ConversationControls({
  variant = "default",
  onEndSession,
}: ConversationControlsProps) {
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const { volume, isMuted: isAgentMuted, setVolume, toggleMute: toggleAgentMute } =
    useAgentVolume();

  const toggleMic = useCallback(async () => {
    await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
  }, [localParticipant, isMicrophoneEnabled]);

  if (variant === "compact") {
    return (
      <div className="flex items-center gap-2">
        <Button
          variant={isMicrophoneEnabled ? "secondary" : "destructive"}
          size="sm"
          onClick={toggleMic}
          className="rounded-full h-8 w-8 p-0"
          title={isMicrophoneEnabled ? "Mute" : "Unmute"}
        >
          {isMicrophoneEnabled ? (
            <Mic className="h-4 w-4" />
          ) : (
            <MicOff className="h-4 w-4" />
          )}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={toggleAgentMute}
          className="rounded-full h-8 w-8 p-0"
          title={isAgentMuted ? "Unmute agent" : "Mute agent"}
        >
          {isAgentMuted ? (
            <VolumeX className="h-4 w-4" />
          ) : (
            <Volume2 className="h-4 w-4" />
          )}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onEndSession}
          className="rounded-full h-8 w-8 p-0 text-destructive hover:bg-destructive hover:text-white"
          title="End conversation"
        >
          <PhoneOff className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-4">
        {/* Mute/Unmute */}
        <Button
          variant={isMicrophoneEnabled ? "secondary" : "destructive"}
          size="lg"
          onClick={toggleMic}
          className="rounded-full h-12 w-12 p-0"
        >
          {isMicrophoneEnabled ? (
            <Mic className="h-5 w-5" />
          ) : (
            <MicOff className="h-5 w-5" />
          )}
        </Button>

        {/* Volume control */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleAgentMute}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            {isAgentMuted ? (
              <VolumeX className="h-5 w-5" />
            ) : (
              <Volume2 className="h-5 w-5" />
            )}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={isAgentMuted ? 0 : volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className={cn(
              "w-24 h-1.5 appearance-none rounded-full bg-secondary cursor-pointer",
              "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary",
              "[&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:border-0"
            )}
          />
        </div>

        {/* End Conversation */}
        <Button
          variant="outline"
          size="lg"
          onClick={onEndSession}
          className="rounded-full h-12 w-12 p-0 text-destructive hover:bg-destructive hover:text-white"
        >
          <PhoneOff className="h-5 w-5" />
        </Button>
      </div>

      {/* Keyboard shortcut hints */}
      <p className="text-xs text-muted-foreground font-mono">
        Space: mute | Esc: end
      </p>
    </div>
  );
}
