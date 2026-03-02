"use client";

import { useState, useEffect } from "react";
import {
  Shield,
  CheckCircle2,
  Circle,
  ExternalLink,
  Unplug,
  Key,
  Loader2,
  Zap,
  Clock,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TOOL_CAPABILITIES, type ToolWithStatus, type ToolCredentialStatus } from "@/lib/types";

interface ToolDetailDialogProps {
  tool: ToolWithStatus | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  icon: LucideIcon;
  color: string;
  onConnect: (slug: string) => void;
  onDisconnect: (slug: string) => void;
  onConfigureApiKey: (tool: ToolWithStatus) => void;
  isDisconnecting: boolean;
}

export function ToolDetailDialog({
  tool,
  open,
  onOpenChange,
  icon: Icon,
  color,
  onConnect,
  onDisconnect,
  onConfigureApiKey,
  isDisconnecting,
}: ToolDetailDialogProps) {
  const [oauthStatus, setOauthStatus] = useState<ToolCredentialStatus | null>(
    null
  );
  const [loadingStatus, setLoadingStatus] = useState(false);

  useEffect(() => {
    if (!open || !tool) {
      setOauthStatus(null);
      return;
    }

    if (tool.type === "oauth" && tool.connected) {
      setLoadingStatus(true);
      api
        .getToolOAuthStatus(tool.slug)
        .then(setOauthStatus)
        .catch(() => setOauthStatus(null))
        .finally(() => setLoadingStatus(false));
    }
  }, [open, tool]);

  if (!tool) return null;

  const capabilities = TOOL_CAPABILITIES[tool.slug] ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${color}15` }}
            >
              <Icon className="h-5 w-5" style={{ color }} />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base">{tool.name}</DialogTitle>
              <DialogDescription className="text-xs mt-0.5">
                {tool.description}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 pt-1">
          {/* Category & type */}
          <div className="flex items-center gap-2">
            <Badge
              variant="secondary"
              className="capitalize text-[11px]"
              style={{ backgroundColor: `${color}15`, color }}
            >
              {tool.category}
            </Badge>
            <Badge variant="outline" className="text-[11px]">
              {tool.type === "oauth"
                ? "OAuth"
                : tool.type === "api_key"
                  ? "API Key"
                  : "Built-in"}
            </Badge>
            <span
              className={cn(
                "text-[11px] px-2 py-0.5 rounded-full inline-flex items-center gap-1 ml-auto",
                tool.connected
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "bg-secondary text-muted-foreground"
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  tool.connected ? "bg-emerald-400" : "bg-muted-foreground"
                )}
              />
              {tool.connected ? "Connected" : "Not Connected"}
            </span>
          </div>

          {/* Permissions / Required scopes */}
          {tool.requiredScopes.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                <Shield className="h-3.5 w-3.5" />
                Required Permissions
              </div>
              <div className="flex flex-wrap gap-1.5">
                {tool.requiredScopes.map((scope) => (
                  <span
                    key={scope}
                    className="text-[11px] px-2 py-0.5 rounded-md bg-secondary text-muted-foreground font-mono"
                  >
                    {scope}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Granted scope & expiry (OAuth only) */}
          {tool.type === "oauth" && tool.connected && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                Connection Details
              </div>
              {loadingStatus ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Loading...
                </div>
              ) : oauthStatus ? (
                <div className="rounded-lg border border-border bg-secondary/30 p-3 space-y-2">
                  {oauthStatus.scope && (
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Granted Scope
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {oauthStatus.scope.split(/[,\s]+/).filter(Boolean).map(
                          (s) => (
                            <span
                              key={s}
                              className="text-[11px] px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 font-mono"
                            >
                              {s}
                            </span>
                          )
                        )}
                      </div>
                    </div>
                  )}
                  {oauthStatus.expiresAt && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      Expires{" "}
                      {new Date(oauthStatus.expiresAt).toLocaleDateString(
                        undefined,
                        {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        }
                      )}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}

          {/* Capabilities */}
          {capabilities.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                <Zap className="h-3.5 w-3.5" />
                Capabilities
              </div>
              <ul className="space-y-1.5">
                {capabilities.map((cap) => (
                  <li
                    key={cap}
                    className="flex items-center gap-2 text-xs text-muted-foreground"
                  >
                    <Circle className="h-1.5 w-1.5 fill-current shrink-0" />
                    {cap}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          {tool.type === "oauth" && !tool.connected && (
            <Button size="sm" onClick={() => onConnect(tool.slug)}>
              <ExternalLink className="h-3.5 w-3.5" />
              Connect
            </Button>
          )}
          {tool.type === "oauth" && tool.connected && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDisconnect(tool.slug)}
              disabled={isDisconnecting}
              className="text-destructive hover:text-destructive"
            >
              {isDisconnecting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Unplug className="h-3.5 w-3.5" />
              )}
              Disconnect
            </Button>
          )}
          {tool.type === "api_key" && (
            <Button
              variant={tool.connected ? "outline" : "default"}
              size="sm"
              onClick={() => onConfigureApiKey(tool)}
            >
              <Key className="h-3.5 w-3.5" />
              {tool.connected ? "Reconfigure" : "Configure"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
