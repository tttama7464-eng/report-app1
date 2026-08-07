import { Suspense } from "react";
import { AuthForm } from "@/components/auth/auth-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-[calc(100dvh-4.25rem)] flex-col items-center justify-center px-6 md:min-h-[calc(100dvh-4rem)]">
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Sense</h1>
        <p className="mt-2 text-sm text-muted">Left or right. Just decide.</p>
      </div>
      <Suspense>
        <AuthForm />
      </Suspense>
    </div>
  );
}
