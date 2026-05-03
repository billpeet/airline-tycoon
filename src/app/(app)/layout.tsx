import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/server";
import { AppShell } from "@/components/shell/app-shell";
import { demoKpis } from "@/lib/demo-kpis";

export default async function AppGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/");

  return (
    <AppShell user={session.user} kpis={demoKpis}>
      {children}
    </AppShell>
  );
}
