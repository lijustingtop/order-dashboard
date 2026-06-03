<template>
  <main class="app-shell">
    <aside class="filters" aria-label="筛选条件">
      <div class="brand-block">
        <p class="eyebrow">Order Preview</p>
        <h1>订单数据预览</h1>
        <p>{{ dataStatus }}</p>
      </div>

      <label class="file-drop">
        <input type="file" accept=".csv,text/csv" multiple @change="uploadOrderFiles" />
        <span>上传订单 CSV</span>
      </label>

      <section class="filter-group">
        <h2>项目文件夹</h2>
        <p class="folder-hint">{{ ordersDir || "正在读取默认目录" }}</p>
        <div class="file-list">
          <button
            v-for="file in orderFiles"
            :key="file.name"
            class="file-pill"
            :class="{ 'is-active': selectedOrderFiles.includes(file.name) }"
            type="button"
            @click="toggleOrderFile(file.name)"
          >
            {{ file.name }}
          </button>
        </div>
      </section>

      <section class="filter-group">
        <h2>时间范围</h2>
        <label>
          <span>维度</span>
          <select v-model="filters.timeMode">
            <option value="week">星期（周四到周三）</option>
            <option value="month">月份</option>
            <option value="quarter">季度</option>
            <option value="year">年度</option>
          </select>
        </label>
        <label>
          <span>周期</span>
          <select v-model="filters.period">
            <option value="all">全部周期</option>
            <option v-for="period in periods" :key="period" :value="period">{{ period }}</option>
          </select>
        </label>
      </section>

      <section class="filter-group">
        <h2>市场与地区</h2>
        <div>
          <span class="field-title">市场</span>
          <div class="option-grid">
            <button
              v-for="market in marketOptions"
              :key="market.value"
              class="option-button"
              :class="{ 'is-active': filters.market === market.value }"
              type="button"
              @click="selectMarket(market.value)"
            >
              {{ market.label }}
            </button>
          </div>
        </div>
        <div>
          <span class="field-title">地区</span>
          <div class="option-grid compact">
            <button
              v-for="region in regionOptions"
              :key="region.value"
              class="option-button"
              :class="{ 'is-active': filters.region === region.value }"
              type="button"
              @click="filters.region = region.value"
            >
              {{ region.label }}
            </button>
          </div>
        </div>
      </section>

      <section class="filter-group">
        <h2>销售梯度</h2>
        <div class="range-grid">
          <label>
            <span>数量下限</span>
            <input v-model="filters.qtyMin" type="number" min="0" step="1" />
          </label>
          <label>
            <span>数量上限</span>
            <input v-model="filters.qtyMax" type="number" min="0" step="1" />
          </label>
        </div>
        <div class="range-grid">
          <label>
            <span>价格下限</span>
            <input v-model="filters.priceMin" type="number" min="0" step="1" />
          </label>
          <label>
            <span>价格上限</span>
            <input v-model="filters.priceMax" type="number" min="0" step="1" />
          </label>
        </div>
        <button type="button" @click="resetFilters">重置筛选</button>
      </section>
    </aside>

    <section class="workspace">
      <div class="dashboard-grid">
        <section class="center-stage">
          <header class="product-search">
            <div>
              <p class="eyebrow">Product Search</p>
              <h2>商品型号搜索</h2>
            </div>
            <label>
              <span>型号关键词</span>
              <input v-model="filters.query" type="search" list="modelSuggestions" placeholder="搜索 GTi15、SER9、EQ14、Dock..." />
              <datalist id="modelSuggestions">
                <option v-for="model in modelSuggestions" :key="model" :value="model"></option>
              </datalist>
            </label>
            <div class="model-chips">
              <button v-for="chip in modelChips" :key="chip" class="model-chip" type="button" @click="filters.query = chip">{{ chip }}</button>
            </div>
          </header>

          <section class="sales-hero" aria-label="销量总览">
            <div class="sales-main">
              <div>
                <p class="eyebrow">Sales Volume</p>
                <h2>{{ filters.query ? `${filters.query} 销量` : "销量" }}</h2>
              </div>
              <strong>{{ number.format(metrics.units) }}</strong>
              <div class="hero-metrics">
                <article>
                  <span>销售额</span>
                  <b>{{ money.format(metrics.sales) }}</b>
                </article>
                <article>
                  <span>均价</span>
                  <b>{{ metrics.units ? decimalMoney.format(metrics.sales / metrics.units) : "$0" }}</b>
                </article>
              </div>
            </div>
            <div class="share-panel">
              <div class="panel-head">
                <div>
                  <p class="eyebrow">Market Share</p>
                  <h3>市场占比</h3>
                </div>
                <div class="share-toggle" aria-label="市场占比口径">
                  <button :class="{ 'is-active': shareBy === 'units' }" type="button" @click="shareBy = 'units'">销量</button>
                  <button :class="{ 'is-active': shareBy === 'sales' }" type="button" @click="shareBy = 'sales'">销售额</button>
                </div>
              </div>
              <canvas ref="shareCanvas" width="320" height="260" aria-label="市场占比饼图"></canvas>
              <div class="share-legend">
                <div v-for="item in marketShare" :key="item.market" class="share-item">
                  <span><i class="share-dot" :style="{ background: item.color }"></i>{{ item.market }}</span>
                  <strong>{{ shareBy === "sales" ? money.format(item.sales) : `${number.format(item.units)} 件` }} · {{ percent.format(item.value / marketShareTotal) }}</strong>
                </div>
                <div v-if="!marketShare.length" class="empty">暂无市场占比数据</div>
              </div>
            </div>
          </section>

          <section class="single-grid">
            <article class="panel">
              <div class="panel-head">
                <div>
                  <p class="eyebrow">Market</p>
                  <h3>市场销售额</h3>
                </div>
              </div>
              <div class="bars">
                <div v-for="item in marketBars" :key="item.market" class="bar-row">
                  <div class="row-top"><strong>{{ item.market }}</strong><span>{{ number.format(item.units) }} 件 · {{ money.format(item.sales) }}</span></div>
                  <div class="bar-track"><div class="bar-fill" :style="{ width: `${(item.sales / maxMarketSales) * 100}%` }"></div></div>
                </div>
                <div v-if="!marketBars.length" class="empty">暂无市场数据</div>
              </div>
            </article>
          </section>

          <section class="panel table-panel">
            <div class="panel-head">
              <div>
                <p class="eyebrow">Models</p>
                <h3>型号明细</h3>
              </div>
              <div class="sort-control" aria-label="排序方式">
                <button :class="{ 'is-active': sortBy === 'units' }" type="button" @click="sortBy = 'units'">按销量</button>
                <button :class="{ 'is-active': sortBy === 'sales' }" type="button" @click="sortBy = 'sales'">按销售额</button>
              </div>
            </div>
            <span>{{ tableHint }}</span>
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>型号</th>
                    <th>市场</th>
                    <th>地区</th>
                    <th>销量</th>
                    <th>均价</th>
                    <th>销售额</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in modelRows.slice(0, 80)" :key="item.model">
                    <td><div class="model-name">{{ item.model }}</div></td>
                    <td>{{ item.market }}</td>
                    <td>{{ item.countries.join(", ") }}</td>
                    <td>{{ number.format(item.units) }}</td>
                    <td>{{ decimalMoney.format(item.avgPrice) }}</td>
                    <td>{{ money.format(item.sales) }}</td>
                  </tr>
                  <tr v-if="!modelRows.length"><td colspan="6"><div class="empty">没有匹配的订单数据</div></td></tr>
                </tbody>
              </table>
            </div>
          </section>

          <section class="panel table-panel">
            <div class="panel-head">
              <div>
                <p class="eyebrow">Zero Sales</p>
                <h3>未售出型号</h3>
              </div>
              <label class="mini-upload">
                <input type="file" accept=".csv,.txt,text/csv,text/plain" @change="loadInventoryUpload" />
                <span>上传库存清单</span>
              </label>
            </div>
            <div v-if="inventoryFiles.length" class="inventory-source">
              <button
                v-for="file in inventoryFiles"
                :key="file.name"
                class="file-pill"
                :class="{ 'is-active': inventoryFileName === file.name }"
                type="button"
                @click="loadInventoryFromServer(file.name)"
              >
                {{ file.name }}
              </button>
            </div>
            <span>{{ zeroHint }}</span>
            <div class="zero-list">
              <div v-for="model in zeroModels" :key="model" class="zero-item">{{ model }}</div>
              <div v-if="!allModels.length" class="empty">上传或选择库存清单后，这里会显示库存里有、但当前周期没有销量的型号。</div>
              <div v-else-if="!zeroModels.length" class="empty">当前筛选下没有销量为 0 的型号。</div>
            </div>
          </section>
        </section>

        <aside class="right-rail">
          <article class="panel trend-panel">
            <div class="panel-head">
              <div>
                <p class="eyebrow">Price Trend</p>
                <h3>{{ filters.query ? `${filters.query} 价格与销量趋势` : "全部型号价格与销量趋势" }}</h3>
              </div>
              <span>{{ trendPoints.length ? "横轴时间 · 折线趋势" : "无数据" }}</span>
            </div>
            <canvas ref="trendCanvas" width="760" height="340" aria-label="价格趋势图"></canvas>
            <div class="trend-summary">
              <div class="trend-stat"><span>{{ filters.query ? "当前型号" : "全部型号" }}</span><strong>{{ filters.query || `${number.format(new Set(filteredRows.map((row) => row.model)).size)} 个型号` }}</strong></div>
              <div class="trend-stat"><span>总销量</span><strong>{{ number.format(metrics.units) }} 件</strong></div>
              <div class="trend-stat"><span>均价</span><strong>{{ metrics.units ? decimalMoney.format(metrics.sales / metrics.units) : "$0" }}</strong></div>
              <div class="trend-stat"><span>价格范围</span><strong>{{ decimalMoney.format(priceRange.min) }} - {{ decimalMoney.format(priceRange.max) }}</strong></div>
            </div>
          </article>

          <article class="panel">
            <div class="panel-head">
              <div>
                <p class="eyebrow">AI Analysis</p>
                <h3>价格与销量相关性</h3>
              </div>
              <strong id="correlationValue">{{ Number.isFinite(correlation) ? correlation.toFixed(2) : "N/A" }}</strong>
            </div>
            <p class="ai-summary">{{ aiSummary }}</p>
            <div class="bucket-list">
              <div v-for="bucket in buckets" :key="bucket.label" class="bucket">
                <div class="row-top"><strong>{{ bucket.label }}</strong><span>{{ number.format(bucket.units) }} 件 · {{ money.format(bucket.sales) }}</span></div>
                <div class="bar-track"><div class="bar-fill blue" :style="{ width: `${(bucket.units / maxBucketUnits) * 100}%` }"></div></div>
              </div>
            </div>
          </article>
        </aside>
      </div>
    </section>
  </main>
</template>

<script setup>
import { computed, nextTick, onMounted, reactive, ref, watch } from "vue";

const EU_COUNTRIES = new Set(["AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE"]);
const COUNTRY_NAMES = { AU: "澳大利亚", CA: "加拿大", DE: "德国", GB: "英国", JP: "日本", UK: "英国", US: "美国" };
const MARKET_ORDER = ["美国", "欧盟", "英国", "自发货"];
const MARKET_COLORS = { 美国: "#1f7a5a", 欧盟: "#235fa7", 英国: "#a97318", 自发货: "#b34848" };
const BEELINK_MODELS = ["GTR9 Pro AMD Ryzen AI Max+ 395", "GTi15 Ultra Intel Core Ultra 9 285H", "GTi14 Ultra AI PC Intel Core Ultra 9 185H", "GTi13 Ultra Intel Core i9-13900HK", "GTi12 Ultra Intel Core i9-12900HK", "SER10 MAX AMD Ryzen AI 9 HX 470", "SER9 MAX AMD Ryzen 7 H 255/H 260/H 350", "SER9 Pro AMD Ryzen AI 9 HX 370", "SER9 Pro AMD Ryzen AI 9 365", "SER9 Pro AMD Ryzen 7 H 255", "SEi14 Intel Core Ultra 9 185H", "SEi13 Pro Intel Core i9-13900HK / i7-13620H", "SER8 AMD Ryzen 7 8845HS", "SER8 AMD Ryzen 7 8745HS", "EQR7 AMD Ryzen 7 7735HS/7735U", "EQR6 AMD Ryzen 6600U", "EQR5 AMD Ryzen 5 5500U", "EQi13 Pro Intel Core 13500H/13620H", "EQi13 Intel Core 13500H", "EQi12 Intel Core 1235U/1220P", "EQ14 Intel Twin Lake N150", "ME Pro 2-Bay Hybrid NAS Mini PC Intel N95/N150", "ME mini 6-Slot Home Storage NAS PC Intel N95/N150", "EX Mate Pro Laptop Companion", "EX Pro Docking Station", "EX Mate mini 80Gbps Dock for Mac mini M4", "EX Mate Studio 80Gbps SSD Enclosure for Mac Studio", "Mate SE 80Gbps Dock for SER8/SER9/SER10", "Mate MINI S Dock for MINI S12/S12 Pro/MINI S13"];

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const decimalMoney = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const number = new Intl.NumberFormat("zh-CN");
const percent = new Intl.NumberFormat("zh-CN", { style: "percent", maximumFractionDigits: 1 });

const filters = reactive({ timeMode: "week", period: "all", market: "all", region: "all", query: "", qtyMin: "", qtyMax: "", priceMin: "", priceMax: "" });
const rows = ref([]);
const dataStatus = ref("正在读取订单数据");
const orderFiles = ref([]);
const inventoryFiles = ref([]);
const selectedOrderFiles = ref([]);
const ordersDir = ref("");
const inventoryFileName = ref("");
const allModels = ref([]);
const sortBy = ref("units");
const shareBy = ref("units");
const shareCanvas = ref(null);
const trendCanvas = ref(null);
const modelChips = ["GTi15", "GTi14", "SER9", "SER8", "EQ14", "EQi13", "ME Pro", "Dock"];
const staticBase = import.meta.env.BASE_URL;
const dataMode = ref("api");

onMounted(refreshFiles);

watch(() => filters.timeMode, () => {
  filters.period = "all";
});

const marketOptions = computed(() => [{ value: "all", label: "全部市场" }, ...MARKET_ORDER.map((market) => ({ value: market, label: market }))]);
const regionOptions = computed(() => [{ value: "all", label: "全部地区" }, ...getRegionOptions().map((region) => ({ value: region, label: region }))]);
const modelSuggestions = computed(() => [...new Set([...rows.value.map((row) => row.model), ...BEELINK_MODELS])].sort((a, b) => a.localeCompare(b)));
const periods = computed(() => [...new Set(rows.value.map((row) => row[timeKey.value]))].filter(Boolean).sort().reverse());
const timeKey = computed(() => (filters.timeMode === "year" ? "year" : filters.timeMode === "quarter" ? "quarter" : filters.timeMode === "month" ? "month" : "week"));

const filteredRows = computed(() => rows.value.filter((row) => {
  const query = filters.query.trim().toLowerCase();
  if (filters.period !== "all" && row[timeKey.value] !== filters.period) return false;
  if (filters.market !== "all" && row.market !== filters.market) return false;
  if (filters.region !== "all" && !matchesRegion(row, filters.region)) return false;
  if (query && !`${row.model} ${row.fullName} ${row.sku}`.toLowerCase().includes(query)) return false;
  if (!inOptionalRange(row.quantity, filters.qtyMin, filters.qtyMax)) return false;
  if (!inOptionalRange(row.price, filters.priceMin, filters.priceMax)) return false;
  return true;
}));

const metrics = computed(() => ({ units: sum(filteredRows.value, "quantity"), sales: sum(filteredRows.value, "sales") }));
const modelRows = computed(() => summarizeModels(filteredRows.value).sort((a, b) => b[sortBy.value] - a[sortBy.value]));
const tableHint = computed(() => `按${sortBy.value === "sales" ? "销售额" : "销量"}排序，显示前 ${Math.min(modelRows.value.length, 80)} 个`);
const marketBars = computed(() => MARKET_ORDER.map((market) => {
  const items = filteredRows.value.filter((row) => row.market === market);
  return { market, units: sum(items, "quantity"), sales: sum(items, "sales") };
}).filter((item) => item.units || item.sales));
const maxMarketSales = computed(() => Math.max(...marketBars.value.map((item) => item.sales), 1));
const marketShare = computed(() => {
  const key = shareBy.value === "sales" ? "sales" : "quantity";
  return MARKET_ORDER.map((market) => {
    const items = filteredRows.value.filter((row) => row.market === market);
    return { market, value: sum(items, key), units: sum(items, "quantity"), sales: sum(items, "sales"), color: MARKET_COLORS[market] };
  }).filter((item) => item.value > 0);
});
const marketShareTotal = computed(() => sum(marketShare.value, "value"));
const trendPoints = computed(() => groupBy(filteredRows.value, "dateKey").map(([date, items]) => ({ label: date.slice(5), date, units: sum(items, "quantity"), avgPrice: weightedAverage(items), sales: sum(items, "sales") })));
const priceRange = computed(() => {
  const prices = filteredRows.value.map((row) => row.price).filter(Number.isFinite);
  return { min: prices.length ? Math.min(...prices) : 0, max: prices.length ? Math.max(...prices) : 0 };
});
const groupedModels = computed(() => groupBy(filteredRows.value, "model").map(([model, items]) => ({ model, units: sum(items, "quantity"), avgPrice: weightedAverage(items), sales: sum(items, "sales") })).filter((item) => item.units > 0));
const correlation = computed(() => pearson(groupedModels.value.map((item) => item.avgPrice), groupedModels.value.map((item) => item.units)));
const aiSummary = computed(() => makeAiSummary(correlation.value, groupedModels.value));
const buckets = computed(() => [{ label: "$0-299", min: 0, max: 299 }, { label: "$300-599", min: 300, max: 599 }, { label: "$600-999", min: 600, max: 999 }, { label: "$1000+", min: 1000, max: Infinity }].map((bucket) => {
  const items = groupedModels.value.filter((item) => item.avgPrice >= bucket.min && item.avgPrice <= bucket.max);
  return { ...bucket, units: sum(items, "units"), sales: sum(items, "sales") };
}));
const maxBucketUnits = computed(() => Math.max(...buckets.value.map((bucket) => bucket.units), 1));
const zeroModels = computed(() => {
  const soldModels = new Set(filteredRows.value.map((row) => normalizeModelKey(row.model)));
  return allModels.value.filter((model) => !soldModels.has(model));
});
const zeroHint = computed(() => {
  if (!allModels.value.length) return "等待导入库存清单";
  return `${inventoryFileName.value} · ${number.format(zeroModels.value.length)} 个未售出型号`;
});

watch([marketShare, shareBy, shareCanvas], () => nextTick(drawShareChart), { deep: true });
watch([trendPoints, trendCanvas], () => nextTick(drawTrendChart), { deep: true });

async function refreshFiles() {
  const payload = await loadFileManifest();
  orderFiles.value = payload.orders;
  inventoryFiles.value = payload.inventory;
  ordersDir.value = payload.ordersDir;
  selectedOrderFiles.value = payload.orders.map((file) => file.name);
  await loadSelectedOrders();
  if (payload.inventory[0]) await loadInventoryFromServer(payload.inventory[0].name);
}

async function loadSelectedOrders() {
  const sources = await Promise.all(selectedOrderFiles.value.map(async (name) => ({ name, text: await fetchText(dataUrl("orders", name)) })));
  rows.value = sources.flatMap((source) => normalizeCsvSource(source.text, source.name));
  dataStatus.value = sources.length ? `${formatSourceNames(sources.map((source) => source.name))}，合并 ${number.format(rows.value.length)} 行订单商品数据` : "没有选择订单 CSV";
  if (!periods.value.includes(filters.period)) filters.period = "all";
  await nextTick();
  drawShareChart();
  drawTrendChart();
}

async function uploadOrderFiles(event) {
  const files = [...event.target.files].filter((file) => file.name.toLowerCase().endsWith(".csv") || file.type.includes("csv"));
  if (!files.length) return;
  if (dataMode.value === "api") {
    const body = new FormData();
    files.forEach((file) => body.append("files", file));
    await fetch("/api/upload", { method: "POST", body });
    event.target.value = "";
    await refreshFiles();
    return;
  }
  const sources = await Promise.all(files.map(async (file) => ({ name: file.name, text: await file.text() })));
  rows.value = sources.flatMap((source) => normalizeCsvSource(source.text, source.name));
  orderFiles.value = sources.map((source) => ({ name: source.name, size: source.text.length, updatedAt: new Date().toISOString() }));
  selectedOrderFiles.value = sources.map((source) => source.name);
  dataStatus.value = `${formatSourceNames(sources.map((source) => source.name))}，临时读取 ${number.format(rows.value.length)} 行订单商品数据`;
  event.target.value = "";
  await nextTick();
  drawShareChart();
  drawTrendChart();
}

async function toggleOrderFile(name) {
  selectedOrderFiles.value = selectedOrderFiles.value.includes(name) ? selectedOrderFiles.value.filter((item) => item !== name) : [...selectedOrderFiles.value, name];
  await loadSelectedOrders();
}

async function loadInventoryFromServer(name) {
  inventoryFileName.value = name;
  const text = await fetchText(dataUrl("inventory", name));
  allModels.value = parseInventoryModels(text);
}

async function loadFileManifest() {
  try {
    const response = await fetch("/api/files");
    if (!response.ok) throw new Error("api unavailable");
    dataMode.value = "api";
    return await response.json();
  } catch {
    const response = await fetch(`${staticBase}data-manifest.json`);
    if (!response.ok) throw new Error("静态数据清单读取失败");
    const payload = await response.json();
    dataMode.value = "static";
    return payload;
  }
}

function dataUrl(type, name) {
  const encoded = encodeURIComponent(name);
  if (dataMode.value === "api") {
    return type === "inventory" ? `/api/inventory/${encoded}` : `/api/orders/${encoded}`;
  }
  return `${staticBase}data/${type}/${encoded}`;
}

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`读取失败：${url}`);
  return response.text();
}

async function loadInventoryUpload(event) {
  const [file] = event.target.files;
  if (!file) return;
  inventoryFileName.value = file.name;
  allModels.value = parseInventoryModels(await file.text());
  event.target.value = "";
}

function selectMarket(market) {
  filters.market = market;
  filters.region = "all";
}

function resetFilters() {
  Object.assign(filters, { timeMode: "week", period: "all", market: "all", region: "all", query: "", qtyMin: "", qtyMax: "", priceMin: "", priceMax: "" });
}

function normalizeCsvSource(text, sourceName) {
  const records = parseCsv(text);
  const [headers, ...body] = records;
  if (!headers?.length) return [];
  let lastCountry = "";
  return body.map((values) => {
    const row = normalizeRow(headers, values, lastCountry);
    row.sourceFile = sourceName;
    if (row.country) lastCountry = row.country;
    return row;
  }).filter((row) => row.createdAt && !Number.isNaN(row.createdAt.getTime()) && row.quantity > 0 && row.price >= 0 && !isAccessoryModel(row));
}

function normalizeRow(headers, values, fallbackCountry) {
  const source = Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]));
  const country = (source["Shipping Country"] || source["Billing Country"] || fallbackCountry || "").toUpperCase();
  const province = source["Shipping Province Name"] || source["Shipping Province"] || source["Billing Province Name"] || source["Billing Province"] || "";
  const createdAt = parseShopifyDate(source["Created at"] || source["Paid at"]);
  const quantity = toNumber(source["Lineitem quantity"]);
  const price = toNumber(source["Lineitem price"]);
  const name = source["Lineitem name"] || "未命名商品";
  return {
    order: source.Name,
    createdAt,
    dateKey: formatDate(createdAt),
    year: String(createdAt.getFullYear()),
    quarter: `${createdAt.getFullYear()} Q${Math.floor(createdAt.getMonth() / 3) + 1}`,
    month: `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, "0")}`,
    week: getThursdayWeek(createdAt),
    country,
    countryName: COUNTRY_NAMES[country] || country || "未知",
    market: getMarket(country),
    region: getRegion(country, province),
    model: modelFromSku(source["Lineitem sku"], name),
    fullName: name,
    sku: source["Lineitem sku"],
    province,
    quantity,
    price,
    sales: quantity * price,
    orderTotal: toNumber(source.Total),
  };
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && inQuotes && next === '"') {
      field += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(field);
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function parseInventoryModels(text) {
  const records = parseCsv(text.trim());
  if (!records.length) return [];
  const headers = records[0].map((header) => header.trim().toLowerCase());
  const modelColumn = headers.findIndex((header) => ["sku", "model", "型号", "商品型号", "lineitem sku", "product", "产品", "产品型号"].some((keyword) => header.includes(keyword)));
  const dataRows = modelColumn >= 0 ? records.slice(1) : records;
  const columnIndex = modelColumn >= 0 ? modelColumn : 0;
  return [...new Set(dataRows.map((row) => row[columnIndex] || row.find((cell) => String(cell || "").trim())).map((value) => normalizeModelKey(value)).filter((model) => model && !model.toLowerCase().includes("accessories")))].sort((a, b) => a.localeCompare(b));
}

function drawShareChart() {
  const canvas = shareCanvas.value;
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) * 0.38;
  ctx.clearRect(0, 0, width, height);
  if (!marketShare.value.length || !marketShareTotal.value) {
    ctx.fillStyle = "#64706d";
    ctx.font = "18px sans-serif";
    ctx.fillText("暂无数据", centerX - 34, centerY);
    return;
  }
  let start = -Math.PI / 2;
  marketShare.value.forEach((item) => {
    const angle = (item.value / marketShareTotal.value) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, start, start + angle);
    ctx.closePath();
    ctx.fillStyle = item.color;
    ctx.fill();
    start += angle;
  });
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius * 0.58, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.fillStyle = "#19201f";
  ctx.font = "700 20px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(shareBy.value === "sales" ? "销售额" : "销量", centerX, centerY - 4);
  ctx.fillStyle = "#64706d";
  ctx.font = "15px sans-serif";
  ctx.fillText("占比", centerX, centerY + 18);
  ctx.textAlign = "start";
}

function drawTrendChart() {
  const canvas = trendCanvas.value;
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const points = trendPoints.value;
  const width = canvas.width;
  const height = canvas.height;
  const pad = { top: 24, right: 46, bottom: 44, left: 58 };
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#fcfdfc";
  ctx.fillRect(0, 0, width, height);
  if (!points.length) {
    ctx.fillStyle = "#64706d";
    ctx.font = "22px sans-serif";
    ctx.fillText("暂无可展示数据", 40, 80);
    return;
  }
  const priceMax = Math.max(...points.map((point) => point.avgPrice), 1);
  const unitMax = Math.max(...points.map((point) => point.units), 1);
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  ctx.strokeStyle = "#dce4df";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i += 1) {
    const y = pad.top + (plotH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(width - pad.right, y);
    ctx.stroke();
  }
  drawSeries(ctx, points, (point) => point.avgPrice / priceMax, "#1f7a5a", pad, plotW, plotH);
  drawSeries(ctx, points, (point) => point.units / unitMax, "#235fa7", pad, plotW, plotH);
  ctx.fillStyle = "#34413d";
  ctx.font = "18px sans-serif";
  ctx.fillText("均价", pad.left, 22);
  ctx.fillStyle = "#235fa7";
  ctx.fillText("销量", pad.left + 58, 22);
  ctx.fillStyle = "#64706d";
  ctx.font = "16px sans-serif";
  points.forEach((point, index) => {
    const x = pad.left + (points.length === 1 ? plotW / 2 : (plotW / (points.length - 1)) * index);
    ctx.fillText(point.label, x - 18, height - 16);
  });
}

function drawSeries(ctx, points, scaleValue, color, pad, plotW, plotH) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 4;
  ctx.beginPath();
  points.forEach((point, index) => {
    const x = pad.left + (points.length === 1 ? plotW / 2 : (plotW / (points.length - 1)) * index);
    const y = pad.top + plotH - scaleValue(point) * plotH;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  points.forEach((point, index) => {
    const x = pad.left + (points.length === 1 ? plotW / 2 : (plotW / (points.length - 1)) * index);
    const y = pad.top + plotH - scaleValue(point) * plotH;
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
  });
}

function getRegionOptions() {
  if (filters.market === "美国") return ["美国"];
  if (filters.market === "英国") return ["英国"];
  if (filters.market === "欧盟") return ["欧盟", "德国", "法国", "意大利", "欧盟（德国除外）"];
  if (filters.market === "自发货") return ["加拿大", "日本", "新加坡", "自发货"];
  return [...new Set(rows.value.map((row) => row.region))].filter((region) => region !== "自发货").sort((a, b) => a.localeCompare(b));
}

function formatSourceNames(names) {
  if (names.length <= 2) return names.join(" + ");
  return `${names.slice(0, 2).join(" + ")} 等 ${names.length} 个文件`;
}

function parseShopifyDate(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2}) ([+-]\d{4})$/);
  if (!match) return new Date(value);
  const [, year, month, day, hour, minute, second] = match;
  return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
}

function toNumber(value) {
  const parsed = Number(String(value || "0").replace(/[$,']/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function getMarket(country) {
  if (country === "US") return "美国";
  if (country === "GB" || country === "UK") return "英国";
  if (country === "DE" || EU_COUNTRIES.has(country)) return "欧盟";
  return "自发货";
}

function getRegion(country) {
  if (country === "US") return "美国";
  if (country === "GB" || country === "UK") return "英国";
  if (country === "DE") return "德国";
  if (country === "FR") return "法国";
  if (country === "IT") return "意大利";
  if (EU_COUNTRIES.has(country)) return "欧盟（德国除外）";
  if (country === "CA") return "加拿大";
  if (country === "JP") return "日本";
  if (country === "SG") return "新加坡";
  return "自发货";
}

function modelFromSku(sku, name) {
  const cleanedSku = String(sku || "").trim();
  if (cleanedSku && cleanedSku.toLowerCase() !== "accessories") return normalizeModelKey(cleanedSku);
  return normalizeModelKey(name.replace(/^Beelink\s+/i, "").replace(/^【Contact US】Accessories\s*-\s*/i, "").split(" - ")[0].trim());
}

function isAccessoryModel(row) {
  return `${row.model} ${row.fullName} ${row.sku}`.toLowerCase().includes("accessories");
}

function normalizeModelKey(value) {
  return String(value || "").trim().replace(/^BL\//i, "").replace(/[（(].*?[）)]/g, "").split("/").map((part) => part.replace(/[_-]?[A-Z]??(美规|欧规|英规|日规|澳规|加拿大规|国规)$/i, "").trim()).filter((part) => part && !/(美规|欧规|英规|日规|澳规|加拿大规|国规)/i.test(part)).join("/");
}

function getThursdayWeek(date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 3) % 7));
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return `${formatDate(start)} 至 ${formatDate(end)}`;
}

function formatDate(date) {
  if (!date || Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function matchesRegion(row, region) {
  if (region === "欧盟") return row.market === "欧盟";
  if (region === "自发货") return row.market === "自发货" && !["加拿大", "日本", "新加坡"].includes(row.region);
  return row.region === region;
}

function inOptionalRange(value, min, max) {
  const parsedMin = min === "" ? null : Number(min);
  const parsedMax = max === "" ? null : Number(max);
  return (parsedMin === null || value >= parsedMin) && (parsedMax === null || value <= parsedMax);
}

function summarizeModels(items) {
  return groupBy(items, "model").map(([model, group]) => ({ model, market: topValue(group.map((item) => item.market)), countries: [...new Set(group.map((item) => item.region))].sort(), units: sum(group, "quantity"), avgPrice: weightedAverage(group), sales: sum(group, "sales") }));
}

function groupBy(items, key) {
  const map = new Map();
  items.forEach((item) => {
    const value = item[key];
    if (!map.has(value)) map.set(value, []);
    map.get(value).push(item);
  });
  return [...map.entries()].sort(([a], [b]) => String(a).localeCompare(String(b)));
}

function sum(items, key) {
  return items.reduce((total, item) => total + Number(item[key] || 0), 0);
}

function weightedAverage(items) {
  const units = sum(items, "quantity");
  return units ? sum(items, "sales") / units : 0;
}

function topValue(values) {
  const counts = new Map();
  values.forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "";
}

function pearson(xs, ys) {
  if (xs.length !== ys.length || xs.length < 2) return NaN;
  const xMean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const yMean = ys.reduce((a, b) => a + b, 0) / ys.length;
  let numerator = 0;
  let xDenominator = 0;
  let yDenominator = 0;
  xs.forEach((x, index) => {
    const xDiff = x - xMean;
    const yDiff = ys[index] - yMean;
    numerator += xDiff * yDiff;
    xDenominator += xDiff * xDiff;
    yDenominator += yDiff * yDiff;
  });
  return numerator / Math.sqrt(xDenominator * yDenominator);
}

function makeAiSummary(value, grouped) {
  if (grouped.length < 3 || !Number.isFinite(value)) return "当前筛选下型号数量偏少，相关性只适合作为方向参考。建议至少覆盖更多天数或更多型号后再判断价格对销量的影响。";
  const direction = value <= -0.35 ? "价格越低销量越高的迹象较明显" : value >= 0.35 ? "高价型号也能带来较高销量，说明型号吸引力可能强于价格阻力" : "价格和销量之间没有明显线性关系";
  const top = [...grouped].sort((a, b) => b.units - a.units)[0];
  return `基于当前筛选型号的均价和销量计算，相关系数为 ${value.toFixed(2)}，${direction}。销量最高的是 ${top.model}，销量 ${top.units} 件，均价 ${decimalMoney.format(top.avgPrice)}。这不是外部 AI 调用，而是页面内置的统计分析结论。`;
}
</script>
