import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { SignInButton } from "@/components/AuthButtons";
import { Wordmark } from "@/components/Wordmark";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

const SIGN_IN_ERRORS: Record<string, string> = {
  AccessDenied: "That Google account doesn't have access. Try a different one.",
  OAuthAccountNotLinked: "That email is already linked to a different sign-in. Use the Google account you used before.",
};

export default async function Home({ searchParams }: { searchParams: { error?: string } }) {
  const session = await getServerSession(authOptions);
  if (session?.user) redirect("/dashboard");

  const error = searchParams.error
    ? (SIGN_IN_ERRORS[searchParams.error] ?? "Sign-in didn't go through. Please try again.")
    : null;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-muted px-4 py-12">
      <div className="flex w-full max-w-[380px] animate-settle-in flex-col items-center gap-8">
        <Wordmark href="/" className="text-[19px] [&_svg]:size-9" />

        <section className="flex w-full flex-col gap-6 rounded-[22px] border border-border bg-card p-6 sm:p-8">
          <div className="flex flex-col gap-1.5 text-center">
            <h1 className="m-0 text-[22px] leading-tight font-extrabold tracking-[-0.03em] text-foreground">Sign in</h1>
            <p className="m-0 text-sm text-muted-foreground">Continue with your Google account.</p>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <SignInButton />
        </section>
      </div>
    </main>
  );
}
