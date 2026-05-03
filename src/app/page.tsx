import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/server";
import { SignInButton } from "@/components/auth/sign-in-button";

export default async function Home() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) redirect("/dashboard");

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 px-6 text-center">
      <div className="space-y-3">
        <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">
          A long-haul idle tycoon
        </p>
        <h1 className="text-5xl font-semibold tracking-tight sm:text-6xl">
          Airline Tycoon
        </h1>
        <p className="mx-auto max-w-md text-lg text-muted-foreground">
          Build a fictional airline from a single regional charter to a global empire,
          competing inside the real-world industry.
        </p>
      </div>
      <SignInButton />
      <p className="text-xs text-muted-foreground">Phase 0 — foundation. See SPEC.md.</p>
    </main>
  );
}
