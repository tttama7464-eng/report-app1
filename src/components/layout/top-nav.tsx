"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, CirclePlus, User, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/providers/theme-provider";
import { useAuth } from "@/components/providers/auth-provider";

const items = [
  { href: "/", label: "Feed", icon: Home },
  { href: "/explore", label: "Explore", icon: Search },
  { href: "/create", label: "Create", icon: CirclePlus },
];

export function TopNav() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();

  return (
    <header className="fixed inset-x-0 top-0 z-40 hidden border-b border-border/80 bg-background/80 backdrop-blur-lg md:block">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Sense
        </Link>

        <nav className="flex items-center gap-1" aria-label="Primary">
          {items.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-surface text-foreground"
                    : "text-muted hover:text-foreground"
                )}
              >
                <Icon size={18} strokeWidth={2} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface hover:text-foreground"
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <Link
            href={user ? "/profile" : "/login"}
            className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-surface text-muted hover:text-foreground"
          >
            <User size={18} />
          </Link>
        </div>
      </div>
    </header>
  );
}
