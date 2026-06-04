import express from "express";
import multer from "multer";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer as createViteServer } from "vite";
import * as XLSX from "xlsx";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.PORT || 5173);
const ordersDir = path.resolve(process.env.ORDER_DATA_DIR || path.join(__dirname, "data", "orders"));
const inventoryDir = path.resolve(process.env.INVENTORY_DATA_DIR || path.join(__dirname, "data", "inventory"));

await fs.mkdir(ordersDir, { recursive: true });
await fs.mkdir(inventoryDir, { recursive: true });

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    const ok = isSupportedSheet(file.originalname, file.mimetype);
    cb(ok ? null : new Error("只支持 CSV 或 Excel 文件"), ok);
  },
});

app.get("/api/files", async (_req, res) => {
  const [orders, inventory] = await Promise.all([listCsvFiles(ordersDir), listCsvFiles(inventoryDir)]);
  res.json({
    orders,
    inventory,
    ordersDir,
    inventoryDir,
  });
});

app.get("/api/orders/:name", async (req, res) => {
  const filePath = resolveInside(ordersDir, req.params.name);
  res.type("text/csv").send(await fs.readFile(filePath, "utf8"));
});

app.get("/api/inventory/:name", async (req, res) => {
  const filePath = resolveInside(inventoryDir, req.params.name);
  res.type("text/csv").send(await fs.readFile(filePath, "utf8"));
});

app.post("/api/upload", upload.array("files"), (req, res) => {
  Promise.all(req.files.map((file) => saveUploadedSheet(file, ordersDir, "orders"))).then((files) => {
    res.json({ files });
  }).catch((error) => {
    res.status(400).json({ error: error.message });
  });
});

app.post("/api/inventory/upload", upload.array("files"), (req, res) => {
  Promise.all(req.files.map((file) => saveUploadedSheet(file, inventoryDir, "inventory"))).then(async (files) => {
    await pruneInventoryFiles();
    res.json({ files });
  }).catch((error) => {
    res.status(400).json({ error: error.message });
  });
});

const vite = await createViteServer({
  server: { middlewareMode: true, hmr: { port: port + 10000 } },
  appType: "spa",
});

app.use(vite.middlewares);

app.listen(port, () => {
  console.log(`订单看板已启动：http://localhost:${port}`);
  console.log(`订单 CSV 目录：${ordersDir}`);
});

async function listCsvFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  const files = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".csv"))
      .map(async (entry) => {
        const stat = await fs.stat(path.join(dir, entry.name));
        return { name: entry.name, size: stat.size, updatedAt: stat.mtime.toISOString() };
      }),
  );
  return files.sort((a, b) => a.name.localeCompare(b.name));
}

async function saveUploadedSheet(file, targetDir, type) {
  await fs.mkdir(targetDir, { recursive: true });
  const csv = sheetToCsv(file, type);
  const filename = type === "inventory" ? await nextInventoryName() : safeFileName(file.originalname);
  const filePath = path.join(targetDir, filename);
  await fs.writeFile(filePath, csv);
  return { name: filename, size: Buffer.byteLength(csv), updatedAt: new Date().toISOString() };
}

function sheetToCsv(file, type) {
  const name = file.originalname.toLowerCase();
  if (name.endsWith(".csv")) return file.buffer.toString("utf8");
  const workbook = XLSX.read(file.buffer, { type: "buffer", cellDates: false });
  if (type === "inventory") {
    const inventoryCsv = inventoryWorkbookToCsv(workbook);
    if (inventoryCsv) return inventoryCsv;
  }
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) throw new Error("Excel 文件没有工作表");
  return XLSX.utils.sheet_to_csv(workbook.Sheets[firstSheet]);
}

function inventoryWorkbookToCsv(workbook) {
  const inventorySheetName = workbook.SheetNames.find((name) => name.includes("库存"));
  if (!inventorySheetName) return "";
  const statusSheetName = workbook.SheetNames.find((name) => name.includes("正常机型"));
  const inventoryRecords = XLSX.utils.sheet_to_json(workbook.Sheets[inventorySheetName], { header: 1, defval: "" });
  const normalModels = statusSheetName ? normalModelSet(XLSX.utils.sheet_to_json(workbook.Sheets[statusSheetName], { header: 1, defval: "" })) : new Set();
  const rows = wideInventoryRows(inventoryRecords, normalModels);
  if (!rows.length) return "";
  return toCsv([["model", "warehouse", "stock", "productionStatus"], ...rows.map((row) => [row.model, row.warehouse, row.stock, row.productionStatus])]);
}

function normalModelSet(records) {
  const set = new Set();
  records.forEach((row) => {
    const status = String(row[0] || "").trim();
    const model = row.slice(1).find((cell) => String(cell || "").trim());
    if (/正常/.test(status) && model) set.add(normalizeModelKey(model));
  });
  return set;
}

function wideInventoryRows(records, normalModels = new Set()) {
  if (!records.length) return [];
  const headers = records[0].map((cell) => String(cell || "").trim());
  const modelIndex = headers.findIndex((header) => /商务统一型号|型号|产品/.test(header));
  const specs = [
    { label: "美规", warehouse: "美国仓库", index: headers.findIndex((header) => header === "美规") },
    { label: "欧规", warehouse: "德国仓库", index: headers.findIndex((header) => header === "欧规") },
    { label: "英规", warehouse: "英国仓库", index: headers.findIndex((header) => header === "英规") },
  ].filter((item) => item.index >= 0);
  if (modelIndex < 0 || !specs.length) return [];
  return records.slice(1).flatMap((record) => {
    const model = normalizeModelKey(record[modelIndex]);
    if (!model || model === "部门" || model.toLowerCase().includes("accessories")) return [];
    const productionStatus = normalModels.has(model) ? "正常" : "停产/不备货";
    return specs.map((spec) => ({ model, warehouse: spec.warehouse, stock: toNumber(record[spec.index]), productionStatus }));
  });
}

function normalizeModelKey(value) {
  return String(value || "").trim().replace(/^BL\//i, "").replace(/[（(].*?[）)]/g, "").replace(/_[HUK]$/i, "").split("/").map((part) => part.replace(/[_-]?[A-Z]??(美规|欧规|英规|日规|澳规|加拿大规|国规)$/i, "").trim()).filter((part) => part && !/(美规|欧规|英规|日规|澳规|加拿大规|国规)/i.test(part)).join("/");
}

function toNumber(value) {
  const parsed = Number(String(value ?? "").replace(/[$,]/g, "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function toCsv(records) {
  return records.map((row) => row.map((cell) => {
    const text = String(cell ?? "");
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }).join(",")).join("\n");
}

function isSupportedSheet(name, mime = "") {
  const lower = name.toLowerCase();
  return lower.endsWith(".csv") || lower.endsWith(".xlsx") || lower.endsWith(".xls") || mime.includes("csv") || mime.includes("spreadsheet") || mime.includes("excel");
}

function safeFileName(name) {
  const parsed = path.parse(name);
  const base = parsed.name.replace(/[^\w.\-\u4e00-\u9fa5]+/g, "_").slice(0, 80) || "orders";
  return `${base}_${Date.now()}.csv`;
}

async function nextInventoryName() {
  const today = new Date().toISOString().slice(0, 10);
  const files = await listCsvFiles(inventoryDir);
  const todayCount = files.filter((file) => file.name.startsWith(`${today}-`)).length;
  return `${today}-${String(todayCount + 1).padStart(2, "0")}.csv`;
}

async function pruneInventoryFiles() {
  const files = await listCsvFiles(inventoryDir);
  const staleFiles = files.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(3);
  await Promise.all(staleFiles.map((file) => fs.rm(path.join(inventoryDir, file.name), { force: true })));
}

function resolveInside(root, name) {
  const filePath = path.resolve(root, name);
  if (!filePath.startsWith(root)) {
    throw new Error("非法文件路径");
  }
  return filePath;
}
