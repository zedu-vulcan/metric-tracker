import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api";
import { handleRangeRequest } from "@/lib/seo/server/handle-request";
import { getSearchPerformance } from "@/lib/seo/server/service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  return handleRangeRequest(request, getSearchPerformance);
}
