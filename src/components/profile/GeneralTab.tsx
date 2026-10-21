import { KpiCard } from "@/components/KpiCard";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export type ProfileDetails = {
  name: string | null;
  email: string | null;
  image: string | null;
  emailVerified: boolean;
  providers: string[];
  agentCount: number;
};

const PROVIDER_LABELS: Record<string, string> = { google: "Google" };

const LABEL = "text-2xs font-bold tracking-[0.07em] text-muted-foreground uppercase";

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "Z";
}

// Google serves a 96px photo by default, which blurs at this size, so ask for 256px.
function largeAvatar(url: string) {
  return url.replace(/=s\d+-c$/, "=s256-c");
}

export function GeneralTab({ profile }: { profile: ProfileDetails }) {
  const displayName = profile.name ?? profile.email ?? "Your profile";
  const providers = profile.providers.map((id) => PROVIDER_LABELS[id] ?? id.charAt(0).toUpperCase() + id.slice(1));

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
      <Card>
        <CardContent className="flex flex-col gap-6">
          <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
            {profile.image ? (
              <img
                src={largeAvatar(profile.image)}
                alt={`${displayName}'s profile picture`}
                referrerPolicy="no-referrer"
                className="size-32 shrink-0 rounded-full object-cover ring-4 ring-accent"
              />
            ) : (
              <span
                role="img"
                aria-label={`${displayName}'s profile picture`}
                className="flex size-32 shrink-0 items-center justify-center rounded-full bg-primary text-[40px] font-extrabold tracking-[-0.03em] text-primary-foreground ring-4 ring-accent"
              >
                {initialsOf(displayName)}
              </span>
            )}

            <div className="flex min-w-0 max-w-full flex-col gap-1">
              <h2 className="m-0 truncate text-2xl font-extrabold tracking-[-0.035em] text-foreground sm:text-[28px]">
                {displayName}
              </h2>
              {profile.email && profile.email !== displayName && (
                <p className="m-0 truncate text-sm text-muted-foreground" title={profile.email}>
                  {profile.email}
                </p>
              )}
            </div>
          </div>

          <Separator />

          <dl className="m-0 grid gap-4 sm:grid-cols-2 sm:gap-x-8">
            <div className="flex min-w-0 flex-col gap-1.5">
              <dt className={LABEL}>Signed in with</dt>
              <dd className="m-0 text-sm font-semibold text-foreground">
                {providers.length > 0 ? providers.join(", ") : "—"}
              </dd>
            </div>
            <div className="flex min-w-0 flex-col items-start gap-1.5">
              <dt className={LABEL}>Email status</dt>
              <dd className="m-0">
                <Badge variant={profile.emailVerified ? "success" : "warning"}>
                  {profile.emailVerified ? "Verified" : "Not verified"}
                </Badge>
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <KpiCard
        title="Your agents"
        value={profile.agentCount.toLocaleString()}
        context={profile.agentCount === 1 ? "Agent connected to your account" : "Agents connected to your account"}
      />
    </div>
  );
}
