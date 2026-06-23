import { NextRequest, NextResponse } from "next/server";
import { getAnalytics } from "@/lib/analytics";
import type { AnalyticsFilters, DatePreset } from "@/types/analytics";

export async function GET(request: NextRequest) {
  const filters = filtersFromUrl(request.nextUrl.searchParams);
  const payload = await getAnalytics(filters);
  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "s-maxage=60, stale-while-revalidate=300",
    },
  });
}

export function filtersFromUrl(params: URLSearchParams): AnalyticsFilters {
  return {
    preset: (params.get("preset") || "last7") as DatePreset,
    start: params.get("start") || undefined,
    end: params.get("end") || undefined,
    countries: params.getAll("country"),
    skus: params.getAll("sku"),
    search: params.get("search") || "",
    rankOffset: Number(params.get("rankOffset") || 0),
    rankLimit: Number(params.get("rankLimit") || 10),
    includeRefundReport: params.get("refundReport") === "1",
  };
}
