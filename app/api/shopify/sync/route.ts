import { NextResponse } from "next/server";
import { startOrdersBulkOperation } from "@/lib/shopify";

export async function POST() {
  const payload = await startOrdersBulkOperation();
  const status = payload.errors?.length ? 501 : 200;
  return NextResponse.json(payload, { status });
}
