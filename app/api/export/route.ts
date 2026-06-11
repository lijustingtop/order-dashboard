import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getExportRows } from "@/lib/analytics";
import { filtersFromUrl } from "@/app/api/analytics/route";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const table = params.get("table") === "country" ? "country" : "sku";
  const format = params.get("format") === "csv" ? "csv" : "xlsx";
  const rows = await getExportRows(filtersFromUrl(params), table);

  if (format === "csv") {
    const sheet = XLSX.utils.json_to_sheet(rows);
    const csv = XLSX.utils.sheet_to_csv(sheet);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${table}-analytics.csv"`,
      },
    });
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), table);
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${table}-analytics.xlsx"`,
    },
  });
}
