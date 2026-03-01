"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

function formatTime(totalSeconds: number): string {
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return hrs > 0
    ? `${pad(hrs)}:${pad(mins)}:${pad(secs)}`
    : `${pad(mins)}:${pad(secs)}`;
}

interface CallTimerProps {
  startTime: number;
  maxDuration?: number;
  onTimeUp?: () => void;
  className?: string;
}

export function CallTimer({
  startTime,
  maxDuration,
  onTimeUp,
  className,
}: CallTimerProps) {
  const [elapsed, setElapsed] = useState(0);
  const timeUpFiredRef = useRef(false);
  const onTimeUpRef = useRef(onTimeUp);

  useEffect(() => {
    onTimeUpRef.current = onTimeUp;
  }, [onTimeUp]);

  useEffect(() => {
    timeUpFiredRef.current = false;

    const tick = () => {
      const secs = Math.floor((Date.now() - startTime) / 1000);
      setElapsed(Math.max(0, secs));

      if (
        maxDuration &&
        secs >= maxDuration &&
        !timeUpFiredRef.current
      ) {
        timeUpFiredRef.current = true;
        onTimeUpRef.current?.();
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [startTime, maxDuration]);

  const remaining = maxDuration ? maxDuration - elapsed : null;
  const isWarning = remaining !== null && remaining < 60 && remaining > 0;
  const isExpired = remaining !== null && remaining <= 0;

  return (
    <div
      className={cn(
        "rounded-full px-3 py-1 text-sm font-mono",
        isWarning
          ? "bg-red-500/15 text-red-400 animate-pulse"
          : isExpired
            ? "bg-destructive/15 text-destructive"
            : "bg-secondary text-muted-foreground",
        className,
      )}
    >
      {formatTime(elapsed)}
      {maxDuration != null && (
        <span className="text-muted-foreground">
          {" "}
          / {formatTime(maxDuration)}
        </span>
      )}
    </div>
  );
}
