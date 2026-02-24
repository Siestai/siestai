"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

interface SettingsSectionProps {
  title: string;
  children: React.ReactNode;
}

function SettingsSection({ title, children }: SettingsSectionProps) {
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="font-medium text-foreground">{title}</h2>
      </div>
      <div className="p-4 space-y-4">{children}</div>
    </div>
  );
}

interface SettingsRowProps {
  label: string;
  description?: string;
  children: React.ReactNode;
}

function SettingsRow({ label, description, children }: SettingsRowProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex-1">
        <Label className="text-sm text-foreground">{label}</Label>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}

interface ServiceStatusProps {
  name: string;
  endpoint: string;
  status: "connected" | "loading" | "error";
}

function ServiceStatus({ name, endpoint, status }: ServiceStatusProps) {
  const statusConfig = {
    connected: {
      icon: CheckCircle2,
      color: "text-success",
      text: "Connected",
    },
    loading: { icon: Loader2, color: "text-warning", text: "Checking" },
    error: { icon: CheckCircle2, color: "text-destructive", text: "Error" },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <p className="text-sm text-foreground">{name}</p>
        <p className="text-xs text-muted-foreground font-mono">{endpoint}</p>
      </div>
      <span
        className={cn("flex items-center gap-1.5 text-xs", config.color)}
      >
        <Icon
          className={cn(
            "h-3.5 w-3.5",
            status === "loading" && "animate-spin"
          )}
        />
        {config.text}
      </span>
    </div>
  );
}

export default function SettingsPage() {
  const [apiUrl, setApiUrl] = useState("http://localhost:4000");
  const [wsUrl, setWsUrl] = useState("ws://localhost:7880");
  const [autoConnect, setAutoConnect] = useState(true);
  const [isChecking, setIsChecking] = useState(false);

  const handleCheckConnection = () => {
    setIsChecking(true);
    setTimeout(() => setIsChecking(false), 2000);
  };

  return (
    <div className="container mx-auto px-4 py-6 lg:px-6 lg:py-8 max-w-3xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Configure connections, AI models, and platform preferences
        </p>
      </div>

      <div className="space-y-6">
        {/* Connection Settings */}
        <SettingsSection title="Connection">
          <div className="divide-y divide-border">
            <ServiceStatus
              name="API Server"
              endpoint={apiUrl}
              status="connected"
            />
            <ServiceStatus
              name="WebSocket Server"
              endpoint={wsUrl}
              status="error"
            />
          </div>

          <SettingsRow label="API URL" description="Backend REST API endpoint">
            <Input
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              className="w-[280px] bg-secondary border-border font-mono text-sm"
            />
          </SettingsRow>

          <SettingsRow
            label="WebSocket URL"
            description="Real-time communication server"
          >
            <Input
              value={wsUrl}
              onChange={(e) => setWsUrl(e.target.value)}
              className="w-[280px] bg-secondary border-border font-mono text-sm"
            />
          </SettingsRow>

          <SettingsRow
            label="Auto Connect"
            description="Automatically connect on startup"
          >
            <Switch
              checked={autoConnect}
              onCheckedChange={setAutoConnect}
            />
          </SettingsRow>

          <div className="pt-2">
            <Button
              variant="outline"
              className="gap-2 bg-transparent"
              onClick={handleCheckConnection}
              disabled={isChecking}
            >
              {isChecking ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Test Connection
            </Button>
          </div>
        </SettingsSection>

        {/* AI Models */}
        <SettingsSection title="AI Models">
          <SettingsRow
            label="Default LLM"
            description="Language model for agent conversations"
          >
            <span className="text-sm text-muted-foreground">gpt-4o</span>
          </SettingsRow>
          <SettingsRow
            label="Default STT"
            description="Speech-to-text provider"
          >
            <span className="text-sm text-muted-foreground">Cloud (Deepgram)</span>
          </SettingsRow>
          <SettingsRow
            label="Default TTS"
            description="Text-to-speech provider"
          >
            <span className="text-sm text-muted-foreground">Cloud (OpenAI)</span>
          </SettingsRow>
        </SettingsSection>

        {/* Storage */}
        <SettingsSection title="Storage">
          <SettingsRow label="Agents" description="6 agents saved">
            <span className="text-sm font-mono text-muted-foreground">
              Local (mock)
            </span>
          </SettingsRow>
          <SettingsRow label="Conversation History" description="3 sessions">
            <span className="text-sm font-mono text-muted-foreground">
              Local (mock)
            </span>
          </SettingsRow>
        </SettingsSection>

        {/* About */}
        <SettingsSection title="About">
          <SettingsRow label="Version">
            <span className="text-sm font-mono text-muted-foreground">
              0.1.0
            </span>
          </SettingsRow>
          <SettingsRow label="Platform">
            <span className="text-sm text-muted-foreground">
              Siestai AI Agent Platform
            </span>
          </SettingsRow>
        </SettingsSection>
      </div>
    </div>
  );
}
