"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, CirclePlus, User } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "Feed", icon: Home },
  { href: "/explore", label: "Explore", icon: Search },
  { href: "/create", label: "Create", icon: CirclePlus },
  { href: "/profile", label: "Profile", icon: User },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-border/80 bg-background/80 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-lg md:hidden"
      aria-label="Primary"
    >
      {items.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        const isCreate = href === "/create";
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 px-2 py-1.5 text-[11px] font-medium transition-colors",
              active ? "text-foreground" : "text-muted"
            )}
          >
            <Icon
              size={isCreate ? 30 : 24}
              strokeWidth={active ? 2.4 : 1.8}
              className={isCreate ? "text-accent" : undefined}
            />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
