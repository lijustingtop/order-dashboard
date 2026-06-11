# Shopify Analytics Dashboard

Next.js + React + TypeScript + Tailwind + ECharts + TanStack Table 的 Shopify Analytics Dashboard。

## 启动

```bash
npm install --cache ./.npm-cache
npm run dev
```

打开：

```text
http://localhost:5173
```

## 数据流

- 生产同步：Shopify Admin GraphQL API，默认版本 `2026-07`。
- 大批量订单：使用 GraphQL Bulk Operations，不实时拉取订单。
- 数据来源：只读取 Shopify Admin GraphQL API 的 Bulk Operation 结果，并在服务端转换成 `FactOrders`。
- SKU 归并：服务端聚合前会去除美规、欧规、英规、澳规、日规等电源规格，避免同一型号被拆成多条。
- 服务端聚合：`/api/analytics` 返回 KPI、趋势、排行榜、SKU 分析、国家分析。
- 缓存：服务端内存缓存 60 秒，响应带 `s-maxage=60, stale-while-revalidate=300`。

## Shopify 环境变量

```bash
SHOPIFY_SHOP_DOMAIN=your-store.myshopify.com
SHOPIFY_ADMIN_ACCESS_TOKEN=shpat_xxx
SHOPIFY_API_VERSION=2026-07
```

不要把真实 `.env.local` 提交到 GitHub。Shopify Admin Token 必须放在部署平台的环境变量或 GitHub Secrets 里。

注意：GitHub Pages 只适合静态页面，不能安全保存 Shopify Admin Token，也不能运行本项目的 `/api/analytics`、`/api/shopify/sync` 这类服务端接口。生产部署建议使用 Vercel、Netlify、Railway 或自有服务器，并在平台后台配置上述环境变量。

同步接口：

```text
POST /api/shopify/sync
GET  /api/shopify/status
```

## 导出

```text
/api/export?table=sku&format=xlsx
/api/export?table=sku&format=csv
/api/export?table=country&format=xlsx
/api/export?table=country&format=csv
```

## 数据模型

事实表：

```text
FactOrders(OrderId, Date, Country, SKU, ProductTitle, Quantity, SalesAmount, RefundAmount, Currency)
```

维度表：

```text
DimCountry
DimProduct
DimDate
```
