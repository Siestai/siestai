"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const TOOL_NAME_MAP: Record<string, string> = {
  github: "GitHub",
  gmail: "Gmail",
  web_search: "Web Search",
};

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const connectedSlug = searchParams.get("connected");
  const error = searchParams.get("error");

  const toolName = connectedSlug
    ? TOOL_NAME_MAP[connectedSlug] ?? connectedSlug
    : null;

  useEffect(() => {
    if (connectedSlug) {
      const timer = setTimeout(() => router.push("/tools"), 2000);
      return () => clearTimeout(timer);
    }
    if (!error) {
      router.push("/tools");
    }
  }, [connectedSlug, error, router]);

  if (connectedSlug) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="flex flex-col items-center gap-4 text-center">
          <CheckCircle2 className="h-12 w-12 text-emerald-400" />
          <h1 className="text-xl font-semibold text-foreground">
            {toolName} connected successfully
          </h1>
          <p className="text-sm text-muted-foreground">
            Redirecting to tools...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="flex flex-col items-center gap-4 text-center">
          <AlertCircle className="h-12 w-12 text-red-400" />
          <h1 className="text-xl font-semibold text-foreground">
            Connection failed
          </h1>
          <p className="text-sm text-muted-foreground max-w-md">{error}</p>
          <Button variant="outline" onClick={() => router.push("/tools")}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  return null;
}

export default function ToolsCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center px-6 py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}
