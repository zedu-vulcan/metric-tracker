import { AddDirectoryModal } from "@/components/AddDirectoryModal";
import { AddListModal } from "@/components/AddListModal";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const statusDot: Record<string, string> = {
  live:      "bg-live",
  submitted: "bg-pending",
  planned:   "bg-muted",
  rejected:  "bg-rejected",
};

const statusLabel: Record<string, string> = {
  live:      "Live",
  submitted: "Submitted",
  planned:   "Planned",
  rejected:  "Rejected",
};

function IconFolder() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
      <path d="M1 4a1 1 0 0 1 1-1h3l1.5 2H12a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V4z" />
    </svg>
  );
}

export default async function DirectoriesPage() {
  const lists = await prisma.list.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      directories: {
        orderBy: { createdAt: "asc" },
        include: {
          submission: { select: { id: true, status: true } },
        },
      },
      _count: { select: { directories: true } },
    },
  });

  const totalDirs = lists.reduce((acc, l) => acc + l._count.directories, 0);

  return (
    <div className="flex flex-col min-h-screen min-w-0">
      {/* HEADER */}
      <header className="sticky top-0 z-[10] flex items-center justify-between gap-4 px-[clamp(20px,4vw,48px)] h-[57px] border-b border-line bg-[rgba(250,250,249,0.9)] backdrop-blur-[8px] flex-shrink-0 max-[640px]:px-4">
        <div className="flex items-baseline gap-[10px]">
          <h1 className="m-0 text-[16px] font-bold tracking-[-0.03em] text-ink leading-none">Directories</h1>
          <span className="text-muted font-mono text-[11px] font-normal">{totalDirs} total</span>
        </div>
        <AddListModal />
      </header>

      {/* BODY */}
      <div className="flex-1 py-[clamp(18px,3vw,30px)] px-[clamp(20px,4vw,36px)]">
        {lists.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <div className="w-10 h-10 rounded-[10px] bg-surface border border-line flex items-center justify-center text-muted">
              <IconFolder />
            </div>
            <p className="m-0 text-ink text-[14px] font-semibold tracking-[-0.02em]">No lists yet</p>
            <p className="m-0 text-muted text-[13px] max-w-[260px] leading-[1.5]">
              Create a list to start grouping your directories together.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {lists.map((list) => (
              <section key={list.id}>
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-[8px]">
                    <h2 className="m-0 text-[14px] font-bold tracking-[-0.03em] text-ink leading-none">{list.name}</h2>
                    <span className="text-muted font-mono text-[11px]">{list._count.directories}</span>
                  </div>
                  <AddDirectoryModal listId={list.id} listName={list.name} />
                </div>

                {list.directories.length === 0 ? (
                  <p className="text-muted text-[13px] py-3">No directories in this list yet.</p>
                ) : (
                  <div className="border border-line rounded-[10px] overflow-hidden">
                    {list.directories.map((dir, i) => (
                      <div
                        key={dir.id}
                        className={`flex items-center gap-3 px-4 py-[11px] bg-sheet transition-colors duration-[80ms] hover:bg-[rgba(142,106,250,0.03)] ${i < list.directories.length - 1 ? "border-b border-line" : ""}`}
                      >
                        <div className="flex-1 min-w-0">
                          <span className="block text-[13px] font-semibold text-ink tracking-[-0.02em] overflow-hidden text-ellipsis whitespace-nowrap">
                            {dir.name}
                          </span>
                          {dir.url && (
                            <a
                              href={dir.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block text-[11px] text-muted hover:text-violet-deep overflow-hidden text-ellipsis whitespace-nowrap mt-[1px] no-underline hover:underline"
                            >
                              {dir.url}
                            </a>
                          )}
                        </div>

                        {dir.submission ? (
                          <span className={`inline-flex items-center gap-[5px] px-[8px] py-[2px] rounded-full text-[11px] font-semibold whitespace-nowrap leading-[1.6] flex-shrink-0 ${
                            dir.submission.status === "live"      ? "bg-live-bg text-live" :
                            dir.submission.status === "submitted" ? "bg-pending-bg text-pending" :
                            dir.submission.status === "rejected"  ? "bg-rejected-bg text-rejected" :
                            "bg-[#f4f3f0] text-muted"
                          }`}>
                            <span className={`w-[5px] h-[5px] rounded-full flex-shrink-0 ${statusDot[dir.submission.status] ?? "bg-muted"}`} />
                            {statusLabel[dir.submission.status] ?? dir.submission.status}
                          </span>
                        ) : (
                          <span className="text-muted text-[11px] font-medium flex-shrink-0">Not tracked</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
