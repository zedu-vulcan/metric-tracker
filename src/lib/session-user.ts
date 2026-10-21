import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/** The signed-in person's id for server components, or null when signed out. */
export async function sessionUserId() {
  const session = await getServerSession(authOptions);
  return (session?.user as { id?: string } | undefined)?.id ?? null;
}
