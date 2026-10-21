/** Placeholder list. Goal types will be managed by a platform admin, so the UI treats a type as plain data. */
export const GOAL_TYPES = ["SEO", "Content", "Research", "Lead hunting", "Press"];

export type DemoUser = { id: string; name: string; image?: string };

export type Goal = {
  id: string;
  title: string;
  type: string;
  description: string;
  ownerId: string;
  ownerName: string;
  createdAt: string;
};

export type Agent = {
  id: string;
  name: string;
  speciality: string;
  ownerName: string;
  lastActiveAt: string;
};

export type IdeaStatus = "proposed" | "accepted" | "rejected";

/** An idea an agent proposed under a goal. Once accepted it is a workstream, and tasks are created inside it. */
export type Idea = {
  id: string;
  goalId: string;
  agentId: string;
  title: string;
  description: string;
  proposedAt: string;
  status: IdeaStatus;
  decidedBy?: string;
  decidedAt?: string;
  rejectionReason?: string;
};

/** Placeholder task types until the admin screen exists. `points` is the default, `maxPoints` the cap per task. */
export const TASK_TYPES: { name: string; points: number; maxPoints: number }[] = [
  { name: "Research", points: 20, maxPoints: 50 },
  { name: "Lead hunting", points: 30, maxPoints: 50 },
  { name: "Content", points: 40, maxPoints: 50 },
  { name: "SEO", points: 25, maxPoints: 50 },
  { name: "Press", points: 35, maxPoints: 50 },
];

/** Tasks are created automatically inside a workstream and open for bidding straight away. */
export type TaskStatus =
  | "open"
  | "bidding"
  | "in_progress"
  | "changes_requested"
  | "submitted"
  | "in_review"
  | "approved";

export type Task = {
  id: string;
  workstreamId: string;
  title: string;
  description: string;
  taskType: string;
  points: number;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
  assignedAgentId?: string;
  bidCount: number;
  /** A pending offer. The task stays in `bidding` until the agent accepts or the offer expires. */
  offer?: TaskOffer;
  biddingClosesAt?: string;
  revisionCount: number;
  reviewCount: number;
  commentCount: number;
};

export type TaskOffer = { agentId: string; sentAt: string; expiresAt: string };

/** A `bid` comment from the task thread, as the bids panel reads it. */
export type Bid = {
  id: string;
  taskId: string;
  agentId: string;
  message: string;
  createdAt: string;
};

export const OFFER_HOURS = 24;
export const ACTIVE_TASK_LIMIT = 2;
/** Demo total until the scoreboard exists: all points the signed-in user's agents have earned. */
export const DEMO_POINTS_TOTAL = 1240;

const ACTIVE_STATUSES: TaskStatus[] = ["in_progress", "changes_requested", "submitted", "in_review"];

/** Fairness info shown on a bid, so whoever picks can see who is behind. */
export function agentStats(agentId: string, tasks: Task[]) {
  const given = tasks.filter((task) => task.assignedAgentId === agentId);
  return {
    activeTasks: given.filter((task) => ACTIVE_STATUSES.includes(task.status)).length,
    tasksGiven: given.length,
    pointsThisWeek: given
      .filter((task) => task.status === "approved")
      .reduce((total, task) => total + task.points, 0),
  };
}

export type TaskStage = "open" | "in_progress" | "in_review" | "approved";

export const TASK_STAGES: { value: TaskStage; label: string; statuses: TaskStatus[] }[] = [
  { value: "open", label: "Open", statuses: ["open", "bidding"] },
  { value: "in_progress", label: "In progress", statuses: ["in_progress", "changes_requested"] },
  { value: "in_review", label: "In review", statuses: ["submitted", "in_review"] },
  { value: "approved", label: "Approved", statuses: ["approved"] },
];

export const MAX_REVISIONS = 2;
export const MAX_REVIEWS = 4;

export type WorkstreamSummary = {
  openTasks: number;
  activeTasks: number;
  approvedTasks: number;
  totalTasks: number;
  pointsReleased: number;
  pointsOnOffer: number;
};

const inStage = (stage: TaskStage, task: Task) =>
  TASK_STAGES.find((option) => option.value === stage)?.statuses.includes(task.status) ?? false;

export function summarizeTasks(tasks: Task[]): WorkstreamSummary {
  const approved = tasks.filter((task) => task.status === "approved");

  return {
    openTasks: tasks.filter((task) => inStage("open", task)).length,
    activeTasks: tasks.filter((task) => inStage("in_progress", task) || inStage("in_review", task)).length,
    approvedTasks: approved.length,
    totalTasks: tasks.length,
    pointsReleased: approved.reduce((total, task) => total + task.points, 0),
    pointsOnOffer: tasks.reduce((total, task) => total + task.points, 0),
  };
}

export type GoalSummary = {
  workstreams: number;
  pendingIdeas: number;
  openTasks: number;
  approvedTasks: number;
  totalTasks: number;
  pointsReleased: number;
};

export function summarizeGoal(goalId: string, ideas: Idea[], tasks: Task[]): GoalSummary {
  const own = ideas.filter((idea) => idea.goalId === goalId);
  const workstreamIds = new Set(own.filter((idea) => idea.status === "accepted").map((idea) => idea.id));
  const tasksSummary = summarizeTasks(tasks.filter((task) => workstreamIds.has(task.workstreamId)));

  return {
    workstreams: workstreamIds.size,
    pendingIdeas: own.filter((idea) => idea.status === "proposed").length,
    openTasks: tasksSummary.openTasks,
    approvedTasks: tasksSummary.approvedTasks,
    totalTasks: tasksSummary.totalTasks,
    pointsReleased: tasksSummary.pointsReleased,
  };
}

export const DEMO_AGENTS: Agent[] = [
  {
    id: "agent_scout",
    name: "SEO Scout",
    speciality: "Technical SEO",
    ownerName: "Ada Okafor",
    lastActiveAt: "2026-10-20T08:40:00.000Z",
  },
  {
    id: "agent_quill",
    name: "Quill",
    speciality: "Long-form content",
    ownerName: "Tunde Bello",
    lastActiveAt: "2026-10-20T09:05:00.000Z",
  },
  {
    id: "agent_hunter",
    name: "Lead Hunter",
    speciality: "Lead research",
    ownerName: "Chioma Eze",
    lastActiveAt: "2026-10-19T17:30:00.000Z",
  },
  {
    id: "agent_wire",
    name: "Newswire",
    speciality: "Press outreach",
    ownerName: "Ada Okafor",
    lastActiveAt: "2026-10-18T11:10:00.000Z",
  },
];

/** The first goal belongs to whoever is signed in, so the demo shows both the owner's and a viewer's view. */
export function demoGoals(currentUser: DemoUser): Goal[] {
  return [
    {
      id: "goal_seo",
      title: "Make Zedu SEO compliant",
      type: "SEO",
      description: "Fix on-page issues across the marketing site so every page passes the SEO checker.",
      ownerId: currentUser.id,
      ownerName: currentUser.name,
      createdAt: "2026-10-14T09:00:00.000Z",
    },
    {
      id: "goal_content",
      title: "Get really good at content production",
      type: "Content",
      description: "Publish a steady stream of articles about how travel and work are changing.",
      ownerId: "user_tunde",
      ownerName: "Tunde Bello",
      createdAt: "2026-10-15T11:30:00.000Z",
    },
    {
      id: "goal_leads",
      title: "Build a bootcamp contacts list",
      type: "Lead hunting",
      description: "Find coding bootcamps and their programme leads so we can pitch Zedu to them.",
      ownerId: "user_ada",
      ownerName: "Ada Okafor",
      createdAt: "2026-10-17T08:15:00.000Z",
    },
    {
      id: "goal_press",
      title: "Land Zedu in three tech publications",
      type: "Press",
      description: "Pitch launch stories to African tech outlets and track who responds.",
      ownerId: "user_chioma",
      ownerName: "Chioma Eze",
      createdAt: "2026-10-19T14:45:00.000Z",
    },
  ];
}

export function demoIdeas(currentUser: DemoUser): Idea[] {
  return [
    {
      id: "idea_onpage",
      goalId: "goal_seo",
      agentId: "agent_scout",
      title: "On-page SEO",
      description: "Fix titles, meta descriptions, H1s and image alt text on every marketing page.",
      proposedAt: "2026-10-14T12:10:00.000Z",
      status: "accepted",
      decidedBy: currentUser.name,
      decidedAt: "2026-10-14T15:00:00.000Z",
    },
    {
      id: "idea_technical",
      goalId: "goal_seo",
      agentId: "agent_scout",
      title: "Technical SEO",
      description: "Sitemap, robots.txt, canonical tags and page speed fixes.",
      proposedAt: "2026-10-15T09:20:00.000Z",
      status: "accepted",
      decidedBy: currentUser.name,
      decidedAt: "2026-10-15T10:05:00.000Z",
    },
    {
      id: "idea_schema",
      goalId: "goal_seo",
      agentId: "agent_scout",
      title: "Structured data for every page",
      description: "Add schema.org markup (Organization, Article, FAQ) so search results show rich snippets.",
      proposedAt: "2026-10-20T07:40:00.000Z",
      status: "proposed",
    },
    {
      id: "idea_backlinks",
      goalId: "goal_seo",
      agentId: "agent_quill",
      title: "Backlinks from bootcamp blogs",
      description: "Write guest posts for coding bootcamp blogs that link back to Zedu's guides.",
      proposedAt: "2026-10-20T08:55:00.000Z",
      status: "proposed",
    },
    {
      id: "idea_pricing_h1",
      goalId: "goal_seo",
      agentId: "agent_hunter",
      title: "Fix the H1 tag on the pricing page",
      description: "The pricing page has two H1 tags.",
      proposedAt: "2026-10-16T13:30:00.000Z",
      status: "rejected",
      decidedBy: currentUser.name,
      decidedAt: "2026-10-16T16:00:00.000Z",
      rejectionReason: "This is a task, not a workstream. Propose it under On-page SEO.",
    },
    {
      id: "idea_industry",
      goalId: "goal_content",
      agentId: "agent_quill",
      title: "Write content about our industry",
      description: "A weekly series on how remote work and travel are changing business.",
      proposedAt: "2026-10-15T14:00:00.000Z",
      status: "accepted",
      decidedBy: "Tunde Bello",
      decidedAt: "2026-10-15T17:30:00.000Z",
    },
    {
      id: "idea_guides",
      goalId: "goal_content",
      agentId: "agent_quill",
      title: "How-to guides for new users",
      description: "Step-by-step guides that answer the questions new users ask support most.",
      proposedAt: "2026-10-19T10:15:00.000Z",
      status: "proposed",
    },
    {
      id: "idea_bootcamps",
      goalId: "goal_leads",
      agentId: "agent_hunter",
      title: "Nigerian coding bootcamps",
      description: "List bootcamps in Lagos, Abuja and online, with programme leads and contact emails.",
      proposedAt: "2026-10-17T11:00:00.000Z",
      status: "accepted",
      decidedBy: "Ada Okafor",
      decidedAt: "2026-10-17T12:20:00.000Z",
    },
    {
      id: "idea_outlets",
      goalId: "goal_press",
      agentId: "agent_wire",
      title: "Launch story for TechCabal and Techpoint",
      description: "Pitch the Zedu launch as a founder story with usage numbers.",
      proposedAt: "2026-10-19T16:30:00.000Z",
      status: "proposed",
    },
  ];
}

type DemoTaskInput = Pick<Task, "id" | "workstreamId" | "title" | "description" | "taskType" | "status"> &
  Partial<Task> & { day: number };

/** How many demo bids each bidding task starts with. */
const DEMO_BID_COUNTS: Record<string, number> = {
  task_alt_text: 3,
  task_internal_links: 1,
  task_canonical: 2,
  task_flight_post: 2,
};

function demoTask({ day, ...task }: DemoTaskInput): Task {
  const at = `2026-10-${String(day).padStart(2, "0")}T09:00:00.000Z`;
  const bidCount = task.bidCount ?? DEMO_BID_COUNTS[task.id] ?? (task.assignedAgentId ? 2 : 0);
  const reviewCount = task.reviewCount ?? 0;
  const revisionCount = task.revisionCount ?? 0;
  return {
    points: TASK_TYPES.find((type) => type.name === task.taskType)?.points ?? 20,
    createdAt: at,
    updatedAt: at,
    commentCount: bidCount + reviewCount + revisionCount + (task.assignedAgentId ? 1 : 0),
    ...task,
    bidCount,
    reviewCount,
    revisionCount,
  };
}

/** One line saying where a task stands: bids, the pending offer, who is working on it, revisions or reviews. */
export function taskProgressLine(
  task: Task,
  { worker, offeredTo, bidCount }: { worker?: Agent; offeredTo?: Agent; bidCount: number }
) {
  const name = worker?.name ?? "an agent";
  if (task.offer) {
    return `Offer sent to ${offeredTo?.name ?? "an agent"} · expires ${shortDateTime.format(new Date(task.offer.expiresAt))}`;
  }
  switch (task.status) {
    case "open":
      return "Open for bids · no bids yet";
    case "bidding":
      return `${bidCount} ${bidCount === 1 ? "bid" : "bids"}${
        task.biddingClosesAt ? ` · closes ${shortDateTime.format(new Date(task.biddingClosesAt))}` : ""
      }`;
    case "in_progress":
      return `${name} is working on it`;
    case "changes_requested":
      return `${name} · revision ${task.revisionCount} of ${MAX_REVISIONS}`;
    case "submitted":
      return `Delivered by ${name} · waiting for reviews`;
    case "in_review":
      return `Delivered by ${name} · ${task.reviewCount} of ${MAX_REVIEWS} reviews`;
    case "approved":
      return `Done by ${name} · ${shortDate.format(new Date(task.updatedAt))}`;
  }
}

export function demoTasks(): Task[] {
  return [
    // On-page SEO
    demoTask({
      id: "task_og_tags",
      workstreamId: "idea_onpage",
      title: "Add OG tags to blog posts",
      description: "Every blog post needs og:title, og:description and og:image so links preview properly.",
      taskType: "SEO",
      status: "open",
      day: 20,
    }),
    demoTask({
      id: "task_faq_snippets",
      workstreamId: "idea_onpage",
      title: "Add FAQ snippets to the pricing page",
      description: "Mark up the pricing FAQ so it can show as a rich result.",
      taskType: "SEO",
      status: "open",
      day: 20,
    }),
    demoTask({
      id: "task_alt_text",
      workstreamId: "idea_onpage",
      title: "Add alt text to hero images",
      description: "Write descriptive alt text for the hero image on every landing page.",
      taskType: "SEO",
      status: "bidding",
      biddingClosesAt: "2026-10-21T09:00:00.000Z",
      day: 19,
    }),
    demoTask({
      id: "task_titles",
      workstreamId: "idea_onpage",
      title: "Rewrite page titles under 60 characters",
      description: "Twelve pages have titles that get cut off in search results.",
      taskType: "SEO",
      status: "open",
      day: 20,
    }),
    demoTask({
      id: "task_internal_links",
      workstreamId: "idea_onpage",
      title: "Add internal links between guides",
      description: "Link each guide to at least two related guides.",
      taskType: "SEO",
      status: "bidding",
      biddingClosesAt: "2026-10-21T15:00:00.000Z",
      day: 20,
    }),
    demoTask({
      id: "task_meta",
      workstreamId: "idea_onpage",
      title: "Rewrite meta descriptions",
      description: "Unique 150-character meta descriptions for the top 20 pages.",
      taskType: "SEO",
      status: "in_progress",
      assignedAgentId: "agent_quill",
      day: 18,
    }),
    demoTask({
      id: "task_compress",
      workstreamId: "idea_onpage",
      title: "Compress homepage images",
      description: "Bring the homepage under 1 MB without visible quality loss.",
      taskType: "SEO",
      status: "changes_requested",
      assignedAgentId: "agent_scout",
      revisionCount: 1,
      reviewCount: 3,
      day: 17,
    }),
    demoTask({
      id: "task_h1",
      workstreamId: "idea_onpage",
      title: "Fix the H1 on the pricing page",
      description: "The pricing page has two H1 tags; keep one.",
      taskType: "SEO",
      status: "in_review",
      assignedAgentId: "agent_hunter",
      reviewCount: 2,
      day: 16,
    }),
    ...["About page", "Careers page", "Contact page"].map((page, index) =>
      demoTask({
        id: `task_onpage_done_${index}`,
        workstreamId: "idea_onpage",
        title: `Fix headings on the ${page}`,
        description: `Use one H1 and a logical H2/H3 order on the ${page}.`,
        taskType: "SEO",
        status: "approved",
        assignedAgentId: index === 1 ? "agent_quill" : "agent_scout",
        reviewCount: 3,
        day: 15 + index,
      })
    ),

    // Technical SEO
    demoTask({
      id: "task_sitemap",
      workstreamId: "idea_technical",
      title: "Generate an XML sitemap",
      description: "Include every public page and submit it to Search Console.",
      taskType: "SEO",
      status: "approved",
      assignedAgentId: "agent_scout",
      reviewCount: 4,
      day: 15,
    }),
    demoTask({
      id: "task_canonical",
      workstreamId: "idea_technical",
      title: "Add canonical tags",
      description: "Stop duplicate content between /blog and /blog?page=1.",
      taskType: "SEO",
      status: "bidding",
      biddingClosesAt: "2026-10-21T12:00:00.000Z",
      day: 19,
    }),
    demoTask({
      id: "task_speed",
      workstreamId: "idea_technical",
      title: "Audit page speed on mobile",
      description: "Report the five slowest pages with their Core Web Vitals.",
      taskType: "Research",
      status: "in_progress",
      assignedAgentId: "agent_hunter",
      day: 18,
    }),

    // Write content about our industry
    demoTask({
      id: "task_travel_post",
      workstreamId: "idea_industry",
      title: "How travel is changing business",
      description: "A 1,200-word article for the Zedu blog.",
      taskType: "Content",
      status: "in_review",
      assignedAgentId: "agent_quill",
      reviewCount: 3,
      day: 17,
    }),
    demoTask({
      id: "task_flight_post",
      workstreamId: "idea_industry",
      title: "The best way to get a good flight",
      description: "A practical guide with five tips and sources.",
      taskType: "Content",
      status: "bidding",
      biddingClosesAt: "2026-10-21T10:00:00.000Z",
      day: 19,
    }),
    demoTask({
      id: "task_remote_post",
      workstreamId: "idea_industry",
      title: "Remote teams that travel together",
      description: "Interview-style post with two Zedu customers.",
      taskType: "Content",
      status: "open",
      day: 20,
    }),
    demoTask({
      id: "task_trends_post",
      workstreamId: "idea_industry",
      title: "Five travel trends for 2027",
      description: "A short trend round-up for LinkedIn and the blog.",
      taskType: "Content",
      status: "approved",
      assignedAgentId: "agent_quill",
      reviewCount: 4,
      day: 16,
    }),

    // Nigerian coding bootcamps
    demoTask({
      id: "task_lagos",
      workstreamId: "idea_bootcamps",
      title: "List Lagos bootcamps",
      description: "Name, website, programme lead and contact email for each bootcamp.",
      taskType: "Lead hunting",
      status: "in_progress",
      assignedAgentId: "agent_hunter",
      day: 18,
    }),
    demoTask({
      id: "task_abuja",
      workstreamId: "idea_bootcamps",
      title: "List Abuja bootcamps",
      description: "Same fields as the Lagos list.",
      taskType: "Lead hunting",
      status: "open",
      day: 19,
    }),
    demoTask({
      id: "task_online",
      workstreamId: "idea_bootcamps",
      title: "List online-only bootcamps",
      description: "Bootcamps that run fully online and accept Nigerian students.",
      taskType: "Lead hunting",
      status: "open",
      day: 20,
    }),
  ];
}

export const shortDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
export const shortDateTime = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});
