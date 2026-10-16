import { NewSubmissionButton } from "@/components/NewSubmissionButton";
import { RowMenu } from "@/components/RowMenu";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const statusLabel: Record<string, string> = {
  planned:   "Planned",
  submitted: "Submitted",
  live:      "Live",
  rejected:  "Rejected",
};

const statusBadgeClass: Record<string, string> = {
  live:      "bg-live-bg text-live before:bg-live",
  pending:   "bg-pending-bg text-pending before:bg-pending",
  planned:   "bg-[#f4f3f0] text-muted before:bg-muted",
  submitted: "bg-pending-bg text-pending before:bg-pending",
  review:    "bg-review-bg text-review before:bg-review",
  rejected:  "bg-rejected-bg text-rejected before:bg-rejected",
};

function formatDate(date: Date | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}

function formatTraffic(visits: number): string {
  if (visits === 0) return "0";
  if (visits >= 1000) return `${(visits / 1000).toFixed(1)}K`;
  return visits.toString();
}

function IconFilter() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="1" y1="3" x2="12" y2="3" />
      <line x1="3" y1="6.5" x2="10" y2="6.5" />
      <line x1="5" y1="10" x2="8" y2="10" />
    </svg>
  );
}

export default async function DashboardPage() {
  const [listCount, dirCount, subCount, trafficAgg, dbDirectories, dbSubmissions] = await Promise.all([
    prisma.list.count(),
    prisma.directory.count(),
    prisma.submission.count(),
    prisma.traffic.aggregate({ _sum: { visits: true } }),
    prisma.directory.findMany({
      where: { submission: null },
      select: { id: true, name: true, list: { select: { id: true, name: true } } },
      orderBy: [{ list: { name: "asc" } }, { name: "asc" }],
    }),
    prisma.submission.findMany({
      select: {
        id: true,
        status: true,
        submittedAt: true,
        directory: { select: { name: true, list: { select: { name: true } } } },
        traffic: { select: { visits: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  const totalVisits = trafficAgg._sum.visits ?? 0;

  const stats = [
    { label: "Lists",       value: String(listCount) },
    { label: "Directories", value: String(dirCount) },
    { label: "Submissions", value: String(subCount) },
    { label: "Traffic",     value: formatTraffic(totalVisits) },
  ];

  return (
    <div className="flex flex-col min-h-screen min-w-0">
      {/* HEADER */}
      <header className="sticky top-0 z-[10] flex items-center justify-between gap-4 px-[clamp(20px,4vw,48px)] h-[57px] border-b border-line bg-[rgba(250,250,249,0.9)] backdrop-blur-[8px] flex-shrink-0 max-[640px]:px-4">
        <h1 className="m-0 text-[16px] font-bold tracking-[-0.03em] text-ink leading-none">Overview</h1>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            className="inline-flex items-center gap-[6px] px-[13px] h-[34px] rounded-[8px] bg-transparent text-muted border border-line text-[13px] font-medium cursor-pointer w-auto whitespace-nowrap transition-[color,background-color,border-color] duration-[120ms] hover:text-ink hover:bg-sheet hover:border-line-strong"
            type="button"
          >
            <IconFilter />
            Filter
          </button>
          <NewSubmissionButton directories={dbDirectories} />
        </div>
      </header>

      {/* STATS STRIP */}
      <div className="flex border-b border-line flex-shrink-0 max-[640px]:flex-wrap" role="region" aria-label="Key metrics">
        {stats.map((s) => (
          <div className="dash-stat flex-1 px-[clamp(16px,3vw,36px)] py-4 border-r border-line last:border-r-0 max-[640px]:flex-none max-[640px]:basis-1/2" key={s.label}>
            <p className="m-0 mb-[5px] text-muted text-[10px] font-bold tracking-[0.07em] uppercase">{s.label}</p>
            <span className="font-mono text-[24px] font-medium tracking-[-0.04em] text-ink leading-none">{s.value}</span>
          </div>
        ))}
      </div>

      {/* BODY */}
      <div className="flex-1 py-[clamp(18px,3vw,30px)] px-[clamp(20px,4vw,36px)]">
        <div className="flex items-center justify-between gap-2 mb-4">
          <h2 className="m-0 text-[13px] font-bold tracking-[-0.02em] text-ink leading-none">Recent submissions</h2>
          <span className="text-muted font-mono text-[11px] font-normal">{subCount} total</span>
        </div>

        {dbSubmissions.length === 0 ? (
          <p className="text-muted text-[13px]">No submissions yet — add directories and track your first one.</p>
        ) : (
          <table className="sub-table w-full border-collapse">
            <thead>
              <tr>
                <th scope="col" className="pb-[10px] pr-[14px] text-muted text-[10px] font-bold tracking-[0.07em] uppercase text-left border-b border-line whitespace-nowrap">Directory</th>
                <th scope="col" className="pb-[10px] pr-[14px] text-muted text-[10px] font-bold tracking-[0.07em] uppercase text-left border-b border-line whitespace-nowrap">List</th>
                <th scope="col" className="pb-[10px] pr-[14px] text-muted text-[10px] font-bold tracking-[0.07em] uppercase text-left border-b border-line whitespace-nowrap">Status</th>
                <th scope="col" className="pb-[10px] pr-[14px] text-muted text-[10px] font-bold tracking-[0.07em] uppercase text-left border-b border-line whitespace-nowrap max-[640px]:hidden">Submitted</th>
                <th scope="col" className="pb-[10px] pr-[14px] text-muted text-[10px] font-bold tracking-[0.07em] uppercase text-right border-b border-line whitespace-nowrap">Traffic</th>
                <th scope="col" className="pb-[10px] w-[40px] pr-0 border-b border-line"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {dbSubmissions.map((sub) => {
                const visits = sub.traffic.reduce((acc, t) => acc + t.visits, 0);
                const trafficStr = visits > 0 ? formatTraffic(visits) : null;
                return (
                  <tr key={sub.id}>
                    <td className="py-3 pr-[14px] text-ink border-b border-line align-middle whitespace-nowrap text-[13px] font-semibold tracking-[-0.02em]">
                      {sub.directory.name}
                    </td>
                    <td className="py-3 pr-[14px] text-muted border-b border-line align-middle whitespace-nowrap text-[13px]">
                      {sub.directory.list.name}
                    </td>
                    <td className="py-3 pr-[14px] border-b border-line align-middle whitespace-nowrap text-[13px]">
                      <span className={`inline-flex items-center gap-[5px] px-2 py-[2px] rounded-full text-[11px] font-semibold tracking-[0.01em] whitespace-nowrap leading-[1.6] before:content-[''] before:block before:w-[5px] before:h-[5px] before:rounded-full before:flex-shrink-0 ${statusBadgeClass[sub.status] ?? "bg-[#f4f3f0] text-muted before:bg-muted"}`}>
                        {statusLabel[sub.status] ?? sub.status}
                      </span>
                    </td>
                    <td className="py-3 pr-[14px] text-muted border-b border-line align-middle whitespace-nowrap text-[12px] max-[640px]:hidden">
                      {formatDate(sub.submittedAt)}
                    </td>
                    <td className={`py-3 pr-[14px] border-b border-line align-middle whitespace-nowrap text-right font-mono text-[12px] font-medium ${!trafficStr ? "text-muted" : "text-ink"}`}>
                      {trafficStr ?? "—"}
                    </td>
                    <td className="py-3 pr-0 border-b border-line align-middle text-right w-[40px]">
                      <RowMenu label={`More options for ${sub.directory.name}`} submissionId={sub.id} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
