"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { signIn } from "@/lib/auth/client";

export function SignInButton() {
  const [pending, setPending] = useState(false);
  return (
    <Button
      size="lg"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await signIn.social({ provider: "google", callbackURL: "/dashboard" });
      }}
    >
      {pending ? "Redirecting…" : "Sign in with Google"}
    </Button>
  );
}
