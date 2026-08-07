"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Mail, Loader2, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function AppleLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M16.365 1.43c0 1.14-.468 2.216-1.24 3.02-.84.878-2.19 1.552-3.29 1.462-.14-1.12.41-2.29 1.19-3.06.83-.83 2.24-1.44 3.34-1.42zm3.62 16.53c-.44 1.02-.65 1.47-1.21 2.38-.79 1.28-1.9 2.87-3.28 2.89-1.22.02-1.54-.79-3.2-.78-1.66.01-2.01.8-3.24.78-1.38-.02-2.43-1.45-3.22-2.73-2.2-3.56-2.43-7.74-1.08-9.97.96-1.58 2.48-2.5 3.9-2.5 1.45 0 2.36.79 3.56.79 1.16 0 1.87-.79 3.55-.79 1.27 0 2.61.69 3.57 1.89-3.14 1.72-2.63 6.19.19 8.03z" />
    </svg>
  );
}

function GoogleLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47c-.28 1.5-1.13 2.78-2.4 3.63v3.02h3.89c2.27-2.09 3.56-5.17 3.56-8.84z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.07 7.93-2.9l-3.89-3.02c-1.08.72-2.45 1.15-4.04 1.15-3.1 0-5.73-2.1-6.67-4.92H1.3v3.09C3.26 21.3 7.3 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.33 14.31c-.24-.72-.38-1.49-.38-2.28s.14-1.56.38-2.28V6.66H1.3A11.98 11.98 0 000 12.03c0 1.94.46 3.77 1.3 5.37l4.03-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.76 0 3.34.6 4.58 1.79l3.44-3.44C17.94 1.19 15.24 0 12 0 7.3 0 3.26 2.7 1.3 6.66l4.03 3.09c.94-2.82 3.57-4.92 6.67-5z"
      />
    </svg>
  );
}

export function AuthForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";
  const [email, setEmail] = useState("");
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleOAuth(provider: "google" | "apple") {
    setError(null);
    setLoadingProvider(provider);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) {
      setError(error.message);
      setLoadingProvider(null);
    }
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoadingProvider("email");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    setLoadingProvider(null);
    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
  }

  if (sent) {
    return (
      <div className="animate-fade-up text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 text-accent">
          <Mail size={26} />
        </div>
        <h2 className="text-lg font-semibold">Check your inbox</h2>
        <p className="mt-2 text-sm text-muted">
          We sent a sign-in link to <span className="text-foreground">{email}</span>.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm space-y-3">
      <Button
        variant="outline"
        size="lg"
        className="w-full"
        onClick={() => handleOAuth("google")}
        disabled={loadingProvider !== null}
      >
        {loadingProvider === "google" ? (
          <Loader2 size={18} className="animate-spin" />
        ) : (
          <GoogleLogo className="h-[18px] w-[18px]" />
        )}
        Continue with Google
      </Button>

      <Button
        variant="outline"
        size="lg"
        className="w-full"
        onClick={() => handleOAuth("apple")}
        disabled={loadingProvider !== null}
      >
        {loadingProvider === "apple" ? (
          <Loader2 size={18} className="animate-spin" />
        ) : (
          <AppleLogo className="h-[18px] w-[18px]" />
        )}
        Continue with Apple
      </Button>

      <div className="flex items-center gap-3 py-1">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted">or</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={handleEmailSubmit} className="space-y-3">
        <input
          type="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={cn(
            "h-11 w-full rounded-full border border-border bg-surface px-4 text-[15px]",
            "outline-none placeholder:text-muted focus:border-accent"
          )}
        />
        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={loadingProvider !== null || !email}
        >
          {loadingProvider === "email" ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <>
              Continue with Email
              <ArrowRight size={16} />
            </>
          )}
        </Button>
      </form>

      {error && <p className="text-center text-sm text-accent-right">{error}</p>}
    </div>
  );
}
