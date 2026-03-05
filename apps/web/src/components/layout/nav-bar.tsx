"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Bot,
  Network as ArenaIcon,
  Phone,
  Users,
  Wrench,
  Settings,
  Menu,
  X,
  User,
  LogOut,
  ChevronDown,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useSession, signOut } from "@/lib/auth-client";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/arena", label: "Arena", icon: ArenaIcon },
  { href: "/teams", label: "Teams", icon: Users },
  { href: "/live", label: "Live", icon: Phone },
  { href: "/tools", label: "Tools", icon: Wrench },
];

function UserAvatar({
  name,
  image,
  size = "sm",
}: {
  name?: string | null;
  image?: string | null;
  size?: "sm" | "lg";
}) {
  const initials = name
    ? name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "?";

  const cls = size === "lg" ? "h-10 w-10 text-sm" : "h-8 w-8 text-xs";

  if (image) {
    return (
      <img
        src={image}
        alt={name || "User"}
        className={cn("rounded-full object-cover", cls)}
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full bg-secondary font-semibold text-muted-foreground",
        cls
      )}
    >
      {initials}
    </div>
  );
}

export function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { data: session } = useSession();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    router.push("/auth/login");
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background">
      <div className="flex h-14 items-center justify-between px-6">
        {/* Left: Logo + Nav */}
        <div className="flex items-center gap-6 h-full">
          <Link href="/" className="flex items-center">
            <span
              className="text-base font-extralight text-foreground"
              style={{ letterSpacing: "8px" }}
            >
              SIESTAI
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1 h-full">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                    isActive
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right: Avatar */}
        <div className="hidden md:flex items-center gap-3" ref={dropdownRef}>
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-secondary/50"
            >
              <UserAvatar
                name={session?.user?.name}
                image={session?.user?.image}
              />
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 top-full mt-1 w-56 rounded-lg border border-border bg-popover p-1 shadow-lg animate-fade-scale-in">
                {session?.user && (
                  <div className="px-3 py-2 border-b border-border mb-1">
                    <p className="text-sm font-medium text-foreground truncate">
                      {session.user.name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {session.user.email}
                    </p>
                  </div>
                )}
                <Link
                  href="/profile"
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground transition-colors hover:bg-secondary"
                >
                  <User className="h-4 w-4" />
                  Profile
                </Link>
                <Link
                  href="/settings"
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground transition-colors hover:bg-secondary"
                >
                  <Settings className="h-4 w-4" />
                  Settings
                </Link>
                <button
                  onClick={handleSignOut}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-destructive transition-colors hover:bg-secondary"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Menu Button */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
        >
          {mobileMenuOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </Button>
      </div>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <nav className="md:hidden border-t border-border bg-background p-4">
          <div className="flex flex-col gap-2">
            {session?.user && (
              <div className="flex items-center gap-3 px-3 py-2 mb-2 border-b border-border pb-4">
                <UserAvatar
                  name={session.user.name}
                  image={session.user.image}
                  size="lg"
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {session.user.name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {session.user.email}
                  </p>
                </div>
              </div>
            )}
            {[
              ...navItems,
              { href: "/profile", label: "Profile", icon: User },
              { href: "/settings", label: "Settings", icon: Settings },
            ].map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                    isActive
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/50",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
            <button
              onClick={handleSignOut}
              className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg text-destructive transition-colors hover:bg-secondary/50 mt-2 border-t border-border pt-4"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </nav>
      )}
    </header>
  );
}
