<template>
  <main class="app-shell">
    <aside class="filters" aria-label="筛选条件">
      <div class="brand-block">
        <p class="eyebrow">Order Preview</p>
        <h1>订单数据预览</h1>
        <p>{{ dataStatus }}</p>
      </div>

      <label class="file-drop">
        <input type="file" accept=".csv,.xlsx,.xls,text/csv" multiple @change="uploadOrderFiles" />
        <span>上传订单文件</span>
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
        <h2>国家</h2>
        <div>
          <span class="field-title">国家/地区</span>
          <input v-model="countrySearch" type="search" placeholder="搜索国家，比如 美国、德国..." />
          <div class="option-grid compact country-scroll">
            <button
              v-for="country in countryOptions"
              :key="country.value"
              class="option-button"
              :class="{ 'is-active': filters.country === country.value }"
              type="button"
              @click="filters.country = country.value"
            >
              {{ country.label }}
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
      <nav class="view-nav" aria-label="页面导航">
        <button :class="{ 'is-active': activeView === 'overview' }" type="button" @click="activeView = 'overview'">总览</button>
        <button :class="{ 'is-active': activeView === 'trend' }" type="button" @click="activeView = 'trend'">趋势</button>
        <button :class="{ 'is-active': activeView === 'customers' }" type="button" @click="activeView = 'customers'">客户</button>
        <button :class="{ 'is-active': activeView === 'inventory' }" type="button" @click="activeView = 'inventory'">库存</button>
        <button :class="{ 'is-active': activeView === 'refunds' }" type="button" @click="activeView = 'refunds'">退款优惠</button>
      </nav>

      <div v-if="activeView === 'overview'" class="dashboard-grid">
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

          <section class="panel ranking-panel">
            <div class="panel-head">
              <div>
                <p class="eyebrow">Ranking</p>
                <h3>{{ rankingTitle }}</h3>
              </div>
              <div class="sort-control" aria-label="排序方式">
                <button :class="{ 'is-active': rankingMode === 'country' }" type="button" @click="setRankingMode('country')">国家</button>
                <button :class="{ 'is-active': rankingMode === 'model' }" type="button" @click="setRankingMode('model')">机型</button>
                <button :class="{ 'is-active': sortBy === 'units' }" type="button" @click="sortBy = 'units'">按销量</button>
                <button :class="{ 'is-active': sortBy === 'sales' }" type="button" @click="sortBy = 'sales'">按销售额</button>
              </div>
            </div>
            <span>{{ rankingHint }}</span>
            <div class="ranking-list">
              <article v-for="item in rankingRows" :key="item.key" class="ranking-card">
                <div class="ranking-main" role="button" tabindex="0" @click="toggleRanking(item.key)" @keydown.enter.prevent="toggleRanking(item.key)" @keydown.space.prevent="toggleRanking(item.key)">
                  <span class="rank-no">{{ item.rank }}</span>
                  <button
                    v-if="rankingMode === 'model'"
                    class="rank-name model-link"
                    type="button"
                    :title="modelInfoTitle(item.name)"
                    @click.stop="openModelTrend(item.name)"
                  >
                    {{ item.name }}
                  </button>
                  <span v-else class="rank-name">{{ item.name }}</span>
                  <span class="rank-metric">{{ number.format(item.units) }} 件</span>
                  <span class="rank-metric">{{ money.format(item.sales) }}</span>
                </div>
                <div class="bar-track"><div class="bar-fill" :style="{ width: `${(item[sortBy] / maxRankingValue) * 100}%` }"></div></div>
                <div v-if="expandedRankingKey === item.key" class="ranking-detail">
                  <div v-for="detail in item.details" :key="detail.name" class="detail-row">
                    <button
                      v-if="rankingMode === 'country'"
                      class="model-link"
                      type="button"
                      :title="modelInfoTitle(detail.name)"
                      @click="openModelTrend(detail.name)"
                    >
                      {{ detail.name }}
                    </button>
                    <span v-else>{{ detail.name }}</span>
                    <strong>{{ number.format(detail.units) }} 件 · {{ money.format(detail.sales) }}</strong>
                  </div>
                  <div v-if="!item.details.length" class="empty">暂无可展开数据</div>
                </div>
              </article>
              <div v-if="!rankingRows.length" class="empty">没有匹配的订单数据</div>
            </div>
          </section>
        </section>

      </div>

      <section v-else-if="activeView === 'trend'" class="trend-view">
        <header class="product-search">
          <div>
            <p class="eyebrow">Product Search</p>
            <h2>商品型号搜索</h2>
          </div>
          <label>
            <span>型号关键词</span>
            <input v-model="filters.query" type="search" list="modelSuggestions" placeholder="搜索 GTi15、SER9、EQ14、Dock..." />
          </label>
          <div class="model-chips">
            <button v-for="chip in modelChips" :key="chip" class="model-chip" type="button" @click="filters.query = chip">{{ chip }}</button>
          </div>
        </header>

        <header class="panel trend-header">
          <div>
            <p class="eyebrow">Trend</p>
            <h2>{{ trendPeriodTitle }}</h2>
            <p>{{ trendPeriodHint }}</p>
          </div>
          <div class="trend-kpis">
            <article>
              <span>总销量</span>
              <strong>{{ number.format(trendOverallTotals.units) }}</strong>
              <small>环比 {{ formatChange(trendOverallTotals.unitsMom) }} · 同比 {{ formatChange(trendOverallTotals.unitsYoy) }}</small>
            </article>
            <article>
              <span>总销售额</span>
              <strong>{{ money.format(trendOverallTotals.sales) }}</strong>
              <small>环比 {{ formatChange(trendOverallTotals.salesMom) }} · 同比 {{ formatChange(trendOverallTotals.salesYoy) }}</small>
            </article>
          </div>
        </header>

        <section class="panel country-line-panel">
          <div class="panel-head">
            <div>
              <p class="eyebrow">Line Chart</p>
              <h3>{{ filters.query ? `${filters.query} 销量与销售额趋势` : "整体销量与销售额趋势" }}</h3>
            </div>
            <div class="sort-control" aria-label="趋势指标">
              <button :class="{ 'is-active': trendMetric === 'units' }" type="button" @click="trendMetric = 'units'">{{ selectedTrendModel ? "国家按销量" : "明细按销量" }}</button>
              <button :class="{ 'is-active': trendMetric === 'sales' }" type="button" @click="trendMetric = 'sales'">{{ selectedTrendModel ? "国家按销售额" : "明细按销售额" }}</button>
              <button v-if="selectedTrendModel" :class="{ 'is-active': trendSortAsc }" type="button" @click="trendSortAsc = !trendSortAsc">{{ trendSortAsc ? "低到高" : "高到低" }}</button>
            </div>
          </div>
          <div class="chart-scroll">
            <canvas ref="countryTrendCanvas" :width="trendChartWidth" height="420" aria-label="销量与销售额趋势折线图"></canvas>
          </div>
          <div class="line-legend">
            <span v-for="item in trendSeries.series" :key="item.name">
              <i :style="{ background: item.color }"></i>{{ item.name }}
            </span>
            <span v-if="filters.query"><i class="price-dot"></i>虚线：单价趋势</span>
          </div>
        </section>

        <section class="panel table-panel">
          <div class="panel-head">
            <div>
              <p class="eyebrow">Comparison</p>
              <h3>趋势明细</h3>
            </div>
            <span>{{ trendCompareLabels.previous }} / {{ trendCompareLabels.lastYear }}</span>
          </div>
          <div class="table-wrap">
            <table class="trend-table">
              <thead>
                <tr>
                  <th>{{ selectedTrendModel ? "国家" : "机型" }}</th>
                  <th>销量</th>
                  <th>销量环比</th>
                  <th>销量同比</th>
                  <th>销售额</th>
                  <th>销售额环比</th>
                  <th>销售额同比</th>
                  <th>均价</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in trendRows" :key="item.name">
                  <td>
                    <div v-if="selectedTrendModel" class="model-name">{{ item.name }}</div>
                    <button v-else class="model-name model-link" type="button" :title="modelInfoTitle(item.name)" @click="openModelTrend(item.name)">{{ item.name }}</button>
                  </td>
                  <td>{{ number.format(item.units) }}</td>
                  <td><span :class="changeClass(item.unitsMom)">{{ formatChange(item.unitsMom) }}</span></td>
                  <td><span :class="changeClass(item.unitsYoy)">{{ formatChange(item.unitsYoy) }}</span></td>
                  <td>{{ money.format(item.sales) }}</td>
                  <td><span :class="changeClass(item.salesMom)">{{ formatChange(item.salesMom) }}</span></td>
                  <td><span :class="changeClass(item.salesYoy)">{{ formatChange(item.salesYoy) }}</span></td>
                  <td>{{ decimalMoney.format(item.avgPrice) }}</td>
                </tr>
                <tr v-if="!trendRows.length"><td colspan="8"><div class="empty">没有匹配的趋势数据</div></td></tr>
              </tbody>
            </table>
          </div>
        </section>

        <section v-if="selectedTrendModel" class="panel table-panel">
          <div class="panel-head">
            <div>
              <p class="eyebrow">Price History</p>
              <h3>{{ selectedTrendModel }} 价格变化</h3>
            </div>
            <span>{{ number.format(priceHistoryRows.length) }} 个成交日期</span>
          </div>
          <div class="table-wrap compact-table">
            <table>
              <thead>
                <tr>
                  <th>日期</th>
                  <th>均价</th>
                  <th>销量</th>
                  <th>销售额</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in priceHistoryRows" :key="item.dateKey">
                  <td>{{ item.dateKey }}</td>
                  <td>{{ decimalMoney.format(item.avgPrice) }}</td>
                  <td>{{ number.format(item.units) }}</td>
                  <td>{{ money.format(item.sales) }}</td>
                </tr>
                <tr v-if="!priceHistoryRows.length"><td colspan="4"><div class="empty">没有价格变化数据</div></td></tr>
              </tbody>
            </table>
          </div>
        </section>
      </section>

      <section v-else-if="activeView === 'customers'" class="trend-view">
        <section class="panel customer-panel">
          <div class="panel-head">
            <div>
              <p class="eyebrow">Customers</p>
              <h3>客户{{ customerMetric === "sales" ? "销售额" : "销量" }} Top 10</h3>
            </div>
            <div class="sort-control" aria-label="客户排序">
              <button :class="{ 'is-active': customerMetric === 'units' }" type="button" @click="customerMetric = 'units'">销量</button>
              <button :class="{ 'is-active': customerMetric === 'sales' }" type="button" @click="customerMetric = 'sales'">销售额</button>
            </div>
          </div>
          <div class="ranking-list">
            <article v-for="customer in customerRows" :key="customer.key" class="ranking-card">
              <button class="ranking-main" type="button" @click="toggleCustomer(customer.key)">
                <span class="rank-no">{{ customer.rank }}</span>
                <span class="rank-name">{{ customer.name }}<small v-if="customer.customerName"> · {{ customer.customerName }}</small></span>
                <span class="rank-metric">{{ number.format(customer.units) }} 件</span>
                <span class="rank-metric">{{ money.format(customer.sales) }}</span>
              </button>
              <div v-if="expandedCustomerKey === customer.key" class="ranking-detail">
                <div v-for="detail in customer.details" :key="detail.key" class="detail-row detail-row-stack">
                  <button class="model-link" type="button" :title="modelInfoTitle(detail.model)" @click="openModelTrend(detail.model)">{{ detail.time }} · {{ detail.model }}</button>
                  <strong>{{ number.format(detail.units) }} 件 · {{ decimalMoney.format(detail.price) }}</strong>
                </div>
              </div>
            </article>
            <div v-if="!customerRows.length" class="empty">没有客户数据</div>
          </div>
        </section>
      </section>

      <section v-else-if="activeView === 'inventory'" class="trend-view">
        <section class="panel inventory-panel">
          <div class="panel-head">
            <div>
              <p class="eyebrow">Inventory</p>
              <h3>库存和未出售机型</h3>
            </div>
            <label class="mini-upload">
              <input type="file" accept=".csv,.xlsx,.xls,.txt,text/csv,text/plain" @change="loadInventoryUpload" />
              <span>上传库存表</span>
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
          <header class="product-search inventory-search">
            <div>
              <p class="eyebrow">Model Search</p>
              <h2>库存机型搜索</h2>
            </div>
            <label>
              <span>型号关键词</span>
              <input v-model="inventorySearch" type="search" list="modelSuggestions" placeholder="搜索库存机型..." />
            </label>
          </header>
          <span>{{ inventoryHint }}</span>
          <div class="inventory-grid">
            <article v-for="item in inventoryRows" :key="item.model" class="inventory-card" :title="inventoryTooltip(item)" @click="openModelTrend(item.model)">
              <button class="model-link inventory-model-link" type="button" @click.stop="openModelTrend(item.model)">{{ item.model }}</button>
              <span>库存 {{ number.format(item.stock) }} · 已售 {{ number.format(item.units) }}</span>
              <small>{{ item.warehouse || "未指定仓库" }} · {{ item.market || "未映射市场" }} · {{ item.productionStatus || "未标注状态" }}</small>
            </article>
            <div v-if="!inventoryRows.length" class="empty">上传或选择库存表后显示库存；没有数量列时先按 0 库存展示。</div>
          </div>
        </section>

        <section class="panel inventory-panel">
          <div class="panel-head">
            <div>
              <p class="eyebrow">Slow Moving</p>
              <h3>滞销产品</h3>
            </div>
            <span>{{ number.format(staleInventoryRows.length) }} 个</span>
          </div>
          <div class="inventory-grid">
            <article v-for="item in staleInventoryRows" :key="item.model" class="inventory-card is-warning" :title="inventoryTooltip(item)" @click="openModelTrend(item.model)">
              <button class="model-link inventory-model-link" type="button" @click.stop="openModelTrend(item.model)">{{ item.model }}</button>
              <span>库存 {{ number.format(item.stock) }} · 最近两次销售间隔 {{ item.saleGapDays }} 天</span>
              <small>{{ item.productionStatus || "未标注状态" }}</small>
            </article>
            <div v-if="!staleInventoryRows.length" class="empty">暂无满足“有库存且最近两次销售间隔超过 90 天”的机型。</div>
          </div>
        </section>
      </section>

      <section v-else class="trend-view">
        <section class="panel table-panel">
          <div class="panel-head">
            <div>
              <p class="eyebrow">Refunds</p>
              <h3>退款明细</h3>
            </div>
            <span>{{ number.format(refundRows.length) }} 笔 · {{ money.format(refundTotal) }}</span>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>订单</th>
                  <th>时间</th>
                  <th>客户</th>
                  <th>退款金额</th>
                  <th>退款理由</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in refundRows" :key="item.order">
                  <td>{{ item.order }}</td>
                  <td>{{ item.dateKey }}</td>
                  <td>{{ item.customerName }}</td>
                  <td>{{ money.format(item.refundedAmount) }}</td>
                  <td>{{ item.reason || "未填写" }}</td>
                </tr>
                <tr v-if="!refundRows.length"><td colspan="5"><div class="empty">没有退款数据</div></td></tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="panel table-panel">
          <div class="panel-head">
            <div>
              <p class="eyebrow">Coupons</p>
              <h3>优惠券明细</h3>
            </div>
            <span>{{ number.format(couponRows.length) }} 个优惠码 · {{ money.format(couponTotal) }}</span>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>优惠码</th>
                  <th>优惠金额</th>
                  <th>订单数</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in couponRows" :key="item.code">
                  <td>{{ item.code }}</td>
                  <td>{{ money.format(item.amount) }}</td>
                  <td>{{ number.format(item.orders) }}</td>
                </tr>
                <tr v-if="!couponRows.length"><td colspan="3"><div class="empty">没有优惠码数据</div></td></tr>
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </section>
  </main>
</template>

<script setup>
import { computed, nextTick, onMounted, reactive, ref, watch } from "vue";
import * as XLSX from "xlsx";

const EU_COUNTRIES = new Set(["AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE"]);
const COUNTRY_NAMES = { GB: "英国", UK: "英国", US: "美国" };
const MARKET_ORDER = ["美国市场", "欧盟市场", "英国市场", "自发货市场"];
const MARKET_COLORS = { 美国市场: "#1f7a5a", 欧盟市场: "#235fa7", 英国市场: "#a97318", 自发货市场: "#b34848" };
const BEELINK_MODELS = ["GTR9 Pro AMD Ryzen AI Max+ 395", "GTi15 Ultra Intel Core Ultra 9 285H", "GTi14 Ultra AI PC Intel Core Ultra 9 185H", "GTi13 Ultra Intel Core i9-13900HK", "GTi12 Ultra Intel Core i9-12900HK", "SER10 MAX AMD Ryzen AI 9 HX 470", "SER9 MAX AMD Ryzen 7 H 255/H 260/H 350", "SER9 Pro AMD Ryzen AI 9 HX 370", "SER9 Pro AMD Ryzen AI 9 365", "SER9 Pro AMD Ryzen 7 H 255", "SEi14 Intel Core Ultra 9 185H", "SEi13 Pro Intel Core i9-13900HK / i7-13620H", "SER8 AMD Ryzen 7 8845HS", "SER8 AMD Ryzen 7 8745HS", "EQR7 AMD Ryzen 7 7735HS/7735U", "EQR6 AMD Ryzen 6600U", "EQR5 AMD Ryzen 5 5500U", "EQi13 Pro Intel Core 13500H/13620H", "EQi13 Intel Core 13500H", "EQi12 Intel Core 1235U/1220P", "EQ14 Intel Twin Lake N150", "ME Pro 2-Bay Hybrid NAS Mini PC Intel N95/N150", "ME mini 6-Slot Home Storage NAS PC Intel N95/N150", "EX Mate Pro Laptop Companion", "EX Pro Docking Station", "EX Mate mini 80Gbps Dock for Mac mini M4", "EX Mate Studio 80Gbps SSD Enclosure for Mac Studio", "Mate SE 80Gbps Dock for SER8/SER9/SER10", "Mate MINI S Dock for MINI S12/S12 Pro/MINI S13"];

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const decimalMoney = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const number = new Intl.NumberFormat("zh-CN");
const percent = new Intl.NumberFormat("zh-CN", { style: "percent", maximumFractionDigits: 1 });
const regionNames = new Intl.DisplayNames(["zh-CN"], { type: "region" });

const filters = reactive({ timeMode: "week", period: "all", country: "all", query: "", qtyMin: "", qtyMax: "", priceMin: "", priceMax: "" });
const rows = ref([]);
const allOrderRows = ref([]);
const dataStatus = ref("正在读取订单数据");
const orderFiles = ref([]);
const inventoryFiles = ref([]);
const selectedOrderFiles = ref([]);
const ordersDir = ref("");
const inventoryFileName = ref("");
const inventoryItems = ref([]);
const sortBy = ref("units");
const shareBy = ref("units");
const activeView = ref("overview");
const trendMetric = ref("units");
const trendSortAsc = ref(true);
const customerMetric = ref("sales");
const countrySearch = ref("");
const inventorySearch = ref("");
const rankingMode = ref("country");
const expandedRankingKey = ref("");
const expandedCustomerKey = ref("");
const shareCanvas = ref(null);
const trendCanvas = ref(null);
const countryTrendCanvas = ref(null);
const modelChips = ["GTi15", "GTi14", "SER9", "SER8", "EQ14", "EQi13", "ME Pro", "Dock"];
const staticBase = import.meta.env.BASE_URL;
const dataMode = ref("api");

onMounted(refreshFiles);

watch(() => filters.timeMode, () => {
  filters.period = "all";
});

const rankedCountries = computed(() => summarizeCountries(rows.value.filter((row) => matchesCountryRankingFilters(row)))
  .sort((a, b) => b.units - a.units || a.country.localeCompare(b.country)));
const countryOptions = computed(() => {
  const query = countrySearch.value.trim().toLowerCase();
  const options = rankedCountries.value
    .filter((country) => !query || country.country.toLowerCase().includes(query))
    .map((country) => ({ value: country.country, label: country.country }));
  return [{ value: "all", label: "全部国家" }, ...options];
});
const modelSuggestions = computed(() => [...new Set([...rows.value.map((row) => row.model), ...BEELINK_MODELS])].sort((a, b) => a.localeCompare(b)));
const periods = computed(() => [...new Set(rows.value.map((row) => row[timeKey.value]))].filter(Boolean).sort().reverse());
const timeKey = computed(() => (filters.timeMode === "year" ? "year" : filters.timeMode === "quarter" ? "quarter" : filters.timeMode === "month" ? "month" : "week"));

const filteredRows = computed(() => rows.value.filter((row) => {
  const query = filters.query.trim().toLowerCase();
  if (filters.period !== "all" && row[timeKey.value] !== filters.period) return false;
  if (filters.country !== "all" && row.countryName !== filters.country) return false;
  if (query && !`${row.model} ${row.fullName} ${row.sku}`.toLowerCase().includes(query)) return false;
  if (!inOptionalRange(row.quantity, filters.qtyMin, filters.qtyMax)) return false;
  if (!inOptionalRange(row.price, filters.priceMin, filters.priceMax)) return false;
  return true;
}));
const comparisonRows = computed(() => rows.value.filter((row) => matchesNonPeriodFilters(row)));

const metrics = computed(() => ({ units: sum(filteredRows.value, "quantity"), sales: sum(filteredRows.value, "sales") }));
const modelRows = computed(() => summarizeModels(filteredRows.value).sort((a, b) => b[sortBy.value] - a[sortBy.value]));
const tableHint = computed(() => `按${sortBy.value === "sales" ? "销售额" : "销量"}排序，显示前 ${Math.min(modelRows.value.length, 80)} 个`);
const countryBars = computed(() => summarizeCountries(filteredRows.value).sort((a, b) => b.sales - a.sales).slice(0, 10));
const maxMarketSales = computed(() => Math.max(...countryBars.value.map((item) => item.sales), 1));
const marketShare = computed(() => {
  const key = shareBy.value === "sales" ? "sales" : "quantity";
  return summarizeMarkets(filteredRows.value)
    .map((item) => ({ ...item, value: key === "sales" ? item.sales : item.units }))
    .map((item) => ({ ...item, color: MARKET_COLORS[item.market] || "#4f6f61" }))
    .filter((item) => item.value > 0);
});
const marketShareTotal = computed(() => sum(marketShare.value, "value"));
const rankingTitle = computed(() => `${rankingMode.value === "country" ? "国家" : "机型"}${sortBy.value === "sales" ? "销售额" : "销量"} Top 10`);
const rankingHint = computed(() => `点击${rankingMode.value === "country" ? "国家可展开该国家的所有机型" : "机型可展开售卖国家"}。`);
const rankingRows = computed(() => {
  const rowsForRanking = rankingMode.value === "country"
    ? summarizeCountries(filteredRows.value).map((item) => ({
      key: `country:${item.country}`,
      name: item.country,
      ...item,
      details: summarizeModels(filteredRows.value.filter((row) => row.countryName === item.country))
        .sort((a, b) => b[sortBy.value] - a[sortBy.value])
        .map((detail) => ({ name: detail.model, units: detail.units, sales: detail.sales })),
    }))
    : summarizeModels(filteredRows.value).map((item) => ({
      key: `model:${item.model}`,
      name: item.model,
      ...item,
      details: summarizeCountries(filteredRows.value.filter((row) => row.model === item.model))
        .sort((a, b) => b[sortBy.value] - a[sortBy.value])
        .map((detail) => ({ name: detail.country, units: detail.units, sales: detail.sales })),
    }));
  return rowsForRanking
    .sort((a, b) => b[sortBy.value] - a[sortBy.value] || a.name.localeCompare(b.name))
    .slice(0, 10)
    .map((item, index) => ({ ...item, rank: index + 1 }));
});
const maxRankingValue = computed(() => Math.max(...rankingRows.value.map((item) => item[sortBy.value]), 1));
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
const activeTrendPeriod = computed(() => filters.period === "all" ? periods.value[0] || "" : filters.period);
const trendCompareLabels = computed(() => {
  const period = activeTrendPeriod.value;
  return {
    current: period || "暂无周期",
    previous: previousPeriod(period, filters.timeMode) || "上一周期无数据",
    lastYear: yearAgoPeriod(period, filters.timeMode) || "去年同期无数据",
  };
});
const trendPeriodTitle = computed(() => `${timeModeLabel(filters.timeMode)}趋势 · ${trendCompareLabels.value.current}`);
const trendPeriodHint = computed(() => {
  if (!activeTrendPeriod.value) return "等待订单数据加载后生成趋势。";
  const currentText = filters.period === "all" ? "当前未指定周期，自动使用最新周期" : "跟随左侧选定周期";
  const modelText = filters.query ? `当前展示 ${filters.query} 的单独趋势。` : "当前展示整体销量和销售额趋势。";
  return `${modelText}${currentText}；环比对比 ${trendCompareLabels.value.previous}，同比对比 ${trendCompareLabels.value.lastYear}。`;
});
const trendRows = computed(() => {
  if (selectedTrendModel.value) {
    const current = indexByName(summarizeCountries(rowsForPeriod(activeTrendPeriod.value)).map(countrySummaryToTrend));
    const previous = indexByName(summarizeCountries(rowsForPeriod(trendCompareLabels.value.previous)).map(countrySummaryToTrend));
    const lastYear = indexByName(summarizeCountries(rowsForPeriod(trendCompareLabels.value.lastYear)).map(countrySummaryToTrend));
    const names = new Set([...current.keys(), ...previous.keys(), ...lastYear.keys()]);
    return [...names].map((name) => {
      const item = current.get(name) || { name, units: 0, sales: 0, avgPrice: 0 };
      const previousItem = previous.get(name);
      const lastYearItem = lastYear.get(name);
      return {
        ...item,
        unitsMom: changeRate(item.units, previousItem?.units || 0),
        unitsYoy: changeRate(item.units, lastYearItem?.units || 0),
        salesMom: changeRate(item.sales, previousItem?.sales || 0),
        salesYoy: changeRate(item.sales, lastYearItem?.sales || 0),
      };
    }).sort((a, b) => {
      const direction = trendSortAsc.value ? 1 : -1;
      return direction * (a[trendMetric.value] - b[trendMetric.value]) || a.name.localeCompare(b.name);
    });
  }
  const current = indexByName(summarizeModels(rowsForPeriod(activeTrendPeriod.value)).map(modelSummaryToTrend));
  const previous = indexByName(summarizeModels(rowsForPeriod(trendCompareLabels.value.previous)).map(modelSummaryToTrend));
  const lastYear = indexByName(summarizeModels(rowsForPeriod(trendCompareLabels.value.lastYear)).map(modelSummaryToTrend));
  const names = topTrendNames.value;
  return names.map((name) => {
    const item = current.get(name) || { name, units: 0, sales: 0, avgPrice: 0 };
    const previousItem = previous.get(item.name);
    const lastYearItem = lastYear.get(item.name);
    return {
      ...item,
      unitsMom: changeRate(item.units, previousItem?.units || 0),
      unitsYoy: changeRate(item.units, lastYearItem?.units || 0),
      salesMom: changeRate(item.sales, previousItem?.sales || 0),
      salesYoy: changeRate(item.sales, lastYearItem?.sales || 0),
    };
  }).sort((a, b) => b[trendMetric.value] - a[trendMetric.value]);
});
const trendTotals = computed(() => {
  const current = { units: sum(trendRows.value, "units"), sales: sum(trendRows.value, "sales") };
  const previous = summarizeTotal(rowsForPeriod(trendCompareLabels.value.previous));
  const lastYear = summarizeTotal(rowsForPeriod(trendCompareLabels.value.lastYear));
  return {
    ...current,
    unitsMom: changeRate(current.units, previous.units),
    unitsYoy: changeRate(current.units, lastYear.units),
    salesMom: changeRate(current.sales, previous.sales),
    salesYoy: changeRate(current.sales, lastYear.sales),
  };
});
const trendOverallTotals = computed(() => {
  const current = summarizeTotal(rowsForPeriod(activeTrendPeriod.value));
  const previous = summarizeTotal(rowsForPeriod(trendCompareLabels.value.previous));
  const lastYear = summarizeTotal(rowsForPeriod(trendCompareLabels.value.lastYear));
  return {
    ...current,
    unitsMom: changeRate(current.units, previous.units),
    unitsYoy: changeRate(current.units, lastYear.units),
    salesMom: changeRate(current.sales, previous.sales),
    salesYoy: changeRate(current.sales, lastYear.sales),
  };
});
const trendMetricLabel = computed(() => trendMetric.value === "sales" ? "销售额" : "销量");
const trendEntityLabel = computed(() => "机型");
const selectedTrendModel = computed(() => filters.query.trim());
const topTrendNames = computed(() => {
  const basis = summarizeModels(rowsForPeriod(activeTrendPeriod.value)).map(modelSummaryToTrend);
  const fallback = summarizeModels(comparisonRows.value).map(modelSummaryToTrend);
  const items = basis.length ? basis : fallback;
  return items
    .sort((a, b) => b[trendMetric.value] - a[trendMetric.value])
    .slice(0, 10)
    .map((item) => item.name);
});
const priceHistoryRows = computed(() => selectedTrendModel.value ? modelPricePoints(selectedTrendModel.value) : []);
const trendChartWidth = computed(() => Math.max(1120, periods.value.length * 86));
const trendSeries = computed(() => {
  const chronologicalPeriods = [...periods.value].reverse();
  const modelQuery = filters.query.trim();
  const seriesRows = (period) => rowsForPeriod(period);
  const series = [
    {
      name: modelQuery ? `${modelQuery} 销量` : "总销量",
      color: "#1f7a5a",
      values: chronologicalPeriods.map((period) => sum(seriesRows(period), "quantity")),
      prices: chronologicalPeriods.map((period) => weightedAverage(seriesRows(period))),
    },
    {
      name: modelQuery ? `${modelQuery} 销售额` : "总销售额",
      color: "#235fa7",
      values: chronologicalPeriods.map((period) => sum(seriesRows(period), "sales")),
      prices: chronologicalPeriods.map((period) => weightedAverage(seriesRows(period))),
    },
  ];
  return { labels: chronologicalPeriods.map(shortPeriodLabel), series };
});
const customerRows = computed(() => summarizeCustomers(filteredRows.value)
  .sort((a, b) => b[customerMetric.value] - a[customerMetric.value] || a.name.localeCompare(b.name))
  .slice(0, 10)
  .map((item, index) => ({ ...item, rank: index + 1 })));
const filteredAllOrderRows = computed(() => allOrderRows.value.filter((row) => matchesGlobalFilters(row)));
const refundRows = computed(() => summarizeRefundOrders(filteredAllOrderRows.value).sort((a, b) => b.dateKey.localeCompare(a.dateKey)));
const refundTotal = computed(() => sum(refundRows.value, "refundedAmount"));
const couponRows = computed(() => summarizeCoupons(filteredAllOrderRows.value));
const couponTotal = computed(() => sum(couponRows.value, "amount"));
const inventoryHint = computed(() => inventoryFileName.value ? `${inventoryFileName.value} · ${number.format(inventoryRows.value.length)} 个库存机型` : "等待库存表；支持型号、数量、仓库列。");
const inventoryRows = computed(() => {
  const sold = new Map(summarizeModels(rows.value).map((item) => [item.model, item]));
  const query = inventorySearch.value.trim().toLowerCase();
  return inventoryItems.value.map((item) => {
    const soldItem = sold.get(item.model) || { units: 0, sales: 0, avgPrice: 0 };
    return { ...item, units: soldItem.units, sales: soldItem.sales, avgPrice: soldItem.avgPrice, ...saleGapInfo(item.model) };
  }).filter((item) => !query || item.model.toLowerCase().includes(query));
});
const staleInventoryRows = computed(() => inventoryRows.value.filter((item) => item.stock > 0 && item.saleGapDays > 90));

watch([marketShare, shareBy, shareCanvas], () => nextTick(drawShareChart), { deep: true });
watch([trendPoints, trendCanvas], () => nextTick(drawTrendChart), { deep: true });
watch([trendSeries, trendMetric, activeView, countryTrendCanvas], () => nextTick(drawCountryTrendChart), { deep: true });

async function refreshFiles() {
  const payload = await loadFileManifest();
  orderFiles.value = payload.orders;
  inventoryFiles.value = payload.inventory || [];
  ordersDir.value = payload.ordersDir;
  selectedOrderFiles.value = payload.orders.map((file) => file.name);
  await loadSelectedOrders();
  const latestInventory = [...(payload.inventory || [])].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0];
  if (latestInventory) await loadInventoryFromServer(latestInventory.name);
}

async function loadSelectedOrders() {
  const sources = await Promise.all(selectedOrderFiles.value.map(async (name) => ({ name, text: await fetchText(dataUrl("orders", name)) })));
  rows.value = dedupeOrderRows(sources.flatMap((source) => normalizeCsvSource(source.text, source.name)));
  allOrderRows.value = dedupeOrderRows(sources.flatMap((source) => normalizeCsvSource(source.text, source.name, { includeRefunded: true })));
  dataStatus.value = sources.length ? `${formatSourceNames(sources.map((source) => source.name))}，合并 ${number.format(rows.value.length)} 行订单商品数据` : "没有选择订单文件";
  if (!periods.value.includes(filters.period)) filters.period = "all";
  await nextTick();
  drawShareChart();
  drawTrendChart();
}

async function uploadOrderFiles(event) {
  const files = [...event.target.files].filter(isSupportedUpload);
  if (!files.length) return;
  if (dataMode.value === "api") {
    const body = new FormData();
    files.forEach((file) => body.append("files", file));
    await fetch("/api/upload", { method: "POST", body });
    event.target.value = "";
    await refreshFiles();
    return;
  }
  const sources = await Promise.all(files.map(async (file) => ({ name: file.name, text: await readSheetFile(file) })));
  rows.value = dedupeOrderRows(sources.flatMap((source) => normalizeCsvSource(source.text, source.name)));
  allOrderRows.value = dedupeOrderRows(sources.flatMap((source) => normalizeCsvSource(source.text, source.name, { includeRefunded: true })));
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
  inventoryItems.value = parseInventoryItems(text);
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
  if (dataMode.value === "api") {
    const body = new FormData();
    body.append("files", file);
    await fetch("/api/inventory/upload", { method: "POST", body });
    event.target.value = "";
    await refreshFiles();
    return;
  }
  inventoryFileName.value = file.name;
  inventoryItems.value = parseInventoryItems(await readSheetFile(file));
  event.target.value = "";
}

function resetFilters() {
  Object.assign(filters, { timeMode: "week", period: "all", country: "all", query: "", qtyMin: "", qtyMax: "", priceMin: "", priceMax: "" });
  countrySearch.value = "";
  inventorySearch.value = "";
  expandedRankingKey.value = "";
}

function setRankingMode(mode) {
  rankingMode.value = mode;
  expandedRankingKey.value = "";
}

function toggleRanking(key) {
  expandedRankingKey.value = expandedRankingKey.value === key ? "" : key;
}

function toggleCustomer(key) {
  expandedCustomerKey.value = expandedCustomerKey.value === key ? "" : key;
}

function openModelTrend(model) {
  if (!model) return;
  filters.query = model;
  activeView.value = "trend";
  nextTick(drawCountryTrendChart);
}

function matchesNonPeriodFilters(row) {
  const query = filters.query.trim().toLowerCase();
  if (filters.country !== "all" && row.countryName !== filters.country) return false;
  if (query && !`${row.model} ${row.fullName} ${row.sku}`.toLowerCase().includes(query)) return false;
  if (!inOptionalRange(row.quantity, filters.qtyMin, filters.qtyMax)) return false;
  if (!inOptionalRange(row.price, filters.priceMin, filters.priceMax)) return false;
  return true;
}

function matchesGlobalFilters(row) {
  if (filters.period !== "all" && row[timeKey.value] !== filters.period) return false;
  return matchesNonPeriodFilters(row);
}

function matchesCountryRankingFilters(row) {
  const query = filters.query.trim().toLowerCase();
  if (filters.period !== "all" && row[timeKey.value] !== filters.period) return false;
  if (query && !`${row.model} ${row.fullName} ${row.sku}`.toLowerCase().includes(query)) return false;
  if (!inOptionalRange(row.quantity, filters.qtyMin, filters.qtyMax)) return false;
  if (!inOptionalRange(row.price, filters.priceMin, filters.priceMax)) return false;
  return true;
}

function normalizeCsvSource(text, sourceName, options = {}) {
  const records = parseCsv(text);
  const [headers, ...body] = records;
  if (!headers?.length) return [];
  let lastCountry = "";
  let lastOrderMeta = { order: "", financialStatus: "", refundedAmount: 0, cancelledAt: "" };
  return body.map((values) => {
    const row = normalizeRow(headers, values, lastCountry, lastOrderMeta);
    row.sourceFile = sourceName;
    if (row.country) lastCountry = row.country;
    if (row.order) {
      lastOrderMeta = {
        financialStatus: row.financialStatus,
        refundedAmount: row.refundedAmount || 0,
        cancelledAt: row.cancelledAt || "",
        order: row.order,
      };
    }
    return row;
  }).filter((row) => row.createdAt && !Number.isNaN(row.createdAt.getTime()) && row.quantity > 0 && row.price >= 0 && !isAccessoryModel(row) && (options.includeRefunded || !isRefundedOrder(row)));
}

function normalizeRow(headers, values, fallbackCountry, fallbackOrderMeta) {
  const source = Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]));
  const hasOrderName = Boolean(source.Name);
  const country = (source["Shipping Country"] || source["Billing Country"] || fallbackCountry || "").toUpperCase();
  const financialStatus = hasOrderName ? source["Financial Status"] || "" : source["Financial Status"] || fallbackOrderMeta.financialStatus || "";
  const refundedAmount = hasOrderName ? toNumber(source["Refunded Amount"]) : source["Refunded Amount"] === "" ? fallbackOrderMeta.refundedAmount : toNumber(source["Refunded Amount"]);
  const cancelledAt = hasOrderName ? source["Cancelled at"] || "" : source["Cancelled at"] || fallbackOrderMeta.cancelledAt || "";
  const province = source["Shipping Province Name"] || source["Shipping Province"] || source["Billing Province Name"] || source["Billing Province"] || "";
  const createdAt = parseShopifyDate(source["Created at"] || source["Paid at"]);
  const quantity = toNumber(source["Lineitem quantity"]);
  const price = toNumber(source["Lineitem price"]);
  const name = source["Lineitem name"] || "未命名商品";
  return {
    order: source.Name || fallbackOrderMeta.order || "",
    customerName: source["Billing Name"] || source["Shipping Name"] || source.Email || "未知客户",
    email: normalizeEmail(source.Email),
    discountCode: source["Discount Code"] || "",
    discountAmount: toNumber(source["Discount Amount"]),
    lineDiscount: toNumber(source["Lineitem discount"]),
    refundReason: source.Notes || source["Note Attributes"] || "",
    financialStatus,
    refundedAmount,
    cancelledAt,
    createdAt,
    dateKey: formatDate(createdAt),
    year: String(createdAt.getFullYear()),
    quarter: `${createdAt.getFullYear()} Q${Math.floor(createdAt.getMonth() / 3) + 1}`,
    month: `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, "0")}`,
    week: getThursdayWeek(createdAt),
    country,
    countryName: getCountryName(country),
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

function getCountryName(country) {
  const code = String(country || "").trim().toUpperCase();
  if (!code) return "未知";
  if (COUNTRY_NAMES[code]) return COUNTRY_NAMES[code];
  try {
    return regionNames.of(code) || code;
  } catch {
    return code;
  }
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
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

function parseInventoryItems(text) {
  const records = parseCsv(text.trim());
  if (!records.length) return [];
  const hasHeader = records[0].some((cell) => /sku|model|型号|产品|quantity|qty|数量|库存|warehouse|仓库/i.test(String(cell || "")));
  const headers = hasHeader ? records[0].map((header) => String(header || "").trim().toLowerCase()) : [];
  const dataRows = hasHeader ? records.slice(1) : records;
  const modelIndex = findHeaderIndex(headers, ["sku", "model", "型号", "商品型号", "lineitem sku", "product", "产品", "产品型号"]);
  const qtyIndex = findHeaderIndex(headers, ["quantity", "qty", "库存", "数量", "stock", "可售"]);
  const warehouseIndex = findHeaderIndex(headers, ["warehouse", "仓库", "location", "库存地", "库房"]);
  const statusIndex = findHeaderIndex(headers, ["在产状态", "生产状态", "机型状态", "状态", "status"]);
  const map = new Map();
  dataRows.forEach((row) => {
    const rawModel = row[modelIndex >= 0 ? modelIndex : 0] || row.find((cell) => String(cell || "").trim());
    const model = normalizeModelKey(rawModel);
    if (!model || model.toLowerCase().includes("accessories")) return;
    const warehouse = warehouseIndex >= 0 ? String(row[warehouseIndex] || "").trim() : inferWarehouse(rawModel);
    const productionStatus = normalizeProductionStatus(statusIndex >= 0 ? row[statusIndex] : "");
    const stock = qtyIndex >= 0 ? toNumber(row[qtyIndex]) : 0;
    const market = warehouseToMarket(warehouse);
    const previous = map.get(`${model}:${warehouse}`) || { model, warehouse, market, productionStatus, stock: 0 };
    previous.stock += stock;
    previous.productionStatus = previous.productionStatus || productionStatus;
    map.set(`${model}:${warehouse}`, previous);
  });
  return [...map.values()].sort((a, b) => a.model.localeCompare(b.model));
}

function findHeaderIndex(headers, keywords) {
  return headers.findIndex((header) => keywords.some((keyword) => header.includes(keyword.toLowerCase())));
}

function isSupportedUpload(file) {
  const name = file.name.toLowerCase();
  return name.endsWith(".csv") || name.endsWith(".xlsx") || name.endsWith(".xls") || file.type.includes("csv") || file.type.includes("spreadsheet") || file.type.includes("excel");
}

async function readSheetFile(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv") || file.type.includes("csv")) return file.text();
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: "array" });
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) return "";
  return XLSX.utils.sheet_to_csv(workbook.Sheets[firstSheet]);
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
  ctx.fillText("市场占比", centerX, centerY + 18);
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

function drawCountryTrendChart() {
  const canvas = countryTrendCanvas.value;
  if (!canvas || activeView.value !== "trend") return;
  const ctx = canvas.getContext("2d");
  const { labels, series } = trendSeries.value;
  const width = canvas.width;
  const height = canvas.height;
  const pad = { top: 34, right: 36, bottom: 58, left: 78 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#fcfdfc";
  ctx.fillRect(0, 0, width, height);
  if (canvas.parentElement) canvas.parentElement.scrollLeft = canvas.parentElement.scrollWidth;
  if (!labels.length || !series.length) {
    ctx.fillStyle = "#64706d";
    ctx.font = "22px sans-serif";
    ctx.fillText("暂无趋势数据", 42, 82);
    return;
  }
  const maxValue = Math.max(...series.flatMap((item) => item.values), 1);
  ctx.strokeStyle = "#dce4df";
  ctx.lineWidth = 1;
  ctx.fillStyle = "#64706d";
  ctx.font = "16px sans-serif";
  for (let i = 0; i <= 4; i += 1) {
    const y = pad.top + (plotH / 4) * i;
    const value = maxValue - (maxValue / 4) * i;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(width - pad.right, y);
    ctx.stroke();
    ctx.fillText(trendMetric.value === "sales" ? money.format(value) : number.format(Math.round(value)), 10, y + 5);
  }
  series.forEach((item) => {
    const seriesMax = Math.max(...item.values, 1);
    ctx.strokeStyle = item.color;
    ctx.fillStyle = item.color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    item.values.forEach((value, index) => {
      const x = pad.left + (labels.length === 1 ? plotW / 2 : (plotW / (labels.length - 1)) * index);
      const y = pad.top + plotH - (value / seriesMax) * plotH;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    item.values.forEach((value, index) => {
      const x = pad.left + (labels.length === 1 ? plotW / 2 : (plotW / (labels.length - 1)) * index);
      const y = pad.top + plotH - (value / seriesMax) * plotH;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    });
  });
  if (filters.query.trim()) {
    const maxPrice = Math.max(...series.flatMap((item) => item.prices), 1);
    series.forEach((item) => {
      ctx.strokeStyle = item.color;
      ctx.globalAlpha = 0.46;
      ctx.lineWidth = 2;
      ctx.setLineDash([7, 7]);
      ctx.beginPath();
      item.prices.forEach((value, index) => {
        const x = pad.left + (labels.length === 1 ? plotW / 2 : (plotW / (labels.length - 1)) * index);
        const y = pad.top + plotH - (value / maxPrice) * plotH;
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    });
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = "#34413d";
  ctx.font = "18px sans-serif";
  labels.forEach((label, index) => {
    const x = pad.left + (labels.length === 1 ? plotW / 2 : (plotW / (labels.length - 1)) * index);
    ctx.save();
    ctx.translate(x, height - 22);
    ctx.rotate(-Math.PI / 8);
    ctx.fillText(label, -24, 0);
    ctx.restore();
  });
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
  if (country === "US") return "美国市场";
  if (country === "GB" || country === "UK") return "英国市场";
  if (country === "DE" || EU_COUNTRIES.has(country)) return "欧盟市场";
  return "自发货市场";
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

function isRefundedOrder(row) {
  const status = String(row.financialStatus || "").toLowerCase();
  return status === "refunded" || Boolean(row.cancelledAt);
}

function normalizeModelKey(value) {
  return String(value || "").trim().replace(/^BL\//i, "").replace(/[（(].*?[）)]/g, "").replace(/_[HUK]$/i, "").split("/").map((part) => part.replace(/[_-]?[A-Z]??(美规|欧规|英规|日规|澳规|加拿大规|国规)$/i, "").trim()).filter((part) => part && !/(美规|欧规|英规|日规|澳规|加拿大规|国规)/i.test(part)).join("/");
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

function rowsForPeriod(period) {
  if (!period) return [];
  return comparisonRows.value.filter((row) => row[timeKey.value] === period);
}

function summarizeCountries(items) {
  return groupBy(items, "countryName").map(([country, group]) => ({ country, units: sum(group, "quantity"), sales: sum(group, "sales") })).filter((item) => item.units || item.sales);
}

function summarizeMarkets(items) {
  const markets = groupBy(items, "market").map(([market, group]) => ({ market, units: sum(group, "quantity"), sales: sum(group, "sales") }));
  return markets.sort((a, b) => MARKET_ORDER.indexOf(a.market) - MARKET_ORDER.indexOf(b.market));
}

function summarizeCustomers(items) {
  const grouped = new Map();
  items.forEach((item) => {
    const key = item.email || `no-email:${item.order || item.dateKey}:${item.customerName}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(item);
  });
  return [...grouped.entries()].map(([key, group]) => {
    const email = group.find((item) => item.email)?.email || "";
    const customerName = group.find((item) => item.customerName)?.customerName || "未填写姓名";
    return {
      key,
      name: email || "未填写邮箱",
      customerName,
      units: sum(group, "quantity"),
      sales: sum(group, "sales"),
      details: group
        .map((item, index) => ({
          key: `${item.order || item.dateKey}:${item.model}:${index}`,
          time: item.dateKey,
          model: item.model,
          units: item.quantity,
          price: item.price,
          sales: item.sales,
        }))
        .sort((a, b) => b.time.localeCompare(a.time)),
    };
  }).filter((item) => item.units || item.sales);
}

function summarizeTotal(items) {
  return { units: sum(items, "quantity"), sales: sum(items, "sales") };
}

function dedupeOrderRows(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item.order}||${item.dateKey}||${item.sku}`;
    if (!item.order || !item.dateKey || !item.sku) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function modelSummaryToTrend(item) {
  return { name: item.model, units: item.units, sales: item.sales, avgPrice: item.avgPrice };
}

function countrySummaryToTrend(item) {
  return { name: item.country, units: item.units, sales: item.sales, avgPrice: item.units ? item.sales / item.units : 0 };
}

function summarizeRefundOrders(items) {
  const map = new Map();
  items.filter((item) => item.refundedAmount > 0 || isRefundedOrder(item)).forEach((item) => {
    const key = item.order || `${item.email}:${item.dateKey}:${item.refundedAmount}`;
    const previous = map.get(key) || {
      order: item.order || "未知订单",
      dateKey: item.dateKey,
      customerName: item.customerName,
      refundedAmount: 0,
      reason: item.refundReason,
    };
    previous.refundedAmount = Math.max(previous.refundedAmount, item.refundedAmount || 0);
    previous.reason = previous.reason || item.refundReason;
    map.set(key, previous);
  });
  return [...map.values()].filter((item) => item.refundedAmount > 0);
}

function summarizeCoupons(items) {
  const orderMap = new Map();
  items.filter((item) => item.discountCode || item.discountAmount || item.lineDiscount).forEach((item) => {
    const orderKey = item.order || `${item.email}:${item.dateKey}`;
    const previous = orderMap.get(orderKey) || { code: item.discountCode || "未填写优惠码", amount: 0 };
    previous.code = previous.code || item.discountCode || "未填写优惠码";
    previous.amount = Math.max(previous.amount, item.discountAmount || 0) + (item.lineDiscount || 0);
    orderMap.set(orderKey, previous);
  });
  const couponMap = new Map();
  orderMap.forEach((order) => {
    const previous = couponMap.get(order.code) || { code: order.code, amount: 0, orders: 0 };
    previous.amount += order.amount;
    previous.orders += 1;
    couponMap.set(order.code, previous);
  });
  return [...couponMap.values()].filter((item) => item.amount > 0).sort((a, b) => b.amount - a.amount);
}

function indexByName(items) {
  return new Map(items.map((item) => [item.name, item]));
}

function previousPeriod(period, mode) {
  if (!period) return "";
  if (mode === "year") return String(Number(period) - 1);
  if (mode === "quarter") {
    const match = period.match(/^(\d{4}) Q([1-4])$/);
    if (!match) return "";
    const year = Number(match[1]);
    const quarter = Number(match[2]);
    return quarter === 1 ? `${year - 1} Q4` : `${year} Q${quarter - 1}`;
  }
  if (mode === "month") return shiftMonth(period, -1);
  return shiftWeek(period, -7);
}

function yearAgoPeriod(period, mode) {
  if (!period) return "";
  if (mode === "year") return String(Number(period) - 1);
  if (mode === "quarter") return period.replace(/^(\d{4})/, (year) => String(Number(year) - 1));
  if (mode === "month") return shiftMonth(period, -12);
  return shiftWeek(period, -364);
}

function shiftMonth(period, offset) {
  const match = period.match(/^(\d{4})-(\d{2})$/);
  if (!match) return "";
  const date = new Date(Number(match[1]), Number(match[2]) - 1 + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function shiftWeek(period, days) {
  const [startText] = period.split(" 至 ");
  const start = parseDateKey(startText);
  if (!start) return "";
  start.setDate(start.getDate() + days);
  return getThursdayWeek(start);
}

function parseDateKey(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function changeRate(current, previous) {
  if (!previous) return current ? Infinity : 0;
  return (current - previous) / previous;
}

function formatChange(value) {
  if (value === Infinity) return "新增";
  if (!Number.isFinite(value)) return "N/A";
  if (Object.is(value, -0) || value === 0) return "0.0%";
  return `${value > 0 ? "+" : ""}${percent.format(value)}`;
}

function changeClass(value) {
  return { "change-up": value > 0, "change-down": value < 0, "change-flat": value === 0 };
}

function timeModeLabel(mode) {
  return { week: "周度", month: "月度", quarter: "季度", year: "年度" }[mode] || "周期";
}

function shortPeriodLabel(period) {
  if (filters.timeMode === "week") return period.split(" 至 ")[0].slice(5);
  if (filters.timeMode === "month") return period.slice(2);
  if (filters.timeMode === "quarter") return period.replace(/^20/, "");
  return period;
}

function inOptionalRange(value, min, max) {
  const parsedMin = min === "" ? null : Number(min);
  const parsedMax = max === "" ? null : Number(max);
  return (parsedMin === null || value >= parsedMin) && (parsedMax === null || value <= parsedMax);
}

function summarizeModels(items) {
  return groupBy(items, "model").map(([model, group]) => ({ model, countries: [...new Set(group.map((item) => item.countryName))].sort(), units: sum(group, "quantity"), avgPrice: weightedAverage(group), sales: sum(group, "sales") }));
}

function inferWarehouse(value) {
  const text = String(value || "");
  if (/_U\b|美国仓|US/i.test(text)) return "美国仓库";
  if (/_H\b|德国仓|DE/i.test(text)) return "德国仓库";
  if (/_K\b|英国仓|UK|GB/i.test(text)) return "英国仓库";
  return "";
}

function warehouseToMarket(warehouse) {
  const text = String(warehouse || "").toLowerCase();
  if (!text || text.includes("自发货")) return "";
  if (text.includes("美国") || text.includes("us")) return "美国市场";
  if (text.includes("德国") || text.includes("de")) return "欧盟市场";
  if (text.includes("英国") || text.includes("uk") || text.includes("gb")) return "英国市场";
  return "";
}

function normalizeProductionStatus(value) {
  const text = String(value || "").trim();
  if (/停产/.test(text)) return "停产";
  if (/不备货/.test(text)) return "不备货";
  if (/正常/.test(text)) return "正常";
  return text;
}

function inventoryTooltip(item) {
  const price = item.avgPrice ? `均价 ${decimalMoney.format(item.avgPrice)}` : "暂无成交均价";
  const priceChange = modelPriceChange(item.model);
  return `${item.model}\n${price}\n单价变化 ${priceChange}\n库存 ${number.format(item.stock)}\n已售 ${number.format(item.units)} 件`;
}

function modelInfoTitle(model) {
  if (!model) return "";
  const stock = modelStockTotal(model);
  return `${model}\n库存 ${number.format(stock)}\n单价变化\n${modelPriceChange(model)}`;
}

function modelStockTotal(model) {
  return inventoryItems.value
    .filter((item) => item.model === model)
    .reduce((total, item) => total + Number(item.stock || 0), 0);
}

function saleGapInfo(model) {
  const dates = [...new Set(rows.value.filter((row) => row.model === model).map((row) => row.dateKey).filter(Boolean))]
    .sort((a, b) => b.localeCompare(a));
  if (dates.length < 2) return { saleGapDays: 0, latestSaleDate: dates[0] || "", previousSaleDate: "" };
  const gap = daysBetween(dates[1], dates[0]);
  return { saleGapDays: gap, latestSaleDate: dates[0], previousSaleDate: dates[1] };
}

function daysBetween(startText, endText) {
  const start = parseDateKey(startText);
  const end = parseDateKey(endText);
  if (!start || !end) return 0;
  return Math.round((end - start) / 86400000);
}

function modelPriceChange(model) {
  const points = modelPricePoints(model);
  if (points.length < 2) return "暂无变化";
  const lines = points.map((point) => `${point.dateKey} ${decimalMoney.format(point.avgPrice)}`);
  const first = points[0];
  const last = points[points.length - 1];
  const summary = `总变化 ${formatChange(changeRate(last.avgPrice, first.avgPrice))}`;
  return `${summary}\n${lines.join("\n")}`;
}

function modelPricePoints(model) {
  return groupBy(rows.value.filter((row) => row.model === model && row.dateKey), "dateKey")
    .map(([dateKey, group]) => ({
      dateKey,
      units: sum(group, "quantity"),
      sales: sum(group, "sales"),
      avgPrice: weightedAverage(group),
    }))
    .filter((item) => item.avgPrice > 0)
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey));
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
