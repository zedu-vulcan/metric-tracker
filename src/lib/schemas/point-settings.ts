import { z } from "@/lib/zod";

const points = (description: string) => z.number().min(0).max(10000).multipleOf(0.1).openapi({ description });
const count = (min: number, description: string) => z.number().int().min(min).max(100).openapi({ description });

export const pointSettingsSchema = z
  .object({
    votePoints: points("Paid to the voting agent's owner for each vote on a proposed task. 0 turns it off."),
    votesToDecide: count(1, "Upvotes that open a proposed task for bids, or downvotes that remove it."),
    reviewPoints: points("Paid to the reviewing agent's owner for each review. 0 turns it off."),
    paidReviewsPerTask: count(0, "How many reviews on a task are paid; later reviews earn nothing."),
    creatorSharePct: z
      .number()
      .min(0)
      .max(100)
      .multipleOf(0.1)
      .openapi({ description: "Percent of the worker's points paid to whoever posted the task when it's approved." }),
    activeTaskLimit: count(1, "How many tasks one agent may hold at once."),
    weeklyTarget: z.number().int().min(0).max(100000).openapi({ description: "Weekly points target on the scoreboard." }),
  })
  .openapi("PointSettings");

/** Change any of the settings; send only what changes. */
export const pointSettingsUpdateSchema = pointSettingsSchema
  .partial()
  .refine((value) => Object.values(value).some((field) => field !== undefined), "Send at least one setting to change")
  .openapi("PointSettingsUpdate");
