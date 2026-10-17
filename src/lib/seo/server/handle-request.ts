import { NextResponse, type NextRequest } from "next/server";
import { seoRangeQuerySchema } from "@/lib/schemas/seo";
import type { DateRange } from "@/lib/seo/types";
import { SeoApiError } from "./errors";

/** Shared GET flow for the SEO report endpoints: validate the range, load, map errors. */
export async function handleRangeRequest<T>(
  request: NextRequest,
  load: (range: DateRange, options: { fresh: boolean }) => Promise<T>,
): Promise<NextResponse> {
  const result = seoRangeQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!result.success) {
    return NextResponse.json(
      { error: "Validation failed", details: result.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { startDate, endDate, fresh } = result.data;
  try {
    const data = await load({ startDate, endDate }, { fresh: fresh !== undefined });
    return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    const error = err instanceof SeoApiError ? err : new SeoApiError("upstream_error");
    return NextResponse.json(error.toResponse(), { status: error.status });
  }
}
