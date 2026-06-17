"use client";

import dynamic from "next/dynamic";
import { type KeyboardEvent, useEffect, useMemo, useState } from "react";
import type { AnalyticsResponse, ChartMode, DatePreset, TrendMetric, TrendPoint } from "@/types/analytics";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

const dateOptions: Array<{ value: DatePreset; label: string }> = [
  { value: "week", label: "本周（周四-周三）" },
  { value: "today", label: "今天" },
  { value: "yesterday", label: "昨天" },
  { value: "last7", label: "最近7天" },
  { value: "last30", label: "最近30天" },
  { value: "month", label: "本月" },
  { value: "lastMonth", label: "上月" },
  { value: "quarter", label: "本季" },
  { value: "year", label: "今年" },
  { value: "custom", label: "自定义" },
];

const navItems = [
  { value: "overview", label: "总览" },
  { value: "countries", label: "国家分析" },
  { value: "products", label: "型号分析" },
  { value: "orders", label: "订单明细" },
  { value: "customers", label: "客户排行" },
  { value: "refunds", label: "退款分析" },
  { value: "discounts", label: "优惠券明细" },
] as const;

type ViewKey = (typeof navItems)[number]["value"];
type TrendPeriod = "day" | "week" | "month";
type ShareGroup = "country" | "model";
type ShareValue = "sales" | "quantity" | "orders";
type RankTarget = "model" | "country";
type RankMetric = "quantity" | "sales";
type RankDisplayRow = { key: string; label: string; value: string; share: number };

export default function DashboardClient() {
  const [activeView, setActiveView] = useState<ViewKey>("overview");
  const [preset, setPreset] = useState<DatePreset>("week");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [countries, setCountries] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [trendMetric, setTrendMetric] = useState<TrendMetric>("money");
  const [chartMode, setChartMode] = useState<ChartMode>("line");
  const [trendPeriod, setTrendPeriod] = useState<TrendPeriod>("day");
  const [shareGroup, setShareGroup] = useState<ShareGroup>("model");
  const [shareValue, setShareValue] = useState<ShareValue>("sales");
  const [rankTarget, setRankTarget] = useState<RankTarget>("model");
  const [rankMetric, setRankMetric] = useState<RankMetric>("sales");
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    params.set("preset", preset);
    if (preset === "custom") {
      if (start) params.set("start", start);
      if (end) params.set("end", end);
    }
    countries.forEach((country) => params.append("country", country));
    models.forEach((model) => params.append("sku", model));
    if (search) params.set("search", search);
    params.set("rankOffset", "0");
    params.set("rankLimit", "100");
    return params;
  }, [activeView, countries, end, models, preset, search, start]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/api/analytics?${query.toString()}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((payload: AnalyticsResponse) => {
        if (active) setData(payload);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [query]);

  const countryOptions = data?.dimensions.countries ?? [];
  const modelOptions = data?.dimensions.products ?? [];
  const selectedCountry = countries[0] || "";
  const selectedModel = models[0] || "";
  const shareRows = buildShareRows(data, shareGroup, shareValue);
  const effectiveRankTarget = resolveRankTarget(activeView, selectedCountry, selectedModel, rankTarget);
  const rankRows = buildRankRows(data, effectiveRankTarget, rankMetric);
  const countrySalesRows = buildRankRows(data, "country", "sales");
  const countryQuantityRows = buildRankRows(data, "country", "quantity");
  const modelSalesRows = buildRankRows(data, "model", "sales");
  const modelQuantityRows = buildRankRows(data, "model", "quantity");
  const weekOptions = data?.dimensions.weeks ?? [];
  const selectedAccessoryAnalysis = buildSelectedAccessoryAnalysis(data, selectedModel);
  const viewTitle = selectedCountry && activeView === "countries" ? `${selectedCountry} Overview` : selectedModel && activeView === "products" ? `${selectedModel} Overview` : activeView === "orders" ? "订单明细" : activeView === "customers" ? "客户排行" : activeView === "refunds" ? "退款分析" : activeView === "discounts" ? "优惠券明细" : "Overview";

  return (
    <main className="apple-shell">
      <aside className="apple-sidebar">
        <div className="brand-mark">
          <div className="brand-icon">S</div>
          <strong>Shopify</strong>
        </div>
        <nav className="side-nav">
          {navItems.map((item) => (
            <button key={item.value} className={activeView === item.value ? "active" : ""} type="button" onClick={() => {
              if (item.value === "countries") setModels([]);
              if (item.value === "products") setCountries([]);
              setActiveView(item.value);
            }}>
              <span className="nav-dot" />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="side-user">
          <div className="avatar">B</div>
          <div>
            <strong>Beelink</strong>
            <span>Admin</span>
          </div>
        </div>
      </aside>

      <section className="apple-main">
        <header className="topbar">
          <div>
            <p className="eyebrow">Shopify Analytics</p>
            <h1>{viewTitle}</h1>
          </div>
          <div className="last-updated">Last updated: {data ? new Date(data.generatedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }) : "--"}</div>
        </header>

        <section className="filter-row">
          <select className="apple-field" value={preset} onChange={(event) => setPreset(event.target.value as DatePreset)}>
            {dateOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <select className="apple-field" value={preset === "custom" && start && end ? `${start}__${end}` : ""} onChange={(event) => {
            const option = weekOptions.find((item) => item.key === event.target.value);
            if (!option) return;
            setPreset("custom");
            setStart(option.start);
            setEnd(option.end);
          }}>
            <option value="">周区间快捷选择</option>
            {weekOptions.map((week) => <option key={week.key} value={week.key}>{week.label}</option>)}
          </select>
          {preset === "custom" ? (
            <>
              <input className="apple-field" type="date" value={start} onChange={(event) => setStart(event.target.value)} />
              <input className="apple-field" type="date" value={end} onChange={(event) => setEnd(event.target.value)} />
            </>
          ) : null}
          <select className="apple-field" value={selectedCountry} onChange={(event) => {
            setCountries(event.target.value ? [event.target.value] : []);
            if (activeView === "countries") setModels([]);
          }}>
            <option value="">全部国家</option>
            {countryOptions.map((item) => <option key={item.country} value={item.country}>{item.country}</option>)}
          </select>
          <select className="apple-field" value={selectedModel} onChange={(event) => {
            setModels(event.target.value ? [event.target.value] : []);
            if (activeView === "products") setCountries([]);
          }}>
            <option value="">全部型号</option>
            {modelOptions.map((item) => <option key={item.sku} value={item.sku}>{item.sku}</option>)}
          </select>
          <input className="apple-field search-field" placeholder="搜索订单 / 国家 / 型号" value={search} onChange={(event) => setSearch(event.target.value)} />
          <button className="reset-button" type="button" onClick={() => {
            setCountries([]);
            setModels([]);
            setSearch("");
          }}>Reset</button>
        </section>

        <section className="glass-card share-card">
          <div className="card-title-row">
            <div>
              <h2>占比分析</h2>
              <p>按当前筛选条件聚合</p>
            </div>
            <div className="segmented">
              <button className={shareGroup === "country" ? "active" : ""} type="button" onClick={() => setShareGroup("country")}>国家</button>
              <button className={shareGroup === "model" ? "active" : ""} type="button" onClick={() => setShareGroup("model")}>型号</button>
            </div>
            <div className="segmented">
              <button className={shareValue === "sales" ? "active" : ""} type="button" onClick={() => setShareValue("sales")}>销售额占比</button>
              <button className={shareValue === "quantity" ? "active" : ""} type="button" onClick={() => setShareValue("quantity")}>销量占比</button>
              <button className={shareValue === "orders" ? "active" : ""} type="button" onClick={() => setShareValue("orders")}>订单数占比</button>
            </div>
          </div>
          <div className="share-content">
            <KpiStrip data={data} />
            <ShareDonut title={shareTitle(shareGroup, shareValue)} rows={shareRows} full />
          </div>
        </section>

        {activeView !== "orders" && activeView !== "customers" && activeView !== "refunds" && activeView !== "discounts" ? (
          <>
            <section className={activeView === "overview" ? "hero-grid chart-only" : "hero-grid"}>
              <div className="glass-card chart-card">
                <div className="card-title-row">
                  <div>
                    <h2>{trendMetric === "quantity" ? "销量趋势" : trendMetric === "money" ? "销售额趋势" : "效率趋势"}</h2>
                    <p>{loading ? "正在读取 Shopify 数据" : "Server aggregated Shopify data"}</p>
                  </div>
                  <div className="segmented">
                    <button className={trendMetric === "money" ? "active" : ""} type="button" onClick={() => setTrendMetric("money")}>销售额</button>
                    <button className={trendMetric === "quantity" ? "active" : ""} type="button" onClick={() => setTrendMetric("quantity")}>销量</button>
                    <button className={chartMode === "bar" ? "active" : ""} type="button" onClick={() => setChartMode(chartMode === "bar" ? "line" : "bar")}>柱状</button>
                  </div>
                  <div className="segmented">
                    <button className={trendPeriod === "day" ? "active" : ""} type="button" onClick={() => setTrendPeriod("day")}>天</button>
                    <button className={trendPeriod === "week" ? "active" : ""} type="button" onClick={() => setTrendPeriod("week")}>周</button>
                    <button className={trendPeriod === "month" ? "active" : ""} type="button" onClick={() => setTrendPeriod("month")}>月</button>
                  </div>
                </div>
                <ReactECharts option={chartOption(data, trendMetric, chartMode, trendPeriod)} style={{ height: 340 }} notMerge />
              </div>

              {activeView !== "overview" ? <section className="glass-card rank-panel wide-rank-panel">
                  <div className="card-title-row">
                    <div>
                      <h2>{rankTitle(effectiveRankTarget, rankMetric)}</h2>
                      <p>{rankHint(activeView, selectedCountry, selectedModel)} · 默认显示 10 项高度</p>
                    </div>
                    <div className="segmented">
                      <button className={effectiveRankTarget === "model" ? "active" : ""} type="button" onClick={() => setRankTarget("model")} disabled={activeView === "products" && Boolean(selectedModel)}>型号</button>
                      <button className={effectiveRankTarget === "country" ? "active" : ""} type="button" onClick={() => setRankTarget("country")} disabled={activeView === "countries" && Boolean(selectedCountry)}>国家</button>
                    </div>
                    <div className="segmented">
                      <button className={rankMetric === "quantity" ? "active" : ""} type="button" onClick={() => setRankMetric("quantity")}>销量</button>
                      <button className={rankMetric === "sales" ? "active" : ""} type="button" onClick={() => setRankMetric("sales")}>销售额</button>
                    </div>
                  </div>
                  <RankingListBody rows={rankRows} onSelect={(key) => {
                    if (effectiveRankTarget === "country") {
                      setCountries([key]);
                      setModels([]);
                      setActiveView("countries");
                    } else {
                      setModels([key]);
                      setCountries([]);
                      setActiveView("products");
                    }
                  }} />
                </section> : null}
            </section>

            {activeView === "overview" ? (
              <>
                <section className="overview-rank-grid">
                  <OverviewRankingPanel
                    title="国家排行"
                    salesRows={countrySalesRows}
                    quantityRows={countryQuantityRows}
                    drilldownTitle="该国家型号排行"
                    drilldownRowsByKey={data?.drilldowns.countryModels ?? {}}
                    onSelect={(country) => {
                      setCountries([country]);
                      setModels([]);
                      setActiveView("countries");
                    }}
                  />
                  <OverviewRankingPanel
                    title="型号排行"
                    salesRows={modelSalesRows}
                    quantityRows={modelQuantityRows}
                    drilldownTitle="该型号售卖国家"
                    drilldownRowsByKey={data?.drilldowns.modelCountries ?? {}}
                    onSelect={(model) => {
                      setModels([model]);
                      setCountries([]);
                      setActiveView("products");
                    }}
                  />
                </section>
                <AnalysisPanel analysis={data?.analysis} />
              </>
            ) : null}
            {activeView === "products" && selectedAccessoryAnalysis.length ? <AccessoryAnalysis rows={selectedAccessoryAnalysis} dateRange={data?.dateRange} /> : null}
          </>
        ) : activeView === "customers" ? (
          <CustomerRanking rows={data?.customerRows ?? []} dateRange={data?.dateRange} />
        ) : activeView === "refunds" ? (
          <RefundAnalysis
            rows={data?.refundRows ?? []}
            dateRange={data?.dateRange}
          />
        ) : activeView === "discounts" ? (
          <DiscountDetails rows={data?.discountRows ?? []} dateRange={data?.dateRange} />
        ) : (
          <RecentOrders rows={data?.recentOrders ?? []} dateRange={data?.dateRange} />
        )}
      </section>
    </main>
  );
}

function KpiStrip({ data }: { data: AnalyticsResponse | null }) {
  const items = [
    { title: "销售额", value: formatMoney(data?.kpis.netSalesAmount ?? 0), meta: "已扣退款 / Accessories", mom: data?.comparison.mom.netSalesAmount, yoy: data?.comparison.yoy.netSalesAmount },
    { title: "销量", value: formatNumber(data?.kpis.quantity ?? 0), meta: "Units sold", mom: data?.comparison.mom.quantity, yoy: data?.comparison.yoy.quantity },
    { title: "订单数", value: formatNumber(data?.kpis.orderCount ?? 0), meta: "Orders", mom: data?.comparison.mom.orderCount, yoy: data?.comparison.yoy.orderCount },
    { title: "客单价", value: formatMoney(data?.kpis.aov ?? 0), meta: "AOV", mom: data?.comparison.mom.aov, yoy: data?.comparison.yoy.aov },
    { title: "退款率", value: formatPercent(data?.kpis.refundRate ?? 0), meta: formatMoney(data?.kpis.refundAmount ?? 0), mom: data?.comparison.mom.refundRate, yoy: data?.comparison.yoy.refundRate, danger: true },
  ];
  return (
    <div className="kpi-strip">
      {items.map((item) => (
        <div key={item.title} className="kpi-strip-item">
          <span>{item.title}</span>
          <strong>{item.value}</strong>
          <small className={item.danger ? "danger" : ""}>{item.meta}</small>
          <div className="kpi-compare">
            <span className={(item.mom || 0) >= 0 ? "up" : "down"}>环比 {formatSignedPercent(item.mom || 0)}</span>
            <span className={(item.yoy || 0) >= 0 ? "up" : "down"}>同比 {formatSignedPercent(item.yoy || 0)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function RankingList({ title, rows, onSelect }: { title: string; rows: RankDisplayRow[]; onSelect: (key: string) => void }) {
  return (
    <section className="glass-card rank-panel">
      <div className="card-title-row">
        <h2>{title}</h2>
        <span>View all</span>
      </div>
      <RankingListBody rows={rows} onSelect={onSelect} />
    </section>
  );
}

function RankingListBody({ rows, onSelect, onToggle, expandedKey, drilldownTitle, drilldownRowsByKey, metric }: { rows: RankDisplayRow[]; onSelect: (key: string) => void; onToggle?: (key: string) => void; expandedKey?: string | null; drilldownTitle?: string; drilldownRowsByKey?: AnalyticsResponse["drilldowns"]["countryModels"]; metric?: RankMetric }) {
  const handleKey = (event: KeyboardEvent<HTMLDivElement>, key: string) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    if (onToggle) onToggle(key);
    else onSelect(key);
  };

  return (
    <div className="apple-rank-list">
      {rows.map((row, index) => {
        const drilldownRows = drilldownRowsByKey?.[row.key] ?? [];
        const expanded = expandedKey === row.key && drilldownRows.length > 0;
        return (
          <div key={`${row.key}-${index}`} className={expanded ? "rank-item expanded" : "rank-item"}>
            <div
              className="apple-rank-row"
              role="button"
              tabIndex={0}
              onClick={() => {
                if (onToggle) onToggle(row.key);
                else onSelect(row.key);
              }}
              onKeyDown={(event) => handleKey(event, row.key)}
            >
              <span className="rank-number">{index + 1}</span>
              <button className="rank-label rank-label-link" type="button" onClick={(event) => {
                event.stopPropagation();
                onSelect(row.key);
              }}>{row.label}</button>
              <span className="rank-bar"><i style={{ width: `${Math.max(4, row.share * 100)}%` }} /></span>
              <strong>{row.value}</strong>
            </div>
            {expanded ? <InlineDrilldown title={drilldownTitle || "明细排行"} rows={drilldownRows} metric={metric || "sales"} /> : null}
          </div>
        );
      })}
    </div>
  );
}

function OverviewRankingPanel({ title, salesRows, quantityRows, drilldownTitle, drilldownRowsByKey, onSelect }: { title: string; salesRows: RankDisplayRow[]; quantityRows: RankDisplayRow[]; drilldownTitle: string; drilldownRowsByKey: AnalyticsResponse["drilldowns"]["countryModels"]; onSelect: (key: string) => void }) {
  const [metric, setMetric] = useState<RankMetric>("sales");
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const activeRows = metric === "sales" ? salesRows : quantityRows;

  return (
    <section className="glass-card rank-panel">
      <div className="card-title-row">
        <div>
          <h2>{title}</h2>
          <p>默认显示 10 项高度，滑动查看全部</p>
        </div>
        <div className="segmented">
          <button className={metric === "sales" ? "active" : ""} type="button" onClick={() => setMetric("sales")}>销售额</button>
          <button className={metric === "quantity" ? "active" : ""} type="button" onClick={() => setMetric("quantity")}>销量</button>
        </div>
      </div>
      <RankingListBody
        rows={activeRows}
        onSelect={onSelect}
        onToggle={(key) => setExpandedKey((current) => current === key ? null : key)}
        expandedKey={expandedKey}
        drilldownTitle={drilldownTitle}
        drilldownRowsByKey={drilldownRowsByKey}
        metric={metric}
      />
    </section>
  );
}

function InlineDrilldown({ title, rows, metric }: { title: string; rows: AnalyticsResponse["drilldowns"]["countryModels"][string]; metric: RankMetric }) {
  const sorted = [...rows].sort((a, b) => metric === "quantity" ? b.quantity - a.quantity : b.salesAmount - a.salesAmount);
  const total = sorted.reduce((sum, row) => sum + (metric === "quantity" ? row.quantity : row.salesAmount), 0);
  return (
    <div className="inline-drilldown">
      <strong>{title}</strong>
      <div className="inline-drilldown-list">
        {sorted.map((row, index) => {
          const value = metric === "quantity" ? row.quantity : row.salesAmount;
          return (
            <div key={`${row.key}-${index}`} className="inline-drilldown-row">
              <span>{index + 1}</span>
              <em>{row.label}</em>
              <i>{metric === "quantity" ? formatNumber(row.quantity) : formatMoney(row.salesAmount)}</i>
              <b style={{ width: `${Math.max(4, total ? (value / total) * 100 : 0)}%` }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ShareDonut({ title, rows, full }: { title: string; rows: Array<{ name: string; value: number }>; full?: boolean }) {
  return (
    <section className={full ? "donut-inner" : "glass-card donut-card"}>
      <div className="card-title-row">
        <h2>{title}</h2>
      </div>
      <ReactECharts
        style={{ height: full ? 300 : 260 }}
        option={{
          color: ["#2563eb", "#60a5fa", "#93c5fd", "#bfdbfe", "#dbeafe", "#cbd5e1"],
          tooltip: { trigger: "item" },
          series: [{
            type: "pie",
            radius: ["56%", "78%"],
            center: full ? ["34%", "52%"] : ["42%", "52%"],
            label: { show: false },
            data: rows.map((row) => ({ name: row.name, value: row.value })),
          }],
          legend: {
            type: "scroll",
            right: 0,
            top: 18,
            bottom: 18,
            orient: "vertical",
            itemWidth: 8,
            itemHeight: 8,
            pageIconSize: 9,
            textStyle: { color: "#64748b", fontSize: 11 },
          },
        }}
      />
    </section>
  );
}

function buildShareRows(data: AnalyticsResponse | null, group: ShareGroup, value: ShareValue) {
  if (!data) return [];
  if (group === "country") {
    return data.countryRows.map((row) => ({
      name: row.country,
      value: value === "orders" ? row.orderCount : value === "quantity" ? row.quantity : row.salesAmount,
    })).sort((a, b) => b.value - a.value);
  }
  return data.skuRows.map((row) => ({
    name: row.sku,
    value: value === "orders" ? row.orderCount : value === "quantity" ? row.quantity : row.salesAmount,
  })).sort((a, b) => b.value - a.value);
}

function buildRankRows(data: AnalyticsResponse | null, target: RankTarget, metric: RankMetric) {
  if (!data) return [];
  if (target === "country") {
    const rows = metric === "quantity" ? data.rankings.countryQuantity : data.rankings.countrySales;
    return rows.map((row) => ({
      key: row.country,
      label: row.country,
      value: metric === "quantity" ? formatNumber(row.quantity) : formatMoney(row.salesAmount),
      share: row.share,
    }));
  }
  const rows = metric === "quantity" ? data.rankings.quantity : data.rankings.sales;
  return rows.map((row) => ({
    key: row.sku,
    label: row.sku,
    value: metric === "quantity" ? formatNumber(row.quantity) : formatMoney(row.salesAmount),
    share: row.share,
  }));
}

function buildSelectedAccessoryAnalysis(data: AnalyticsResponse | null, selectedModel: string) {
  if (!data || !selectedModel) return [];
  const selected = selectedModel.toLowerCase();
  return data.accessoryAnalysis.filter((row) => {
    if (row.key === "mate-se") return selected.includes("mate se");
    if (row.key === "ex-pcie5") return selected.includes("bl/ex/深空灰色/pcie5");
    return false;
  });
}

function shareTitle(group: ShareGroup, value: ShareValue) {
  const groupLabel = group === "country" ? "国家" : "型号";
  const valueLabel = value === "orders" ? "订单数" : value === "quantity" ? "销量" : "销售额";
  return `${groupLabel}${valueLabel}占比`;
}

function rankTitle(target: RankTarget, metric: RankMetric) {
  return `${target === "country" ? "国家" : "型号"}${metric === "quantity" ? "销量" : "销售额"}排行`;
}

function rankHint(view: ViewKey, selectedCountry: string, selectedModel: string) {
  if (view === "countries" && !selectedCountry) return "未选国家，显示国家排行";
  if (view === "countries" && selectedCountry) return "已选国家，显示该国家型号售卖排行";
  if (view === "products" && !selectedModel) return "未选型号，显示型号排行";
  if (view === "products" && selectedModel) return "已选型号，显示售卖国家";
  if (selectedCountry && !selectedModel) return "已选国家，自动展示型号排行";
  if (selectedModel && !selectedCountry) return "已选型号，自动展示国家排行";
  return "可组合国家/型号与销量/销售额";
}

function resolveRankTarget(view: ViewKey, selectedCountry: string, selectedModel: string, manualTarget: RankTarget): RankTarget {
  if (view === "countries") return selectedCountry ? "model" : "country";
  if (view === "products") return selectedModel ? "country" : "model";
  if (selectedCountry && !selectedModel) return "model";
  if (selectedModel && !selectedCountry) return "country";
  return manualTarget;
}

function RecentOrders({ rows, compact, dateRange }: { rows: AnalyticsResponse["recentOrders"]; compact?: boolean; dateRange?: AnalyticsResponse["dateRange"] }) {
  const distinctOrders = new Set(rows.map((row) => row.orderId)).size;
  const totalQuantity = rows.reduce((sum, row) => sum + row.quantity, 0);
  return (
    <section className="glass-card orders-card">
      <div className="card-title-row">
        <div>
          <h2>订单明细</h2>
          <p>{dateRange?.label || "当前筛选时间段"} · 明细行 {rows.length} · 去重订单 {distinctOrders} · 销量 {formatNumber(totalQuantity)}</p>
        </div>
        <span>{distinctOrders} orders</span>
      </div>
      <div className={compact ? "orders-table compact" : "orders-table"}>
        <table>
          <thead>
            <tr>
              <th>订单号</th>
              <th>国家</th>
              <th>型号</th>
              <th>销量</th>
              <th>销售额</th>
              <th>日期</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, compact ? 6 : rows.length).map((row) => (
              <tr key={`${row.orderId}-${row.sku}-${row.date}`}>
                <td>{row.orderId}</td>
                <td>{row.country}</td>
                <td>{row.sku}</td>
                <td>{formatNumber(row.quantity)}</td>
                <td>{formatMoney(row.salesAmount)}</td>
                <td>{row.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AnalysisPanel({ analysis }: { analysis?: AnalyticsResponse["analysis"] }) {
  const lines = (analysis?.content || "").split("\n").filter((line) => line.startsWith("- "));
  return (
    <section className="glass-card analysis-card">
      <div className="card-title-row">
        <div>
          <h2>AI 销量分析</h2>
          <p>{analysis?.cached ? "已读取本地分析文件" : "已生成新的本地分析文件"}</p>
        </div>
        <span>{analysis?.path ? analysis.path.split("/").pop() : ""}</span>
      </div>
      <div className="analysis-summary">
        {lines.slice(0, 8).map((line) => <p key={line}>{line.replace(/^- /, "")}</p>)}
      </div>
    </section>
  );
}

function CustomerRanking({ rows, dateRange }: { rows: AnalyticsResponse["customerRows"]; dateRange?: AnalyticsResponse["dateRange"] }) {
  return (
    <section className="glass-card orders-card">
      <div className="card-title-row">
        <div>
          <h2>客户购买 TOP10</h2>
          <p>{dateRange?.label || "当前筛选时间段"} · 按销售额排序</p>
        </div>
      </div>
      <div className="orders-table compact">
        <table>
          <thead>
            <tr>
              <th>客户</th>
              <th>邮件</th>
              <th>国家</th>
              <th>订单号</th>
              <th>购买型号</th>
              <th>销售额</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.customerEmail}-${row.orderIds.join(",")}`}>
                <td>{row.customerName}</td>
                <td>{row.customerEmail}</td>
                <td>{row.country}</td>
                <td>{row.orderIds.join(", ")}</td>
                <td>{row.models.join(", ")}</td>
                <td>{formatMoney(row.salesAmount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AccessoryAnalysis({ rows, dateRange }: { rows: AnalyticsResponse["accessoryAnalysis"]; dateRange?: AnalyticsResponse["dateRange"] }) {
  return (
    <section className="glass-card orders-card accessory-card">
      <div className="card-title-row">
        <div>
          <h2>Mate SE / EX 专属分析</h2>
          <p>{dateRange?.label || "当前筛选时间段"} · 追踪同订单与同客户是否购买其他机器</p>
        </div>
      </div>
      <div className="accessory-grid">
        {rows.map((row) => (
          <div key={row.key} className="accessory-panel">
            <div className="accessory-head">
              <div>
                <h3>{row.label}</h3>
                <p>{formatNumber(row.orderCount)} 单 · {formatNumber(row.quantity)} 件 · 相关销售额 {formatMoney(row.salesAmount)}</p>
              </div>
              <strong>{formatPercent(row.attachRate)}</strong>
            </div>
            <div className="accessory-metrics">
              <span>同单购机 {formatNumber(row.withMachineOrderCount)}</span>
              <span>单独购买 {formatNumber(row.standaloneOrderCount)}</span>
            </div>
            <div className="mini-machine-list">
              <strong>同单机器 Top</strong>
              {row.topMachines.length ? row.topMachines.map((machine) => (
                <p key={machine.sku}><span>{machine.sku}</span><b>{formatNumber(machine.quantity)} 件</b></p>
              )) : <p><span>暂无同单机器</span><b>-</b></p>}
            </div>
            <div className="orders-table accessory-table">
              <table>
                <thead>
                  <tr>
                    <th>订单号</th>
                    <th>国家</th>
                    <th>购买数量</th>
                    <th>同订单机器</th>
                    <th>同客户其他机器</th>
                    <th>日期</th>
                  </tr>
                </thead>
                <tbody>
                  {row.orders.map((order) => (
                    <tr key={`${row.key}-${order.orderId}`}>
                      <td>{order.orderId}</td>
                      <td>{order.country}</td>
                      <td>{formatNumber(order.quantity)}</td>
                      <td>{order.sameOrderMachines.length ? order.sameOrderMachines.map((item) => `${item.sku} x ${formatNumber(item.quantity)}`).join(", ") : "未同单购买机器"}</td>
                      <td>{order.customerOtherMachines.length ? order.customerOtherMachines.map((item) => `${item.sku} x ${formatNumber(item.quantity)}`).join(", ") : "未发现"}</td>
                      <td>{order.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function RefundAnalysis({ rows, dateRange }: { rows: AnalyticsResponse["refundRows"]; dateRange?: AnalyticsResponse["dateRange"] }) {
  return (
    <section className="glass-card orders-card">
      <div className="card-title-row">
        <div>
          <h2>退款分析</h2>
          <p>{dateRange?.label || "当前筛选时间段"} · 已退款 / 部分退款订单 · 按退款创建时间统计</p>
        </div>
        <span>{rows.length} orders</span>
      </div>
      <div className="orders-table">
        <FallbackRefundTable rows={rows} />
      </div>
    </section>
  );
}

function ShopifyqlRefundTable({ rows }: { rows: AnalyticsResponse["shopifyqlRefundRows"] }) {
  return (
    <table>
      <thead>
        <tr>
          <th>退款日期</th>
          <th>订单号</th>
          <th>Sale ID</th>
          <th>产品</th>
          <th>国家</th>
          <th>Gross returns</th>
          <th>Discounts returned</th>
          <th>Net returns</th>
          <th>Shipping returned</th>
          <th>Taxes returned</th>
          <th>Return fees</th>
          <th>Total returns</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={`${row.day}-${row.orderName}-${row.saleId}-${index}`}>
            <td>{row.day}</td>
            <td>{row.orderName}</td>
            <td>{row.saleId}</td>
            <td>{row.productTitleAtTimeOfSale}</td>
            <td>{row.country}</td>
            <td>{formatMoney(row.grossReturns)}</td>
            <td>{formatMoney(row.discountsReturned)}</td>
            <td>{formatMoney(row.netReturns)}</td>
            <td>{formatMoney(row.shippingReturned)}</td>
            <td>{formatMoney(row.taxesReturned)}</td>
            <td>{formatMoney(row.returnFees)}</td>
            <td>{formatMoney(row.totalReturns)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function FallbackRefundTable({ rows }: { rows: AnalyticsResponse["refundRows"] }) {
  return (
    <table>
      <thead>
        <tr>
          <th>订单号</th>
          <th>状态</th>
          <th>退款时间</th>
          <th>订单时间</th>
          <th>国家</th>
          <th>商品行 SKU / 数量</th>
          <th>销售额</th>
          <th>退款额</th>
          <th>退款理由</th>
          <th>邮件</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={`${row.refundId}-${row.sku}-${row.refundAmount}`}>
            <td>{row.orderId}</td>
            <td>{row.refundStatus}</td>
            <td>{row.refundDate}</td>
            <td>{row.orderDate}</td>
            <td>{row.country}</td>
            <td>{row.lineItems.length ? row.lineItems.map((item) => `${item.sku} x ${formatNumber(item.quantity)}`).join(", ") : row.sku}</td>
            <td>{formatMoney(row.salesAmount)}</td>
            <td>{formatMoney(row.refundAmount)}</td>
            <td>{row.refundReason}</td>
            <td>{row.customerEmail}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DiscountDetails({ rows, dateRange }: { rows: AnalyticsResponse["discountRows"]; dateRange?: AnalyticsResponse["dateRange"] }) {
  return (
    <section className="glass-card orders-card">
      <div className="card-title-row">
        <div>
          <h2>优惠券明细</h2>
          <p>{dateRange?.label || "当前筛选时间段"} · 按优惠金额排序</p>
        </div>
        <span>{rows.length} lines</span>
      </div>
      <div className="orders-table">
        <table>
          <thead>
            <tr>
              <th>订单号</th>
              <th>日期</th>
              <th>国家</th>
              <th>优惠码</th>
              <th>型号</th>
              <th>销售额</th>
              <th>优惠金额</th>
              <th>邮件</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.orderId}-${row.code}`}>
                <td>{row.orderId}</td>
                <td>{row.date}</td>
                <td>{row.country}</td>
                <td>{row.code}</td>
                <td>{row.models.join(", ")}</td>
                <td>{formatMoney(row.salesAmount)}</td>
                <td>{formatMoney(row.discountAmount)}</td>
                <td>{row.customerEmail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function chartOption(data: AnalyticsResponse | null, metric: TrendMetric, mode: ChartMode, period: TrendPeriod) {
  const trend = aggregateTrend(data?.trend ?? [], period);
  const previousPeriodTrend = aggregateTrend(data?.previousPeriodTrend ?? [], period);
  const previousYearTrend = aggregateTrend(data?.previousYearTrend ?? [], period);
  const smooth = mode !== "bar";
  if (metric === "money") {
    return {
      grid: { left: 58, right: 24, top: 28, bottom: 38 },
      tooltip: { trigger: "axis" },
      legend: { top: 0, right: 0, textStyle: { color: "#64748b", fontSize: 11 } },
      color: ["#2563eb", "#ef4444", "#94a3b8", "#cbd5e1"],
      xAxis: { type: "category", data: trend.map((point) => point.date), boundaryGap: false, axisLine: { lineStyle: { color: "#e2e8f0" } } },
      yAxis: { type: "value", axisLabel: { formatter: (value: number) => `$${Math.round(value / 1000)}K` }, splitLine: { lineStyle: { color: "#e5e7eb", type: "dashed" } } },
      series: [
        { name: "销售额", type: mode === "bar" ? "bar" : "line", smooth, symbolSize: 5, areaStyle: mode === "area" ? { opacity: 0.12 } : undefined, data: trend.map((point) => point.salesAmount) },
        { name: "退款额", type: mode === "bar" ? "bar" : "line", smooth, symbolSize: 5, data: trend.map((point) => point.refundAmount) },
        { name: "环比销售额", type: "line", smooth, symbol: "none", lineStyle: { type: "dashed" }, data: trend.map((_, index) => previousPeriodTrend[index]?.salesAmount ?? null) },
        { name: "同比销售额", type: "line", smooth, symbol: "none", lineStyle: { type: "dotted" }, data: trend.map((_, index) => previousYearTrend[index]?.salesAmount ?? null) },
      ],
    };
  }
  return {
    grid: { left: 58, right: 24, top: 28, bottom: 38 },
    tooltip: { trigger: "axis" },
    legend: { top: 0, right: 0, textStyle: { color: "#64748b", fontSize: 11 } },
    color: ["#2563eb", "#94a3b8", "#cbd5e1"],
    xAxis: { type: "category", data: trend.map((point) => point.date), boundaryGap: false, axisLine: { lineStyle: { color: "#e2e8f0" } } },
    yAxis: { type: "value", splitLine: { lineStyle: { color: "#e5e7eb", type: "dashed" } } },
    series: [
      { name: "销量", type: mode === "bar" ? "bar" : "line", smooth, symbolSize: 5, areaStyle: mode === "area" ? { opacity: 0.12 } : undefined, data: trend.map((point) => point.quantity) },
      { name: "环比销量", type: "line", smooth, symbol: "none", lineStyle: { type: "dashed" }, data: trend.map((_, index) => previousPeriodTrend[index]?.quantity ?? null) },
      { name: "同比销量", type: "line", smooth, symbol: "none", lineStyle: { type: "dotted" }, data: trend.map((_, index) => previousYearTrend[index]?.quantity ?? null) },
    ],
  };
}

function aggregateTrend(trend: TrendPoint[], period: TrendPeriod): TrendPoint[] {
  if (period === "day") return trend;
  const map = new Map<string, TrendPoint[]>();
  for (const point of trend) {
    const key = period === "month" ? point.date.slice(0, 7) : weekKey(point.date);
    const group = map.get(key) || [];
    group.push(point);
    map.set(key, group);
  }
  return [...map.entries()].map(([date, group]) => {
    const quantity = group.reduce((sum, row) => sum + row.quantity, 0);
    const salesAmount = group.reduce((sum, row) => sum + row.salesAmount, 0);
    const refundAmount = group.reduce((sum, row) => sum + row.refundAmount, 0);
    const orderCount = group.reduce((sum, row) => sum + row.orderCount, 0);
    return {
      date,
      quantity,
      salesAmount,
      refundAmount,
      netSalesAmount: salesAmount - refundAmount,
      unitPrice: quantity ? salesAmount / quantity : 0,
      avgItemsPerOrder: orderCount ? quantity / orderCount : 0,
      orderCount,
    };
  }).sort((a, b) => a.date.localeCompare(b.date));
}

function weekKey(date: string) {
  const parsed = new Date(`${date}T00:00:00`);
  parsed.setDate(parsed.getDate() - ((parsed.getDay() + 6) % 7));
  return `${parsed.getMonth() + 1}/${parsed.getDate()}`;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value || 0);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("zh-CN").format(value || 0);
}

function formatPercent(value: number) {
  return new Intl.NumberFormat("zh-CN", { style: "percent", maximumFractionDigits: 2 }).format(value || 0);
}

function formatSignedPercent(value: number) {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${formatPercent(value)}`;
}
