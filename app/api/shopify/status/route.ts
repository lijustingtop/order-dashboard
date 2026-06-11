import { NextResponse } from "next/server";
import { currentBulkOperation } from "@/lib/shopify";

export async function GET() {
  const payload = await currentBulkOperation();
  const status = payload.errors?.length ? 501 : 200;
  return NextResponse.json(payload, { status });
}
