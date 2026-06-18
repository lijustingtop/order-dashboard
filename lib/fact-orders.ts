import { formatDateInAnalyticsTimeZone } from "@/lib/date";
import { currentBulkOperation, startOrdersBulkOperation } from "@/lib/shopify";
import type { FactOrder } from "@/types/analytics";

type ShopifyOrderNode = {
  id: string;
  name?: string;
  createdAt?: string;
  displayFinancialStatus?: string;
  email?: string;
  currencyCode?: string;
  subtotalLineItemsQuantity?: number;
  totalDiscountsSet?: {
    shopMoney?: {
      amount?: string;
      currencyCode?: string;
    };
  };
  discountApplications?: {
    edges?: Array<{
      node?: {
        __typename?: string;
        code?: string;
        value?: {
          __typename?: string;
          amount?: string;
          currencyCode?: string;
          percentage?: number;
        };
      };
    }>;
    nodes?: Array<{
      __typename?: string;
      code?: string;
    }>;
  };
  shippingAddress?: { countryCodeV2?: string } | null;
  customer?: {
    displayName?: string;
    email?: string;
  } | null;
  refunds?: ShopifyRefundNode[];
};

type ShopifyLineItemNode = {
  __parentId?: string;
  sku?: string;
  title?: string;
  quantity?: number;
  discountedTotalSet?: {
    shopMoney?: {
      amount?: string;
      currencyCode?: string;
    };
  };
};

type ShopifyRefundNode = {
  __parentId?: string;
  id?: string;
  createdAt?: string;
  note?: string;
  totalRefundedSet?: {
    shopMoney?: {
      amount?: string;
      currencyCode?: string;
    };
  };
  refundLineItems?: {
    edges?: Array<{
      node?: ShopifyRefundLineItemNode;
    }>;
  };
};

type ShopifyRefundLineItemNode = {
  quantity?: number;
  subtotalSet?: {
    shopMoney?: {
      amount?: string;
      currencyCode?: string;
    };
  };
  totalTaxSet?: {
    shopMoney?: {
      amount?: string;
      currencyCode?: string;
    };
  };
  lineItem?: {
    sku?: string;
    title?: string;
    discountedTotalSet?: {
      shopMoney?: {
        amount?: string;
        currencyCode?: string;
      };
    };
  };
};

let factCache: { loadedAt: number; rows: FactOrder[] } | null = null;

export async function loadFactOrders(): Promise<FactOrder[]> {
  if (factCache?.rows.length && Date.now() - factCache.loadedAt < 10 * 60_000) return factCache.rows;

  const operation = await currentBulkOperation();
  const bulk = operation.data?.currentBulkOperation;
  if (!bulk?.url) {
    if (!bulk || ["FAILED", "CANCELED", "EXPIRED"].includes(bulk.status)) {
      await startOrdersBulkOperation();
    }
    return factCache?.rows || [];
  }

  const rows = await loadFactsFromBulkUrl(bulk.url);
  factCache = { loadedAt: Date.now(), rows };
  return rows;
}

async function loadFactsFromBulkUrl(url: string): Promise<FactOrder[]> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok || !response.body) return [];

  const orders = new Map<string, ShopifyOrderNode>();
  const lineItems = new Map<string, ShopifyLineItemNode[]>();
  const refunds = new Map<string, ShopifyRefundNode[]>();

  await readJsonLines(response.body, (node) => {
    if (isOrderNode(node)) {
      orders.set(node.id, node);
      if (Array.isArray(node.refunds) && node.refunds.length) refunds.set(node.id, node.refunds);
      return;
    }
    if (isLineItemNode(node)) {
      const parentId = node.__parentId;
      if (!parentId) return;
      const group = lineItems.get(parentId) || [];
      group.push(node);
      lineItems.set(parentId, group);
      return;
    }
    if (isRefundNode(node)) {
      const parentId = node.__parentId;
      if (!parentId) return;
      const group = refunds.get(parentId) || [];
      group.push(node);
      refunds.set(parentId, group);
    }
  });

  const facts: FactOrder[] = [];
  for (const order of orders.values()) {
    const allItems = lineItems.get(order.id) || [];
    const items = allItems.filter((item) => !isAccessory(item));
    if (!allItems.length) continue;
    const orderSales = allItems.reduce((total, item) => total + moneyAmount(item.discountedTotalSet?.shopMoney?.amount), 0);
    const orderDiscount = moneyAmount(order.totalDiscountsSet?.shopMoney?.amount);
    const discountCodes = discountCodesFromOrder(order);
    const orderDate = order.createdAt ? formatDateInAnalyticsTimeZone(new Date(order.createdAt)) : "";
    const customerName = order.customer?.displayName || order.name || "未知客户";
    const customerEmail = order.customer?.email || order.email || "";
    const country = countryName(order.shippingAddress?.countryCodeV2);
    for (const item of allItems) {
      const accessory = isAccessory(item);
      const lineAmount = moneyAmount(item.discountedTotalSet?.shopMoney?.amount);
      const cleanedSku = normalizeSku(item.sku || item.title || "UNKNOWN");
      const productTitle = normalizeProductTitle(item.title || cleanedSku);
      if (cleanedSku === "UNKNOWN" && productTitle === "UNKNOWN") continue;
      const salesShare = orderSales > 0 ? lineAmount / orderSales : 1 / items.length;
      const discountAmount = orderDiscount * salesShare;
      const salesAmount = Math.max(0, lineAmount - discountAmount);
      facts.push({
        orderId: order.name || order.id,
        date: orderDate,
        orderDate,
        eventType: "sale",
        country,
        sku: cleanedSku,
        productTitle,
        quantity: Number(item.quantity || 0),
        salesAmount,
        refundAmount: 0,
        accessorySalesAmount: accessory ? salesAmount : 0,
        discountAmount,
        discountCodes,
        currency: item.discountedTotalSet?.shopMoney?.currencyCode || order.currencyCode || "USD",
        customerName,
        customerEmail,
        model: modelFromSku(cleanedSku, productTitle),
        isAccessory: accessory,
      });
    }

    const refundableStatus = order.displayFinancialStatus === "REFUNDED" || order.displayFinancialStatus === "PARTIALLY_REFUNDED";
    for (const refund of refunds.get(order.id) || []) {
      const refundAmount = moneyAmount(refund.totalRefundedSet?.shopMoney?.amount);
      if (!refundableStatus && refundAmount <= 0) continue;
      const refundDate = refund.createdAt;
      const formattedRefundDate = refundDate ? formatDateInAnalyticsTimeZone(new Date(refundDate)) : "";
      const refundLineItems = refund.refundLineItems?.edges?.map((edge) => edge.node).filter((node): node is ShopifyRefundLineItemNode => Boolean(node)) || [];
      const usableRefundLineItems = refundLineItems.filter((line) => !isAccessory({ sku: line.lineItem?.sku, title: line.lineItem?.title }));

      if (usableRefundLineItems.length) {
        const lineSubtotal = usableRefundLineItems.reduce((total, line) => total + moneyAmount(line.subtotalSet?.shopMoney?.amount), 0);
        for (const line of usableRefundLineItems) {
          const cleanedSku = normalizeSku(line.lineItem?.sku || line.lineItem?.title || "UNKNOWN");
          const productTitle = normalizeProductTitle(line.lineItem?.title || cleanedSku);
          if (cleanedSku === "UNKNOWN" && productTitle === "UNKNOWN") continue;
          const lineRefundAmount = moneyAmount(line.subtotalSet?.shopMoney?.amount) + moneyAmount(line.totalTaxSet?.shopMoney?.amount);
          const refundShare = lineSubtotal > 0 ? moneyAmount(line.subtotalSet?.shopMoney?.amount) / lineSubtotal : 1 / usableRefundLineItems.length;
          const lineSalesAmount = moneyAmount(line.lineItem?.discountedTotalSet?.shopMoney?.amount);
          const lineSalesShare = orderSales > 0 ? lineSalesAmount / orderSales : refundShare;
          const salesAmount = Math.max(0, lineSalesAmount - orderDiscount * lineSalesShare);
          facts.push({
            orderId: order.name || order.id,
            date: formattedRefundDate || orderDate,
            orderDate,
            eventType: "refund",
            country,
            sku: cleanedSku,
            productTitle,
            quantity: 0,
            salesAmount,
            refundAmount: lineRefundAmount || refundAmount * refundShare,
            refundDate: formattedRefundDate,
            refundId: refund.id || `${order.id}-${formattedRefundDate}`,
            refundStatus: order.displayFinancialStatus,
            refundLineQuantity: Number(line.quantity || 0),
            currency: line.subtotalSet?.shopMoney?.currencyCode || order.currencyCode || "USD",
            customerName,
            customerEmail,
            model: modelFromSku(cleanedSku, productTitle),
            refundReason: refund.note || "未填写",
          });
        }
        continue;
      }

      for (const item of items) {
        const lineAmount = moneyAmount(item.discountedTotalSet?.shopMoney?.amount);
        const cleanedSku = normalizeSku(item.sku || item.title || "UNKNOWN");
        const productTitle = normalizeProductTitle(item.title || cleanedSku);
        if (cleanedSku === "UNKNOWN" && productTitle === "UNKNOWN") continue;
        const refundShare = orderSales > 0 ? lineAmount / orderSales : 1 / items.length;
        const salesAmount = Math.max(0, lineAmount - orderDiscount * refundShare);
        facts.push({
          orderId: order.name || order.id,
          date: formattedRefundDate || orderDate,
          orderDate,
          eventType: "refund",
          country,
          sku: cleanedSku,
          productTitle,
          quantity: 0,
          salesAmount,
          refundAmount: refundAmount * refundShare,
          refundDate: formattedRefundDate,
          refundId: refund.id || `${order.id}-${formattedRefundDate}`,
          refundStatus: order.displayFinancialStatus,
          refundLineQuantity: Number(item.quantity || 0),
          currency: item.discountedTotalSet?.shopMoney?.currencyCode || order.currencyCode || "USD",
          customerName,
          customerEmail,
          model: modelFromSku(cleanedSku, productTitle),
          refundReason: refund.note || "未填写",
        });
      }
    }
  }

  return facts.filter((row) => row.date && (row.quantity > 0 || row.refundAmount > 0));
}

async function readJsonLines(stream: ReadableStream<Uint8Array>, onLine: (node: Record<string, unknown>) => void) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) parseLine(line, onLine);
  }
  buffer += decoder.decode();
  parseLine(buffer, onLine);
}

function parseLine(line: string, onLine: (node: Record<string, unknown>) => void) {
  const text = line.trim();
  if (!text) return;
  try {
    onLine(JSON.parse(text) as Record<string, unknown>);
  } catch {
    // Shopify bulk JSONL should be one JSON object per line; skip malformed partials.
  }
}

function isOrderNode(node: Record<string, unknown>): node is ShopifyOrderNode {
  return typeof node.id === "string" && typeof node.createdAt === "string" && !node.__parentId;
}

function isLineItemNode(node: Record<string, unknown>): node is ShopifyLineItemNode {
  return typeof node.__parentId === "string" && ("sku" in node || "title" in node || "quantity" in node);
}

function isRefundNode(node: Record<string, unknown>): node is ShopifyRefundNode {
  return typeof node.__parentId === "string" && "totalRefundedSet" in node;
}

function moneyAmount(value?: string): number {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount : 0;
}

function countryName(countryCode?: string): string {
  if (!countryCode) return "未知";
  try {
    return new Intl.DisplayNames(["zh-CN"], { type: "region" }).of(countryCode) || countryCode;
  } catch {
    return countryCode;
  }
}

function isAccessory(item: ShopifyLineItemNode): boolean {
  return `${item.sku || ""} ${item.title || ""}`.toLowerCase().includes("accessories");
}

function discountCodesFromOrder(order: ShopifyOrderNode): string[] {
  const edges = order.discountApplications?.edges || [];
  const edgeCodes = edges
    .map((edge) => edge.node?.code)
    .filter((code): code is string => Boolean(code));
  const nodeCodes = (order.discountApplications?.nodes || [])
    .map((node) => node.code)
    .filter((code): code is string => Boolean(code));
  return [...new Set([...edgeCodes, ...nodeCodes])].filter(Boolean);
}

export function normalizeSku(value: string): string {
  const cleaned = String(value || "UNKNOWN")
    .replace(/\b(?:US|USA|EU|UK|AU|JP)\s*(?:plug|adapter|version)?\b/gi, " ")
    .replace(/[_-](?:US|USA|EU|UK|AU|JP|U|H|E|A)\b/gi, "")
    .replace(/(?:美规|欧规|英规|澳规|日规|美国规格|欧洲规格|英国规格|澳洲规格|日本规格|美标|欧标|英标|澳标|日标)/gi, " ")
    .replace(/[\s_+/-]+$/g, "")
    .replace(/^[\s_+/-]+/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/([/_+-]){2,}/g, "$1")
    .trim();
  return cleaned || "UNKNOWN";
}

function normalizeProductTitle(value: string): string {
  return normalizeSku(value).replace(/\s{2,}/g, " ").trim();
}

function modelFromSku(sku: string, title: string): string {
  const text = sku && sku.toLowerCase() !== "accessories" ? sku : title;
  return normalizeSku(text).replace(/^Beelink\s+/i, "").trim() || "UNKNOWN";
}
