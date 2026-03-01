"use client";

import { useState, useRef, useEffect } from "react";
import { ArrowUp, Cpu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

interface StepTestRunProps {
  agentConfig: {
    name: string;
    instructions: string;
    llmModel: string;
  };
}

export function StepTestRun({ agentConfig }: StepTestRunProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    const text = inputValue.trim();
    if (!text || streaming) return;

    setStreaming(true);
    setInputValue("");
    setMessages((prev) => [
      ...prev,
      { role: "user", text },
      { role: "assistant", text: "" },
    ]);

    try {
      const response = await api.previewStream({
        instructions: agentConfig.instructions,
        model: agentConfig.llmModel,
        message: text,
      });

      if (!response.body) {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", text: "[Error: no response body]" };
          return updated;
        });
        setStreaming(false);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const payload = JSON.parse(line.slice(6));
            if (payload.done) {
              setStreaming(false);
              return;
            }
            if (payload.text) {
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                updated[updated.length - 1] = { ...last, text: last.text + payload.text };
                return updated;
              });
            }
          } catch {
            // skip malformed lines
          }
        }
      }

      setStreaming(false);
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        updated[updated.length - 1] = { ...last, text: last.text || "[Error: connection failed]" };
        return updated;
      });
      setStreaming(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Agent summary */}
      <div className="flex items-center gap-3 rounded-lg border border-border bg-card/50 p-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-cyan-400/10">
          <Cpu className="h-4 w-4 text-cyan-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">
            {agentConfig.name || "Preview Agent"}
          </p>
          <p className="text-xs text-muted-foreground truncate">{agentConfig.llmModel}</p>
        </div>
        <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded">
          Preview
        </span>
      </div>

      {/* Chat area */}
      <div
        ref={scrollRef}
        className="flex flex-col gap-3 overflow-y-auto rounded-lg border border-border bg-card/30 p-4"
        style={{ height: "calc(100vh - 28rem)", minHeight: "200px" }}
      >
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            Send a message to test your agent before saving.
          </p>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              "max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap",
              msg.role === "user"
                ? "self-end bg-cyan-400/15 text-foreground"
                : "self-start bg-secondary text-foreground"
            )}
          >
            {msg.role === "assistant" && !msg.text && streaming ? (
              <span className="inline-flex gap-1 text-muted-foreground">
                <span className="animate-bounce [animation-delay:0ms]">.</span>
                <span className="animate-bounce [animation-delay:150ms]">.</span>
                <span className="animate-bounce [animation-delay:300ms]">.</span>
              </span>
            ) : (
              msg.text
            )}
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          placeholder="Type a message..."
          disabled={streaming}
          className="flex-1 h-10 rounded-lg border border-border bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors disabled:opacity-50"
        />
        <Button
          size="icon"
          onClick={sendMessage}
          disabled={streaming || !inputValue.trim()}
          className="h-10 w-10 shrink-0"
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
