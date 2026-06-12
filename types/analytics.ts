export type ChartMode = "line" | "area" | "bar";
export type TrendMetric = "quantity" | "money" | "unitPrice" | "avgItemsPerOrder";
export type DatePreset = "today" | "yesterday" | "week" | "last7" | "last30" | "month" | "lastMonth" | "quarter" | "year" | "custom";

export type FactOrder = {
  orderId: string;
  date: string;
  orderDate: string;
  eventType: "sale" | "refund";
  country: string;
  sku: string;
  productTitle: string;
  quantity: number;
  salesAmount: number;
  refundAmount: number;
  refundDate?: string;
  refundId?: string;
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
};

export type DimProduct = {
  sku: string;
  productTitle: string;
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
};

export type Kpis = {
  quantity: number;
  salesAmount: number;
  refundAmount: number;
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
  country: string;
  sku: string;
  skus: string[];
  productTitle: string;
  refundReason: string;
  salesAmount: number;
  refundAmount: number;
  customerEmail: string;
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
  discountRows: DiscountDetailRow[];
  refundRows: RefundDetailRow[];
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
