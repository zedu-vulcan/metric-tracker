import { z } from "@/lib/zod";

export const NOTIFICATION_KINDS = [
  "idea_proposed",
  "task_proposed",
  "bids_waiting",
  "escalation",
  "offer_received",
  "idea_accepted",
  "idea_rejected",
  "task_approved",
  "changes_requested",
  "comment",
  "points_earned",
] as const;

export const notificationSchema = z
  .object({
    id: z.string().openapi({ description: "Stable key for this item, e.g. `idea:<id>`; used to mark it read" }),
    kind: z.enum(NOTIFICATION_KINDS),
    title: z.string(),
    message: z.string(),
    href: z.string().openapi({ description: "Where to act on it, relative to the project, e.g. `/goals/<id>`" }),
    needsAction: z.boolean().openapi({ description: "Waiting on you: an idea, task, bids or a question on a goal you own, or an open offer to one of your agents" }),
    createdAt: z.iso.datetime(),
    read: z.boolean(),
  })
  .openapi("Notification");

export const notificationListSchema = z
  .object({
    items: z.array(notificationSchema),
    unreadCount: z.number().int().nonnegative(),
  })
  .openapi("NotificationList");

export const notificationReadSchema = z
  .object({
    ids: z
      .array(z.string().min(1).max(200))
      .max(200)
      .optional()
      .openapi({ description: "Items to mark read. Leave out to mark everything in the inbox read." }),
  })
  .openapi("NotificationReadInput");

export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];
export type Notification = z.infer<typeof notificationSchema>;
export type NotificationList = z.infer<typeof notificationListSchema>;
