import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SignOutButton } from "@/components/auth/sign-out-button";

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/");

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 px-6 py-12">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">
            Airline Tycoon
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">Operations centre</h1>
        </div>
        <SignOutButton />
      </header>

      <Card>
        <CardHeader>
          <CardTitle>You&apos;re signed in</CardTitle>
          <CardDescription>
            Auth + DB end-to-end check — this page is only reachable with a valid Better Auth session.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <div>
            <span className="text-muted-foreground">User ID:</span> {session.user.id}
          </div>
          <div>
            <span className="text-muted-foreground">Name:</span> {session.user.name}
          </div>
          <div>
            <span className="text-muted-foreground">Email:</span> {session.user.email}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>What&apos;s next</CardTitle>
          <CardDescription>Phase 1 — seed airports, aircraft and real airlines, then render the 3D globe.</CardDescription>
        </CardHeader>
      </Card>
    </main>
  );
}
