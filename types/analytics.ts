export type ChartMode = "line" | "area" | "bar";
export type TrendMetric = "quantity" | "money" | "unitPrice" | "avgItemsPerOrder";
export type DatePreset = "today" | "last7" | "last30" | "lastMonth" | "year" | "all" | "custom";

export type FactOrder = {
  orderId: string;
  date: string;
  orderDate: string;
  eventType: "sale" | "refund";
  country: string;
  sku: string;
  productTitle: string;
  isAccessory?: boolean;
  quantity: number;
  salesAmount: number;
  refundAmount: number;
  accessorySalesAmount?: number;
  refundDate?: string;
  refundId?: string;
  refundStatus?: "REFUNDED" | "PARTIALLY_REFUNDED" | string;
  refundLineQuantity?: number;
  discountAmount?: number;
  discountCodes?: string[];
  currency: string;
  customerName?: string;
  customerEmail?: string;
  model?: string;
  warehouse?: string;
  carrier?: string;
  fulfillmentHours?: number;
  refundReason?: string;
};

export type DimCountry = {
  country: string;
  orderCount: number;
  quantity?: number;
  salesAmount?: number;
};

export type DimProduct = {
  sku: string;
  productTitle: string;
  launchDate?: string;
};

export type DimDate = {
  date: string;
  year: number;
  month: string;
  week: string;
};

export type WeekOption = {
  key: string;
  start: string;
  end: string;
  label: string;
};

export type AnalyticsFilters = {
  preset: DatePreset;
  start?: string;
  end?: string;
  countries: string[];
  skus: string[];
  search?: string;
  rankOffset?: number;
  rankLimit?: number;
  includeRefundReport?: boolean;
};

export type Kpis = {
  quantity: number;
  salesAmount: number;
  refundAmount: number;
  accessorySalesAmount: number;
  netSalesAmount: number;
  orderCount: number;
  refundRate: number;
  refundOrderRate: number;
  aov: number;
  unitPrice: number;
  avgItemsPerOrder: number;
};

export type ComparisonSummary = {
  current: Kpis;
  previousPeriod: Kpis;
  previousYear: Kpis;
  mom: Partial<Record<keyof Kpis, number>>;
  yoy: Partial<Record<keyof Kpis, number>>;
};

export type TrendPoint = {
  date: string;
  quantity: number;
  salesAmount: number;
  refundAmount: number;
  netSalesAmount: number;
  unitPrice: number;
  avgItemsPerOrder: number;
  orderCount: number;
};

export type RankingRow = {
  sku: string;
  productTitle: string;
  quantity: number;
  salesAmount: number;
  refundAmount: number;
  share: number;
  refundRate: number;
};

export type CountryRankingRow = {
  country: string;
  quantity: number;
  salesAmount: number;
  refundAmount: number;
  netSalesAmount: number;
  orderCount: number;
  share: number;
  refundRate: number;
};

export type DrilldownRankingRow = {
  key: string;
  label: string;
  quantity: number;
  salesAmount: number;
  orderCount: number;
  share: number;
};

export type SkuAnalysisRow = {
  sku: string;
  productTitle: string;
  quantity: number;
  salesAmount: number;
  refundAmount: number;
  netSalesAmount: number;
  avgUnitPrice: number;
  orderCount: number;
  avgItemsPerOrder: number;
  refundRate: number;
};

export type CountryAnalysisRow = {
  country: string;
  quantity: number;
  salesAmount: number;
  refundAmount: number;
  netSalesAmount: number;
  orderCount: number;
  refundRate: number;
};

export type OrderDetailRow = {
  orderId: string;
  date: string;
  country: string;
  sku: string;
  productTitle: string;
  quantity: number;
  salesAmount: number;
  refundAmount: number;
  netSalesAmount: number;
};

export type CustomerRankingRow = {
  customerName: string;
  customerEmail: string;
  country: string;
  orderIds: string[];
  models: string[];
  orderCount: number;
  quantity: number;
  salesAmount: number;
};

export type AccessoryAnalysisRow = {
  key: string;
  label: string;
  quantity: number;
  salesAmount: number;
  orderCount: number;
  withMachineOrderCount: number;
  standaloneOrderCount: number;
  attachRate: number;
  topMachines: Array<{
    sku: string;
    quantity: number;
    orderCount: number;
    salesAmount: number;
  }>;
  orders: Array<{
    orderId: string;
    date: string;
    country: string;
    customerEmail: string;
    accessorySku: string;
    quantity: number;
    salesAmount: number;
    sameOrderMachines: Array<{
      sku: string;
      quantity: number;
      salesAmount: number;
    }>;
    customerOtherMachines: Array<{
      sku: string;
      quantity: number;
      salesAmount: number;
    }>;
  }>;
};

export type DiscountDetailRow = {
  orderId: string;
  date: string;
  country: string;
  code: string;
  models: string[];
  salesAmount: number;
  discountAmount: number;
  customerEmail: string;
};

export type RefundDetailRow = {
  refundId: string;
  orderId: string;
  orderDate: string;
  refundDate: string;
  refundStatus: string;
  country: string;
  sku: string;
  skus: string[];
  lineItems: Array<{
    sku: string;
    quantity: number;
  }>;
  productTitle: string;
  refundReason: string;
  salesAmount: number;
  refundAmount: number;
  refundQuantity: number;
  customerEmail: string;
};

export type ShopifyqlRefundRow = {
  day: string;
  saleId: string;
  orderName: string;
  productTitleAtTimeOfSale: string;
  grossReturns: number;
  discountsReturned: number;
  netReturns: number;
  shippingReturned: number;
  taxesReturned: number;
  returnFees: number;
  totalReturns: number;
  country: string;
  refundReason: string;
  customerEmail: string;
};

export type ShopifyqlRefundReport = {
  rows: ShopifyqlRefundRow[];
  totalRefundAmount: number;
  error?: string;
};

export type ShopifyqlSalesSummary = {
  grossSalesAmount: number;
  discountAmount: number;
  salesAmount: number;
  refundAmount: number;
  netSalesAmount: number;
  totalSalesAmount: number;
  error?: string;
};

export type CachedAnalysis = {
  path: string;
  content: string;
  cached: boolean;
};

export type AxisScale = {
  min: number;
  max: number;
  step: number;
  ticks: number[];
};

export type AnalyticsResponse = {
  generatedAt: string;
  cached: boolean;
  filters: AnalyticsFilters;
  dateRange: {
    start: string;
    end: string;
    label: string;
  };
  kpis: Kpis;
  comparison: ComparisonSummary;
  trend: TrendPoint[];
  previousPeriodTrend: TrendPoint[];
  previousYearTrend: TrendPoint[];
  scales: Record<TrendMetric, AxisScale>;
  rankings: {
    quantity: RankingRow[];
    sales: RankingRow[];
    refunds: RankingRow[];
    countryQuantity: CountryRankingRow[];
    countrySales: CountryRankingRow[];
  };
  skuRows: SkuAnalysisRow[];
  countryRows: CountryAnalysisRow[];
  recentOrders: OrderDetailRow[];
  customerRows: CustomerRankingRow[];
  accessoryAnalysis: AccessoryAnalysisRow[];
  discountRows: DiscountDetailRow[];
  refundRows: RefundDetailRow[];
  shopifyqlRefundRows: ShopifyqlRefundRow[];
  shopifyqlRefundError?: string;
  analysis: CachedAnalysis;
  drilldowns: {
    countryModels: Record<string, DrilldownRankingRow[]>;
    modelCountries: Record<string, DrilldownRankingRow[]>;
  };
  dimensions: {
    countries: DimCountry[];
    products: DimProduct[];
    dates: DimDate[];
    weeks: WeekOption[];
  };
};
