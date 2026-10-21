"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

/** Google sign-in; `callbackUrl` is where to land afterwards, e.g. an invite link. */
export function SignInButton({ callbackUrl = "/dashboard" }: { callbackUrl?: string }) {
  const [isRedirecting, setIsRedirecting] = useState(false);

  return (
    <Button
      size="lg"
      className="w-full"
      disabled={isRedirecting}
      onClick={() => {
        setIsRedirecting(true);
        void signIn("google", { callbackUrl });
      }}
    >
      {isRedirecting && <Spinner data-icon="inline-start" />}
      {isRedirecting ? "Opening Google…" : "Continue with Google"}
    </Button>
  );
}
