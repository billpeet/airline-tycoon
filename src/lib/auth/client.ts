import { createAuthClient } from "better-auth/react";

// No baseURL: Better Auth uses the current page's origin in the browser, which
// keeps prod (https://your-host) and dev (http://localhost:3000) both working
// without needing to inject a NEXT_PUBLIC_* var at build time.
export const authClient = createAuthClient();

export const { signIn, signOut, useSession } = authClient;
