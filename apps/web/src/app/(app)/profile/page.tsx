"use client";

import { useState } from "react";
import { Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession, authClient } from "@/lib/auth-client";

function ProfileAvatar({
  name,
  image,
}: {
  name?: string | null;
  image?: string | null;
}) {
  const initials = name
    ? name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "?";

  if (image) {
    return (
      <img
        src={image}
        alt={name || "User"}
        className="h-20 w-20 rounded-full object-cover"
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-2xl font-semibold text-primary-foreground">
      {initials}
    </div>
  );
}

export default function ProfilePage() {
  const { data: session, isPending } = useSession();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  if (!initialized && session?.user?.name) {
    setName(session.user.name);
    setInitialized(true);
  }

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await authClient.updateUser({ name: name.trim() });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  if (isPending) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const user = session?.user;
  if (!user) return null;

  return (
    <div className="container mx-auto px-4 py-6 lg:px-6 lg:py-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground">Profile</h1>
        <p className="text-muted-foreground mt-1">
          Manage your account information
        </p>
      </div>

      <div className="space-y-6">
        {/* Avatar & Info */}
        <div className="rounded-lg border border-border bg-card">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="font-medium text-foreground">Account</h2>
          </div>
          <div className="p-6">
            <div className="flex items-center gap-6 mb-6">
              <ProfileAvatar name={user.name} image={user.image} />
              <div>
                <p className="text-lg font-medium text-foreground">
                  {user.name}
                </p>
                <p className="text-sm text-muted-foreground">{user.email}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <Label className="text-sm text-foreground">
                    Display Name
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Your public display name
                  </p>
                </div>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-[280px] bg-secondary border-border"
                />
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <Label className="text-sm text-foreground">Email</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Provided by Google — cannot be changed
                  </p>
                </div>
                <Input
                  value={user.email}
                  disabled
                  className="w-[280px] bg-secondary border-border opacity-60"
                />
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <Label className="text-sm text-foreground">
                    Member since
                  </Label>
                </div>
                <span className="text-sm font-mono text-muted-foreground">
                  {new Date(user.createdAt).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
            </div>

            <div className="mt-6 flex items-center gap-3">
              <Button
                onClick={handleSave}
                disabled={saving || name.trim() === user.name}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : saved ? (
                  <Check className="h-4 w-4 mr-2" />
                ) : null}
                {saved ? "Saved" : "Save changes"}
              </Button>
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
