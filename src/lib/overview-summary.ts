import { getAiClient } from "@/lib/ai";
import type { Overview } from "@/lib/overview";
import { overviewSummaryModelSchema, type OverviewSummary } from "@/lib/schemas/overview";

const isoDate = (value: Date) => value.toISOString().slice(0, 10);

const SYSTEM_PROMPT = `You are the marketing analyst for this team, writing a short briefing for the marketing team's dashboard.
You get a JSON snapshot of their content, SEO, directory listings and press work. Use only the numbers and items in it; never invent figures, names or trends.
Reply with a JSON object with exactly these keys:
- "headline": one sentence on the overall state of marketing right now.
- "highlights": up to 4 short points on what is going well or moved recently.
- "risks": up to 4 short points on what is slipping or overdue.
- "nextSteps": up to 4 short, concrete actions for this week, most urgent first.
Write plain sentences without markdown. Use an empty array when a list has nothing worth saying.`;

/** A compact view of the overview for the model: counts and item titles only, no notes or contact details. */
function snapshotFor(overview: Overview) {
  return {
    today: isoDate(overview.today),
    content: overview.content,
    seo: overview.seo && { ...overview.seo, checkedAt: isoDate(overview.seo.checkedAt) },
    press: overview.press,
    directories: overview.directories,
    weekly: overview.weeks.map((week, index) => ({
      weekOf: isoDate(week.start),
      contentPublished: overview.publishedPerWeek[index],
      pressCoverage: overview.coveragePerWeek[index],
    })),
    needsAttention: overview.attention.slice(0, 15).map((item) => ({
      channel: item.channel,
      severity: item.tone === "destructive" ? "broken" : "slipping",
      title: item.title,
      detail: item.detail,
    })),
    comingUp: overview.upcoming.map((item) => ({ date: isoDate(item.date), title: item.title, what: item.meta })),
  };
}

export class AiNotConfiguredError extends Error {}

export async function generateOverviewSummary(overview: Overview): Promise<OverviewSummary> {
  const ai = getAiClient();
  if (!ai) throw new AiNotConfiguredError("AI_PROVIDER_API_KEY or AI_MODEL is not set");

  const completion = await ai.client.chat.completions.create({
    model: ai.model,
    temperature: 0.3,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: JSON.stringify(snapshotFor(overview)) },
    ],
  });

  const parsed = overviewSummaryModelSchema.parse(JSON.parse(completion.choices[0]?.message.content ?? ""));
  return { ...parsed, generatedAt: new Date().toISOString() };
}
