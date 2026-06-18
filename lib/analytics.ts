import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { dateDimension, formatChineseDate, formatDateInAnalyticsTimeZone, inRange, parseDate, previousRange, previousYearRange, resolveDateRange, weekOption } from "@/lib/date";
import { loadFactOrders, normalizeSku } from "@/lib/fact-orders";
import { niceScale } from "@/lib/nice-scale";
import { shopifyqlQuery } from "@/lib/shopify";
import type {
  AnalyticsFilters,
  AnalyticsResponse,
  AccessoryAnalysisRow,
  CachedAnalysis,
  ComparisonSummary,
  CountryRankingRow,
  CountryAnalysisRow,
  CustomerRankingRow,
  DiscountDetailRow,
  DrilldownRankingRow,
  FactOrder,
  Kpis,
  OrderDetailRow,
  RankingRow,
  RefundDetailRow,
  ShopifyqlRefundReport,
  ShopifyqlRefundRow,
  ShopifyqlSalesSummary,
  SkuAnalysisRow,
  TrendMetric,
  TrendPoint,
} from "@/types/analytics";

const aggregationCache = new Map<string, { expiresAt: number; value: AnalyticsResponse }>();

export async function getAnalytics(filters: AnalyticsFilters): Promise<AnalyticsResponse> {
  const normalized = normalizeFilters(filters);
  const cacheKey = JSON.stringify(normalized);
  const cached = aggregationCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return { ...cached.value, cached: true };

  const facts = await loadFactOrders();
  const latestDate = facts.reduce((latest, row) => row.date > latest ? row.date : latest, "");
  const range = resolveDateRange(normalized.preset, normalized.start, normalized.end, latestDate);
  const previous = previousRange(range);
  const previousYear = previousYearRange(range);
  const filtered = filterFacts(facts, normalized, range);
  const previousPeriodFacts = filterFacts(facts, normalized, previous);
  const previousYearFacts = filterFacts(facts, normalized, previousYear);
  const response = await buildAnalyticsResponse(filtered, previousPeriodFacts, previousYearFacts, facts, normalized, range, false);
  aggregationCache.set(cacheKey, { expiresAt: Date.now() + 60_000, value: response });
  return response;
}

export async function getExportRows(filters: AnalyticsFilters, table: "sku" | "country") {
  const analytics = await getAnalytics(filters);
  return table === "country" ? analytics.countryRows : analytics.skuRows;
}

function normalizeFilters(filters: AnalyticsFilters): AnalyticsFilters {
  return {
    preset: filters.preset || "week",
    start: filters.start,
    end: filters.end,
    countries: [...new Set(filters.countries || [])].sort(),
    skus: [...new Set(filters.skus || [])].sort(),
    search: filters.search?.trim() || "",
    rankOffset: Math.max(0, Number(filters.rankOffset || 0)),
    rankLimit: Math.min(100, Math.max(10, Number(filters.rankLimit || 10))),
    includeRefundReport: Boolean(filters.includeRefundReport),
  };
}

function filterFacts(facts: FactOrder[], filters: AnalyticsFilters, range: { start: string; end: string }): FactOrder[] {
  const countrySet = new Set(filters.countries);
  const skuSet = new Set(filters.skus);
  const search = filters.search?.toLowerCase() || "";
  return facts.filter((row) => {
    if (!inRange(row.date, range.start, range.end)) return false;
    if (countrySet.size && !countrySet.has(row.country)) return false;
    if (skuSet.size && !skuSet.has(row.model || row.sku)) return false;
    if (search && !`${row.model || ""} ${row.sku} ${row.productTitle} ${row.country}`.toLowerCase().includes(search)) return false;
    return true;
  });
}

async function buildAnalyticsResponse(facts: FactOrder[], previousPeriodFacts: FactOrder[], previousYearFacts: FactOrder[], allFacts: FactOrder[], filters: AnalyticsFilters, range: { start: string; end: string }, cached: boolean): Promise<AnalyticsResponse> {
  const visibleFacts = facts.filter((row) => !row.isAccessory);
  const visiblePreviousPeriodFacts = previousPeriodFacts.filter((row) => !row.isAccessory);
  const visiblePreviousYearFacts = previousYearFacts.filter((row) => !row.isAccessory);
  const visibleAllFacts = allFacts.filter((row) => !row.isAccessory);
  const fallbackRefundRows = summarizeRefunds(facts, allFacts);
  const [shopifyqlRefundReport, shopifyqlSalesSummary] = await Promise.all([
    summarizeShopifyqlRefunds(range, fallbackRefundRows),
    summarizeShopifyqlSalesSummary(range),
  ]);
  const refundRows = shopifyqlRefundReport.rows.length ? await summarizeShopifyqlRefundRows(shopifyqlRefundReport.rows, fallbackRefundRows, allFacts) : fallbackRefundRows;
  const kpis = summarizeKpis(facts, shopifyqlRefundReport.totalRefundAmount || undefined, shopifyqlSalesSummary);
  const trend = applyShopifyqlRefundsToTrend(summarizeTrend(visibleFacts), shopifyqlRefundReport.rows);
  const previousPeriodTrend = summarizeTrend(visiblePreviousPeriodFacts);
  const previousYearTrend = summarizeTrend(visiblePreviousYearFacts);
  const skuRows = summarizeSku(visibleFacts);
  const countryRows = summarizeCountry(visibleFacts);
  const recentOrders = summarizeRecentOrders(visibleFacts);
  const customerRows = summarizeCustomers(visibleFacts);
  const accessoryAnalysis = summarizeAccessoryAnalysis(visibleFacts, visibleAllFacts);
  const discountRows = summarizeDiscounts(visibleFacts);
  const comparison = summarizeComparison(kpis, summarizeKpis(previousPeriodFacts), summarizeKpis(previousYearFacts));
  const analysis = await loadOrCreateAnalysis(range, filters, kpis, comparison, trend, skuRows, countryRows);
  const rankOffset = filters.rankOffset || 0;
  const rankLimit = filters.rankLimit || 10;
  const rankings = {
    quantity: toRankingRows(skuRows, "quantity", kpis.quantity).slice(rankOffset, rankOffset + rankLimit),
    sales: toRankingRows(skuRows, "salesAmount", kpis.salesAmount).slice(rankOffset, rankOffset + rankLimit),
    refunds: toRankingRows(skuRows, "refundAmount", kpis.refundAmount).slice(rankOffset, rankOffset + rankLimit),
    countryQuantity: toCountryRankingRows(countryRows, "quantity", kpis.quantity).slice(rankOffset, rankOffset + rankLimit),
    countrySales: toCountryRankingRows(countryRows, "salesAmount", kpis.salesAmount).slice(rankOffset, rankOffset + rankLimit),
  };
  return {
    generatedAt: new Date().toISOString(),
    cached,
    filters,
    dateRange: {
      start: range.start,
      end: range.end,
      label: `${formatChineseDate(range.start)}到${formatChineseDate(range.end)}`,
    },
    kpis,
    comparison,
    trend,
    previousPeriodTrend,
    previousYearTrend,
    scales: buildScales(trend),
    rankings,
    skuRows,
    countryRows,
    recentOrders,
    customerRows,
    accessoryAnalysis,
    discountRows,
    refundRows,
    shopifyqlRefundRows: filters.includeRefundReport ? shopifyqlRefundReport.rows : [],
    shopifyqlRefundError: shopifyqlRefundReport.error,
    analysis,
    drilldowns: buildDrilldowns(facts),
    dimensions: {
      countries: buildCountryOptions(allFacts, filters, range),
      products: [...groupBy(allFacts, (row) => row.model || row.sku).entries()].map(([sku, group]) => ({ sku, productTitle: sku || group[0]?.productTitle || sku })).sort((a, b) => a.sku.localeCompare(b.sku)),
      dates: [...new Set(allFacts.map((row) => row.date))].sort().map(dateDimension),
      weeks: buildWeekOptions(allFacts),
    },
  };
}

function buildCountryOptions(allFacts: FactOrder[], filters: AnalyticsFilters, range: { start: string; end: string }) {
  const optionFacts = filterFacts(allFacts, { ...filters, countries: [] }, range).filter((row) => row.eventType === "sale");
  const sourceFacts = optionFacts.length ? optionFacts : allFacts.filter((row) => row.eventType === "sale");
  return [...groupBy(sourceFacts, (row) => row.country).entries()]
    .map(([country, group]) => ({
      country,
      orderCount: distinctCount(group, "orderId"),
      quantity: sum(group, "quantity"),
      salesAmount: sum(group, "salesAmount"),
    }))
    .sort((a, b) => b.quantity - a.quantity || b.salesAmount - a.salesAmount || a.country.localeCompare(b.country));
}

function summarizeAccessoryAnalysis(facts: FactOrder[], allFacts: FactOrder[]): AccessoryAnalysisRow[] {
  const salesFacts = facts.filter((row) => row.eventType === "sale");
  const allSalesFacts = allFacts.filter((row) => row.eventType === "sale");
  const salesByOrder = groupBy(allSalesFacts, (row) => row.orderId);
  const salesByCustomer = groupBy(allSalesFacts.filter((row) => row.customerEmail), (row) => row.customerEmail || "");
  const targets = [
    { key: "mate-se", label: "Mate SE", match: (row: FactOrder) => accessoryText(row).includes("mate se") },
    { key: "ex-pcie5", label: "BL/EX/深空灰色/PCIE5", match: (row: FactOrder) => accessoryText(row).includes("bl/ex/深空灰色/pcie5") },
  ];

  return targets.map((target) => {
    const targetFacts = salesFacts.filter(target.match);
    const targetByOrder = groupBy(targetFacts, (row) => row.orderId);
    const trackedOrders = [...targetByOrder.entries()].map(([orderId, group]) => {
      const sameOrderMachines = mergeMachineItems([
        ...summarizeMachineItems((salesByOrder.get(orderId) || []).filter((row) => !target.match(row))),
        ...extractComboMachines(group, target.match),
      ]);
      const customerEmail = group[0]?.customerEmail || "";
      const customerFacts = salesByCustomer.get(customerEmail) || [];
      const customerOtherMachines = mergeMachineItems([
        ...summarizeMachineItems(customerFacts.filter((row) => !target.match(row))),
        ...extractComboMachines(customerFacts.filter(target.match), target.match),
      ]).slice(0, 8);
      return {
        orderId,
        date: group[0]?.orderDate || group[0]?.date || "",
        country: group[0]?.country || "未知",
        customerEmail: customerEmail || "未提供",
        accessorySku: [...new Set(group.map((row) => row.model || row.sku))].join(", "),
        quantity: sum(group, "quantity"),
        salesAmount: sum(group, "salesAmount"),
        sameOrderMachines,
        customerOtherMachines,
      };
    }).sort((a, b) => b.date.localeCompare(a.date));
    const withMachineOrderCount = trackedOrders.filter((row) => row.sameOrderMachines.length > 0).length;
    const machineFacts = trackedOrders.flatMap((row) => row.sameOrderMachines.map((machine) => ({ ...machine, orderId: row.orderId })));
    return {
      key: target.key,
      label: target.label,
      quantity: sum(targetFacts, "quantity"),
      salesAmount: sum(targetFacts, "salesAmount"),
      orderCount: targetByOrder.size,
      withMachineOrderCount,
      standaloneOrderCount: Math.max(0, targetByOrder.size - withMachineOrderCount),
      attachRate: ratio(withMachineOrderCount, targetByOrder.size),
      topMachines: summarizeMachineAttach(machineFacts),
      orders: trackedOrders.slice(0, 80),
    };
  });
}

function accessoryText(row: FactOrder): string {
  return `${row.model || ""} ${row.sku || ""} ${row.productTitle || ""}`.toLowerCase();
}

function summarizeMachineItems(facts: FactOrder[]) {
  return [...groupBy(facts, (row) => row.model || row.sku).entries()]
    .map(([sku, group]) => ({
      sku,
      quantity: sum(group, "quantity"),
      salesAmount: sum(group, "salesAmount"),
    }))
    .filter((row) => isMachineSku(row.sku) && row.quantity > 0)
    .sort((a, b) => b.quantity - a.quantity || b.salesAmount - a.salesAmount || a.sku.localeCompare(b.sku));
}

function extractComboMachines(facts: FactOrder[], isTarget: (row: FactOrder) => boolean) {
  return facts.flatMap((row) => {
    const text = row.model || row.sku;
    if (!text.includes("+")) return [];
    return text.split("+")
      .map((part) => part.trim())
      .filter(Boolean)
      .filter((part) => !isTarget({ ...row, model: part, sku: part, productTitle: part }))
      .filter(isMachineSku)
      .map((sku) => ({
        sku,
        quantity: row.quantity,
        salesAmount: 0,
      }));
  });
}

function mergeMachineItems(items: Array<{ sku: string; quantity: number; salesAmount: number }>) {
  return [...groupBy(items, (row) => row.sku).entries()]
    .map(([sku, group]) => ({
      sku,
      quantity: sum(group, "quantity"),
      salesAmount: sum(group, "salesAmount"),
    }))
    .filter((row) => isMachineSku(row.sku) && row.quantity > 0)
    .sort((a, b) => b.quantity - a.quantity || b.salesAmount - a.salesAmount || a.sku.localeCompare(b.sku));
}

function isMachineSku(sku: string): boolean {
  const text = sku.toLowerCase();
  if (!sku) return false;
  if (text.includes("accessories") || text.includes("配件")) return false;
  if (text.includes("mate se")) return false;
  if (text.includes("bl/ex/深空灰色/pcie5")) return false;
  return true;
}

function summarizeMachineAttach(items: Array<{ sku: string; quantity: number; salesAmount: number; orderId: string }>) {
  return [...groupBy(items, (row) => row.sku).entries()]
    .map(([sku, group]) => ({
      sku,
      quantity: sum(group, "quantity"),
      orderCount: new Set(group.map((row) => row.orderId)).size,
      salesAmount: sum(group, "salesAmount"),
    }))
    .sort((a, b) => b.quantity - a.quantity || b.salesAmount - a.salesAmount)
    .slice(0, 10);
}

function summarizeKpis(facts: FactOrder[], overrideRefundAmount?: number, salesSummary?: ShopifyqlSalesSummary): Kpis {
  const accessorySalesFacts = facts.filter((row) => row.isAccessory && row.eventType === "sale");
  const visibleFacts = facts.filter((row) => !row.isAccessory);
  const salesFacts = visibleFacts.filter((row) => row.eventType === "sale");
  const refundFacts = visibleFacts.filter((row) => row.eventType === "refund" && row.refundAmount > 0);
  const quantity = sum(salesFacts, "quantity");
  const salesAmount = salesSummary?.salesAmount || sum(salesFacts, "salesAmount");
  const refundAmount = salesSummary?.refundAmount || overrideRefundAmount || sum(refundFacts, "refundAmount");
  const accessorySalesAmount = sum(accessorySalesFacts, "salesAmount");
  const orderCount = distinctCount(salesFacts, "orderId");
  const refundOrders = new Set(refundFacts.map((row) => row.orderId)).size;
  return {
    quantity,
    salesAmount,
    refundAmount,
    accessorySalesAmount,
    netSalesAmount: salesSummary?.netSalesAmount ?? salesAmount - refundAmount,
    orderCount,
    refundRate: ratio(refundAmount, salesAmount),
    refundOrderRate: ratio(refundOrders, orderCount),
    aov: ratio(salesAmount, orderCount),
    unitPrice: ratio(salesAmount, quantity),
    avgItemsPerOrder: ratio(quantity, orderCount),
  };
}

function applyShopifyqlRefundsToTrend(trend: TrendPoint[], rows: ShopifyqlRefundRow[]): TrendPoint[] {
  if (!rows.length) return trend;
  const returnsByDay = new Map<string, number>();
  for (const [day, group] of groupBy(rows.filter((row) => row.day), (row) => row.day).entries()) {
    returnsByDay.set(day, Math.abs(sum(group, "totalReturns")));
  }
  return trend.map((point) => {
    const refundAmount = returnsByDay.get(point.date);
    if (refundAmount == null) return point;
    return {
      ...point,
      refundAmount,
      netSalesAmount: point.salesAmount - refundAmount,
      refundRate: ratio(refundAmount, point.salesAmount),
    };
  });
}

function summarizeTrend(facts: FactOrder[]): TrendPoint[] {
  return [...groupBy(facts, (row) => row.date).entries()].map(([date, group]) => {
    const kpis = summarizeKpis(group);
    return { date, ...kpis };
  }).sort((a, b) => a.date.localeCompare(b.date));
}

function summarizeSku(facts: FactOrder[]): SkuAnalysisRow[] {
  return [...groupBy(facts, (row) => row.model || row.sku).entries()].map(([sku, group]) => {
    const kpis = summarizeKpis(group);
    return {
      sku,
      productTitle: sku,
      quantity: kpis.quantity,
      salesAmount: kpis.salesAmount,
      refundAmount: kpis.refundAmount,
      netSalesAmount: kpis.netSalesAmount,
      avgUnitPrice: kpis.unitPrice,
      orderCount: kpis.orderCount,
      avgItemsPerOrder: kpis.avgItemsPerOrder,
      refundRate: kpis.refundRate,
    };
  }).sort((a, b) => b.netSalesAmount - a.netSalesAmount);
}

function summarizeRecentOrders(facts: FactOrder[]): OrderDetailRow[] {
  return facts
    .filter((row) => row.eventType === "sale")
    .map((row) => ({
      orderId: row.orderId,
      date: row.orderDate,
      country: row.country,
      sku: row.model || row.sku,
      productTitle: row.productTitle,
      quantity: row.quantity,
      salesAmount: row.salesAmount,
      refundAmount: row.refundAmount,
      netSalesAmount: row.salesAmount - row.refundAmount,
    }))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 500);
}

function summarizeCustomers(facts: FactOrder[]): CustomerRankingRow[] {
  const salesFacts = facts.filter((row) => row.eventType === "sale");
  return [...groupBy(salesFacts, (row) => row.customerEmail || row.customerName || row.orderId).entries()].map(([, group]) => ({
    customerName: group[0]?.customerName || "未知客户",
    customerEmail: group[0]?.customerEmail || "未提供",
    country: group[0]?.country || "未知",
    orderIds: [...new Set(group.map((row) => row.orderId))],
    models: [...new Set(group.map((row) => row.model || row.sku))],
    orderCount: distinctCount(group, "orderId"),
    quantity: sum(group, "quantity"),
    salesAmount: sum(group, "salesAmount"),
  })).sort((a, b) => b.salesAmount - a.salesAmount).slice(0, 10);
}

function summarizeDiscounts(facts: FactOrder[]): DiscountDetailRow[] {
  const salesFacts = facts.filter((row) => row.eventType === "sale" && (row.discountAmount || 0) > 0);
  return [...groupBy(salesFacts, (row) => `${row.orderId}__${((row.discountCodes?.length ? row.discountCodes : ["自动折扣"])).join(",")}`).entries()].map(([, group]) => ({
    orderId: group[0]?.orderId || "",
    date: group[0]?.orderDate || group[0]?.date || "",
    country: group[0]?.country || "未知",
    code: [...new Set(group.flatMap((row) => row.discountCodes?.length ? row.discountCodes : ["自动折扣"]))].join(", "),
    models: [...new Set(group.map((row) => row.model || row.sku))],
    salesAmount: sum(group, "salesAmount"),
    discountAmount: sum(group, "discountAmount"),
    customerEmail: group[0]?.customerEmail || "未提供",
  })).sort((a, b) => b.discountAmount - a.discountAmount).slice(0, 200);
}


function summarizeRefunds(facts: FactOrder[], allFacts: FactOrder[]): RefundDetailRow[] {
  const refundFacts = facts.filter((row) => row.eventType === "refund" && row.refundAmount > 0);
  const salesFactsByOrder = groupBy(allFacts.filter((row) => row.eventType === "sale"), (row) => row.orderId);
  return [...groupBy(refundFacts, (row) => row.orderId).entries()]
    .map(([orderId, group]) => {
      const refundDates = group.map((row) => row.refundDate || row.date).filter(Boolean).sort();
      const orderLineItems = summarizeOrderLineItems(salesFactsByOrder.get(orderId) || group);
      const skus = orderLineItems.length ? orderLineItems.map((line) => line.sku) : [...new Set(group.map((row) => row.model || row.sku))];
      const reasons = [...new Set(group.map((row) => row.refundReason || "未填写"))];
      return {
        refundId: [...new Set(group.map((row) => row.refundId || `${row.orderId}-${row.refundDate || row.date}`))].join(", "),
        orderId,
        orderDate: group[0]?.orderDate || "",
        refundDate: refundDates.at(-1) || group[0]?.date || "",
        refundStatus: refundStatusText(group[0]?.refundStatus),
        country: group[0]?.country || "未知",
        sku: orderLineItems.length ? orderLineItems.map((line) => `${line.sku} x ${line.quantity}`).join(", ") : skus.join(", "),
        skus,
        lineItems: orderLineItems,
        productTitle: [...new Set(group.map((row) => row.productTitle))].join(", "),
        refundReason: reasons.join(", "),
        salesAmount: sum(group, "salesAmount"),
        refundAmount: sum(group, "refundAmount"),
        refundQuantity: sum(group, "refundLineQuantity"),
        customerEmail: group[0]?.customerEmail || "未提供",
      };
    })
    .sort((a, b) => b.refundDate.localeCompare(a.refundDate))
    .slice(0, 120);
}

function summarizeOrderLineItems(facts: FactOrder[]) {
  return [...groupBy(facts, (row) => row.model || row.sku).entries()]
    .map(([sku, group]) => ({
      sku,
      quantity: sum(group, "quantity"),
    }))
    .filter((row) => row.sku && row.quantity > 0)
    .sort((a, b) => b.quantity - a.quantity || a.sku.localeCompare(b.sku));
}

function refundStatusText(status?: string): string {
  if (status === "REFUNDED") return "已退款";
  if (status === "PARTIALLY_REFUNDED") return "部分退款";
  return status || "已退款";
}

async function summarizeShopifyqlRefunds(range: { start: string; end: string }, fallbackRows: RefundDetailRow[]): Promise<ShopifyqlRefundReport> {
  const query = `
    FROM sales
      SHOW gross_returns, discounts_returned, net_returns, shipping_returned,
        taxes_returned, return_fees, total_returns
      WHERE is_return_related = true
      GROUP BY day, sale_id, order_name, product_title_at_time_of_sale WITH TOTALS
      TIMESERIES day
      SINCE ${range.start} UNTIL ${range.end}
      ORDER BY day ASC, order_name ASC, sale_id ASC
      LIMIT 1000
    VISUALIZE total_returns TYPE table
  `;
  const response: Awaited<ReturnType<typeof shopifyqlQuery>> = await shopifyqlQuery(query).catch((error) => ({
    errors: [{ message: error instanceof Error ? error.message : "ShopifyQL request failed" }],
  }));
  const apiError = response.errors?.map((error) => error.message).join("；");
  if (apiError) return { rows: [], totalRefundAmount: 0, error: apiError };

  const report = response.data?.shopifyqlQuery;
  const parseError = report?.parseErrors?.filter(Boolean).join("；");
  if (parseError) return { rows: [], totalRefundAmount: 0, error: parseError };

  const columns = report?.tableData?.columns?.map((column) => column.name || column.displayName || "") || [];
  const rawRows = report?.tableData?.rows || [];
  const fallbackByOrder = new Map(fallbackRows.map((row) => [row.orderId, row]));

  const rows = rawRows
    .map((row) => {
      const orderName = textValue(tableValue(row, columns, "order_name"));
      const fallback = fallbackByOrder.get(orderName);
      return {
        day: dateText(tableValue(row, columns, "day")),
        saleId: textValue(tableValue(row, columns, "sale_id")),
        orderName,
        productTitleAtTimeOfSale: textValue(tableValue(row, columns, "product_title_at_time_of_sale")),
        grossReturns: numberValue(tableValue(row, columns, "gross_returns")),
        discountsReturned: numberValue(tableValue(row, columns, "discounts_returned")),
        netReturns: numberValue(tableValue(row, columns, "net_returns")),
        shippingReturned: numberValue(tableValue(row, columns, "shipping_returned")),
        taxesReturned: numberValue(tableValue(row, columns, "taxes_returned")),
        returnFees: numberValue(tableValue(row, columns, "return_fees")),
        totalReturns: numberValue(tableValue(row, columns, "total_returns")),
        country: fallback?.country || "未返回",
        refundReason: fallback?.refundReason || "ShopifyQL 未返回",
        customerEmail: fallback?.customerEmail || "未返回",
      };
    })
    .filter((row) => row.orderName || row.totalReturns);

  return { rows, totalRefundAmount: Math.abs(sum(rows, "totalReturns")) };
}

async function summarizeShopifyqlRefundRows(rows: ShopifyqlRefundRow[], fallbackRows: RefundDetailRow[], allFacts: FactOrder[]): Promise<RefundDetailRow[]> {
  const fallbackByOrder = new Map(fallbackRows.map((row) => [row.orderId, row]));
  const missingOrderIds = [...new Set(rows.map((row) => row.orderName).filter((orderName) => orderName && !fallbackByOrder.has(orderName)))];
  const directFallbacks = await fetchRefundFallbackOrders(missingOrderIds);
  for (const [orderId, row] of directFallbacks.entries()) fallbackByOrder.set(orderId, row);
  const salesFactsByOrder = groupBy(allFacts.filter((row) => row.eventType === "sale"), (row) => row.orderId);
  return [...groupBy(rows.filter((row) => row.orderName), (row) => row.orderName).entries()]
    .map(([orderId, group]) => {
      const totalReturns = Math.abs(sum(group, "totalReturns"));
      if (totalReturns <= 0) return null;
      const fallback = fallbackByOrder.get(orderId);
      const orderLineItems = summarizeOrderLineItems(salesFactsByOrder.get(orderId) || []);
      const productTitles = [...new Set(group.map((row) => row.productTitleAtTimeOfSale).filter(Boolean))];
      return {
        refundId: group.map((row) => row.saleId).filter(Boolean).join(", ") || `${orderId}-${group[0]?.day}`,
        orderId,
        orderDate: fallback?.orderDate || "",
        refundDate: group.map((row) => row.day).filter(Boolean).sort().at(-1) || fallback?.refundDate || "",
        refundStatus: fallback?.refundStatus || "已退款",
        country: fallback?.country || group.find((row) => row.country && row.country !== "未返回")?.country || "未返回",
        sku: orderLineItems.length ? orderLineItems.map((line) => `${line.sku} x ${line.quantity}`).join(", ") : fallback?.sku || productTitles.join(", "),
        skus: orderLineItems.length ? orderLineItems.map((line) => line.sku) : fallback?.skus || productTitles,
        lineItems: orderLineItems.length ? orderLineItems : fallback?.lineItems || [],
        productTitle: productTitles.join(", ") || fallback?.productTitle || "",
        refundReason: fallback?.refundReason || "ShopifyQL sales returns",
        salesAmount: fallback?.salesAmount || sum(salesFactsByOrder.get(orderId) || [], "salesAmount"),
        refundAmount: totalReturns,
        refundQuantity: fallback?.refundQuantity || sum(orderLineItems, "quantity"),
        customerEmail: fallback?.customerEmail || "未返回",
      } satisfies RefundDetailRow;
    })
    .filter((row): row is RefundDetailRow => Boolean(row))
    .sort((a, b) => b.refundDate.localeCompare(a.refundDate))
    .slice(0, 120);
}

async function fetchRefundFallbackOrders(orderIds: string[]): Promise<Map<string, RefundDetailRow>> {
  const result = new Map<string, RefundDetailRow>();
  const shop = process.env.SHOPIFY_SHOP_DOMAIN;
  const token = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
  const version = process.env.SHOPIFY_API_VERSION || "2026-07";
  if (!shop || !token || !orderIds.length) return result;

  const query = `
    query RefundFallback($q: String!) {
      orders(first: 1, query: $q) {
        edges {
          node {
            name
            createdAt
            displayFinancialStatus
            totalRefundedSet { shopMoney { amount currencyCode } }
            shippingAddress { countryCodeV2 country }
            customer { email displayName }
            email
            lineItems(first: 50) {
              edges {
                node {
                  sku
                  title
                  quantity
                  discountedTotalSet { shopMoney { amount currencyCode } }
                }
              }
            }
            refunds(first: 20) {
              id
              createdAt
              note
              totalRefundedSet { shopMoney { amount currencyCode } }
            }
          }
        }
      }
    }
  `;

  for (const orderId of orderIds.slice(0, 50)) {
    try {
      const response = await fetch(`https://${shop}/admin/api/${version}/graphql.json`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": token,
        },
        body: JSON.stringify({ query, variables: { q: `name:${orderId}` } }),
        cache: "no-store",
      });
      if (!response.ok) continue;
      const json = await response.json() as {
        data?: {
          orders?: {
            edges?: Array<{
              node?: {
                name?: string;
                createdAt?: string;
                displayFinancialStatus?: string;
                shippingAddress?: { countryCodeV2?: string; country?: string };
                customer?: { email?: string; displayName?: string };
                email?: string;
                lineItems?: { edges?: Array<{ node?: { sku?: string; title?: string; quantity?: number; discountedTotalSet?: { shopMoney?: { amount?: string } } } }> };
                refunds?: Array<{ id?: string; createdAt?: string; note?: string; totalRefundedSet?: { shopMoney?: { amount?: string } } }>;
              };
            }>;
          };
        };
      };
      const order = json.data?.orders?.edges?.[0]?.node;
      if (!order?.name) continue;
      const lineItems = (order.lineItems?.edges || [])
        .map((edge) => edge.node)
        .filter((node): node is { sku?: string; title?: string; quantity?: number; discountedTotalSet?: { shopMoney?: { amount?: string } } } => Boolean(node));
      const refunds = order.refunds || [];
      const refundDates = refunds.map((refund) => refund.createdAt ? formatDateInAnalyticsTimeZone(new Date(refund.createdAt)) : "").filter(Boolean).sort();
      const lineRows = lineItems.map((item) => ({
        sku: normalizeSku(item.sku || item.title || "UNKNOWN"),
        quantity: Number(item.quantity || 0),
      })).filter((item) => item.sku && item.quantity > 0);
      const productTitles = [...new Set(lineItems.map((item) => item.title || item.sku || "").filter(Boolean))];
      result.set(order.name, {
        refundId: refunds.map((refund) => refund.id).filter(Boolean).join(", ") || order.name,
        orderId: order.name,
        orderDate: order.createdAt ? formatDateInAnalyticsTimeZone(new Date(order.createdAt)) : "",
        refundDate: refundDates.at(-1) || "",
        refundStatus: refundStatusText(order.displayFinancialStatus),
        country: countryNameFromCode(order.shippingAddress?.countryCodeV2, order.shippingAddress?.country),
        sku: lineRows.map((line) => `${line.sku} x ${line.quantity}`).join(", "),
        skus: lineRows.map((line) => line.sku),
        lineItems: lineRows,
        productTitle: productTitles.join(", "),
        refundReason: [...new Set(refunds.map((refund) => refund.note || "未填写"))].join(", "),
        salesAmount: sum(lineItems.map((item) => ({ amount: numberValue(item.discountedTotalSet?.shopMoney?.amount) })), "amount"),
        refundAmount: sum(refunds.map((refund) => ({ amount: numberValue(refund.totalRefundedSet?.shopMoney?.amount) })), "amount"),
        refundQuantity: sum(lineRows, "quantity"),
        customerEmail: order.customer?.email || order.email || "未提供",
      });
    } catch {
      continue;
    }
  }

  return result;
}

function countryNameFromCode(code?: string, fallback?: string): string {
  if (!code) return fallback || "未知";
  try {
    return new Intl.DisplayNames(["zh-CN"], { type: "region" }).of(code) || fallback || code;
  } catch {
    return fallback || code;
  }
}

async function summarizeShopifyqlSalesSummary(range: { start: string; end: string }): Promise<ShopifyqlSalesSummary | undefined> {
  const query = `
    FROM sales
      SHOW gross_sales, discounts, returns, net_sales, total_sales
      SINCE ${range.start} UNTIL ${range.end}
  `;
  const response: Awaited<ReturnType<typeof shopifyqlQuery>> = await shopifyqlQuery(query).catch((error) => ({
    errors: [{ message: error instanceof Error ? error.message : "ShopifyQL request failed" }],
  }));
  const apiError = response.errors?.map((error) => error.message).join("；");
  if (apiError) return { grossSalesAmount: 0, discountAmount: 0, salesAmount: 0, refundAmount: 0, netSalesAmount: 0, totalSalesAmount: 0, error: apiError };

  const report = response.data?.shopifyqlQuery;
  const parseError = report?.parseErrors?.filter(Boolean).join("；");
  if (parseError) return { grossSalesAmount: 0, discountAmount: 0, salesAmount: 0, refundAmount: 0, netSalesAmount: 0, totalSalesAmount: 0, error: parseError };

  const columns = report?.tableData?.columns?.map((column) => column.name || column.displayName || "") || [];
  const row = report?.tableData?.rows?.[0];
  if (!row) return undefined;

  const grossSalesAmount = numberValue(tableValue(row, columns, "gross_sales"));
  const discountAmount = Math.abs(numberValue(tableValue(row, columns, "discounts")));
  const refundAmount = Math.abs(numberValue(tableValue(row, columns, "returns")));
  const netSalesAmount = numberValue(tableValue(row, columns, "net_sales"));
  const totalSalesAmount = numberValue(tableValue(row, columns, "total_sales"));
  return {
    grossSalesAmount,
    discountAmount,
    salesAmount: grossSalesAmount - discountAmount,
    refundAmount,
    netSalesAmount,
    totalSalesAmount,
  };
}

function tableValue(row: unknown, columns: string[], key: string): unknown {
  if (Array.isArray(row)) {
    const index = columns.findIndex((column) => column === key);
    return index >= 0 ? row[index] : undefined;
  }
  if (row && typeof row === "object") {
    return (row as Record<string, unknown>)[key];
  }
  return undefined;
}

function textValue(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "object" && "value" in value) return textValue((value as { value?: unknown }).value);
  return String(value);
}

function dateText(value: unknown): string {
  const text = textValue(value);
  return text.includes("T") ? text.slice(0, 10) : text;
}

function numberValue(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === "object" && "value" in value) return numberValue((value as { value?: unknown }).value);
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value).replace(/[^0-9.-]+/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function summarizeCountry(facts: FactOrder[]): CountryAnalysisRow[] {
  return [...groupBy(facts, (row) => row.country).entries()].map(([country, group]) => {
    const kpis = summarizeKpis(group);
    return {
      country,
      quantity: kpis.quantity,
      salesAmount: kpis.salesAmount,
      refundAmount: kpis.refundAmount,
      netSalesAmount: kpis.netSalesAmount,
      orderCount: kpis.orderCount,
      refundRate: kpis.refundRate,
    };
  }).sort((a, b) => b.netSalesAmount - a.netSalesAmount);
}

function toRankingRows(rows: SkuAnalysisRow[], key: "quantity" | "salesAmount" | "refundAmount", total: number): RankingRow[] {
  return rows.map((row) => ({
    sku: row.sku,
    productTitle: row.productTitle,
    quantity: row.quantity,
    salesAmount: row.salesAmount,
    refundAmount: row.refundAmount,
    share: ratio(Number(row[key]), total),
    refundRate: row.refundRate,
  })).sort((a, b) => Number(b[key]) - Number(a[key]));
}

function toCountryRankingRows(rows: CountryAnalysisRow[], key: "quantity" | "salesAmount", total: number): CountryRankingRow[] {
  return rows.map((row) => ({
    country: row.country,
    quantity: row.quantity,
    salesAmount: row.salesAmount,
    refundAmount: row.refundAmount,
    netSalesAmount: row.netSalesAmount,
    orderCount: row.orderCount,
    share: ratio(Number(row[key]), total),
    refundRate: row.refundRate,
  })).sort((a, b) => Number(b[key]) - Number(a[key]));
}

function buildDrilldowns(facts: FactOrder[]): AnalyticsResponse["drilldowns"] {
  const countryModels: Record<string, DrilldownRankingRow[]> = {};
  for (const [country, group] of groupBy(facts, (row) => row.country).entries()) {
    const totalSales = sum(group, "salesAmount");
    countryModels[country] = toDrilldownRows(group, (row) => row.model || row.sku, totalSales, "salesAmount");
  }

  const modelCountries: Record<string, DrilldownRankingRow[]> = {};
  for (const [model, group] of groupBy(facts, (row) => row.model || row.sku).entries()) {
    const totalSales = sum(group, "salesAmount");
    modelCountries[model] = toDrilldownRows(group, (row) => row.country, totalSales, "salesAmount");
  }

  return { countryModels, modelCountries };
}

function toDrilldownRows(facts: FactOrder[], key: (row: FactOrder) => string, total: number, sortKey: "quantity" | "salesAmount"): DrilldownRankingRow[] {
  const salesFacts = facts.filter((row) => row.eventType === "sale");
  return [...groupBy(salesFacts, key).entries()].map(([value, group]) => {
    const quantity = sum(group, "quantity");
    const salesAmount = sum(group, "salesAmount");
    const orderCount = distinctCount(group, "orderId");
    return {
      key: value,
      label: value,
      quantity,
      salesAmount,
      orderCount,
      share: ratio(salesAmount, total),
    };
  }).sort((a, b) => Number(b[sortKey]) - Number(a[sortKey]));
}

function summarizeComparison(current: Kpis, previousPeriod: Kpis, previousYear: Kpis): ComparisonSummary {
  return {
    current,
    previousPeriod,
    previousYear,
    mom: growthMap(current, previousPeriod),
    yoy: growthMap(current, previousYear),
  };
}

function growthMap(current: Kpis, previous: Kpis): Partial<Record<keyof Kpis, number>> {
  const keys: Array<keyof Kpis> = ["quantity", "salesAmount", "refundAmount", "netSalesAmount", "orderCount", "aov", "unitPrice", "avgItemsPerOrder", "refundRate", "refundOrderRate"];
  return Object.fromEntries(keys.map((key) => [key, ratio(current[key] - previous[key], previous[key])])) as Partial<Record<keyof Kpis, number>>;
}

async function loadOrCreateAnalysis(range: { start: string; end: string }, filters: AnalyticsFilters, kpis: Kpis, comparison: ComparisonSummary, trend: TrendPoint[], skuRows: SkuAnalysisRow[], countryRows: CountryAnalysisRow[]): Promise<CachedAnalysis> {
  const key = [
    range.start,
    range.end,
    filters.countries.join("_") || "all-countries",
    filters.skus.join("_") || "all-models",
  ].join("__").replace(/[^a-zA-Z0-9._-]+/g, "-");
  const dir = process.env.VERCEL ? path.join("/tmp", "analytics-analysis") : path.join(process.cwd(), "outputs", "analytics-analysis");
  const filePath = path.join(dir, `${key}.md`);
  const signature = analysisSignature(kpis, trend);
  try {
    const content = await readFile(filePath, "utf8");
    if (content.includes(`数据签名：${signature}`)) return { path: filePath, content, cached: true };
  } catch {
  }
  await mkdir(dir, { recursive: true });
  const content = buildAnalysisMarkdown(range, filters, kpis, comparison, trend, skuRows, countryRows, signature);
  await writeFile(filePath, content, "utf8");
  return { path: filePath, content, cached: false };
}

function buildAnalysisMarkdown(range: { start: string; end: string }, filters: AnalyticsFilters, kpis: Kpis, comparison: ComparisonSummary, trend: TrendPoint[], skuRows: SkuAnalysisRow[], countryRows: CountryAnalysisRow[], signature: string): string {
  const bestSku = skuRows[0];
  const bestCountry = countryRows[0];
  const trendDirection = (comparison.mom.salesAmount || 0) >= 0 ? "上升" : "下降";
  const quantityDirection = (comparison.mom.quantity || 0) >= 0 ? "上升" : "下降";
  const refundPressure = kpis.refundRate > 0.08 ? "退款率偏高，对净销售额形成明显压力。" : "退款率处于可控区间，对净销售额影响有限。";
  const dailySales = trend.map((row) => row.salesAmount);
  const volatility = dailySales.length > 1 ? Math.max(...dailySales) - Math.min(...dailySales) : 0;
  return [
    `# Shopify 销售分析 ${range.start} 至 ${range.end}`,
    "",
    `筛选国家：${filters.countries.join(", ") || "全部"}`,
    `筛选型号：${filters.skus.join(", ") || "全部"}`,
    `数据签名：${signature}`,
    "",
    "## 核心结论",
    `- GMV：${moneyText(kpis.salesAmount)}，环比${percentText(comparison.mom.salesAmount)}，同比${percentText(comparison.yoy.salesAmount)}。`,
    `- 销量：${numberText(kpis.quantity)}，环比${percentText(comparison.mom.quantity)}，同比${percentText(comparison.yoy.quantity)}。`,
    `- 净销售额：${moneyText(kpis.netSalesAmount)}，退款额：${moneyText(kpis.refundAmount)}，退款率：${percentText(kpis.refundRate)}。`,
    "",
    "## 可能原因",
    `- 销售额环比${trendDirection}，主要由销量环比${quantityDirection}驱动；若客单价同时变化，则说明产品组合或高低价型号占比发生变化。`,
    bestSku ? `- 型号贡献最高的是 ${bestSku.sku}，销售额 ${moneyText(bestSku.salesAmount)}，销量 ${numberText(bestSku.quantity)}。` : "- 当前时间段没有可用型号销售数据。",
    bestCountry ? `- 国家贡献最高的是 ${bestCountry.country}，销售额 ${moneyText(bestCountry.salesAmount)}，订单数 ${numberText(bestCountry.orderCount)}。` : "- 当前时间段没有可用国家销售数据。",
    `- ${refundPressure}`,
    volatility > 0 ? `- 时间段内日销售波动约 ${moneyText(volatility)}，建议结合投放、促销、库存和物流节点排查峰谷原因。` : "- 当前时间段销售波动较小或数据点不足。",
    "",
    "## 后续调研建议",
    "- 对环比下降的型号拆分国家，查看是否集中在单一市场。",
    "- 对退款率高的型号查看退款理由、退款时间和对应订单国家。",
    "- 若同比增长但环比下降，优先判断是否为季节性回落；若同比和环比同时下降，优先检查流量、价格、库存和物流时效。",
    "",
  ].join("\n");
}

function analysisSignature(kpis: Kpis, trend: TrendPoint[]): string {
  return [
    Math.round(kpis.salesAmount * 100),
    Math.round(kpis.refundAmount * 100),
    kpis.quantity,
    kpis.orderCount,
    trend.length,
    trend.at(-1)?.date || "none",
  ].join("-");
}

function buildScales(trend: TrendPoint[]): Record<TrendMetric, ReturnType<typeof niceScale>> {
  return {
    quantity: niceScale(Math.max(...trend.map((row) => row.quantity), 0)),
    money: niceScale(Math.max(...trend.flatMap((row) => [row.salesAmount, row.refundAmount]), 0)),
    unitPrice: niceScale(Math.max(...trend.map((row) => row.unitPrice), 0)),
    avgItemsPerOrder: niceScale(Math.max(...trend.map((row) => row.avgItemsPerOrder), 0)),
  };
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const value = key(item) || "Unknown";
    const group = map.get(value) || [];
    group.push(item);
    map.set(value, group);
  }
  return map;
}

function sum<T extends Record<string, unknown>>(items: T[], key: keyof T): number {
  return items.reduce((total, item) => total + Number(item[key] || 0), 0);
}

function distinctCount<T extends Record<string, unknown>>(items: T[], key: keyof T): number {
  return new Set(items.map((item) => String(item[key] || ""))).size;
}

function ratio(a: number, b: number): number {
  return b ? a / b : 0;
}

function buildWeekOptions(facts: FactOrder[]) {
  const minDate = facts.reduce((min, row) => row.date && row.date < min ? row.date : min, "2025-01-01");
  const maxDate = facts.reduce((max, row) => row.date > max ? row.date : max, "");
  const start = parseDate(minDate < "2025-01-01" ? "2025-01-01" : minDate) || new Date(2025, 0, 1);
  const end = parseDate(maxDate) || new Date();
  start.setDate(start.getDate() - ((start.getDay() + 3) % 7));
  const weeks = [];
  for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 7)) {
    const weekStart = new Date(cursor);
    const weekEnd = new Date(cursor);
    weekEnd.setDate(weekStart.getDate() + 6);
    weeks.push(weekOption(formatLocalDate(weekStart), formatLocalDate(weekEnd)));
  }
  return weeks.reverse();
}

function formatLocalDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function moneyText(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0);
}

function numberText(value: number): string {
  return new Intl.NumberFormat("zh-CN").format(value || 0);
}

function percentText(value: number | undefined): string {
  return new Intl.NumberFormat("zh-CN", { style: "percent", maximumFractionDigits: 2 }).format(value || 0);
}
