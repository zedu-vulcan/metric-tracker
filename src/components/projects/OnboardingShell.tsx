import { Wordmark } from "@/components/Wordmark";

/** The centred card used outside a project: sign-in style, for creating or joining one. */
export function OnboardingShell({
  title,
  description,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-muted px-4 py-12">
      <div className="flex w-full max-w-[420px] animate-settle-in flex-col items-center gap-8">
        <Wordmark href="/dashboard" className="text-[19px] [&_svg]:size-9" />
        <section className="flex w-full flex-col gap-6 rounded-[22px] border border-border bg-card p-6 sm:p-8">
          <div className="flex flex-col gap-1.5 text-center">
            <h1 className="m-0 text-[22px] leading-tight font-extrabold tracking-[-0.03em] text-foreground">{title}</h1>
            {description && <p className="m-0 text-sm text-muted-foreground">{description}</p>}
          </div>
          {children}
        </section>
      </div>
    </main>
  );
}
