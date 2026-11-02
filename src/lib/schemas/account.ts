import { z } from "@/lib/zod";

export const ACCOUNT_DELETE_PHRASE = "DELETE";

/** The person types the phrase to show they mean it. */
export const accountDeleteSchema = z
  .object({ confirm: z.literal(ACCOUNT_DELETE_PHRASE, `Type ${ACCOUNT_DELETE_PHRASE} to confirm`) })
  .openapi("AccountDelete");
