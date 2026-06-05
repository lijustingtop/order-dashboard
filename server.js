import express from "express";
import multer from "multer";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer as createViteServer } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.PORT || 5173);
const ordersDir = path.resolve(process.env.ORDER_DATA_DIR || path.join(__dirname, "data", "orders"));
const inventoryDir = path.resolve(process.env.INVENTORY_DATA_DIR || path.join(__dirname, "data", "inventory"));
const refundsDir = path.resolve(process.env.REFUND_DATA_DIR || path.join(__dirname, "data", "refunds"));

await fs.mkdir(ordersDir, { recursive: true });
await fs.mkdir(inventoryDir, { recursive: true });
await fs.mkdir(refundsDir, { recursive: true });

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    const ok = isSupportedSheet(file.originalname, file.mimetype);
    cb(ok ? null : new Error("只支持 CSV 文件"), ok);
  },
});

app.get("/api/files", async (_req, res) => {
  const [orders, inventory, refunds] = await Promise.all([listCsvFiles(ordersDir), listCsvFiles(inventoryDir), listCsvFiles(refundsDir)]);
  res.json({
    orders,
    inventory,
    refunds,
    ordersDir,
    inventoryDir,
    refundsDir,
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

app.get("/api/refunds/:name", async (req, res) => {
  const filePath = resolveInside(refundsDir, req.params.name);
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
  const csv = file.buffer.toString("utf8");
  const filename = type === "inventory" ? await nextInventoryName() : safeFileName(file.originalname);
  const filePath = path.join(targetDir, filename);
  await fs.writeFile(filePath, csv);
  return { name: filename, size: Buffer.byteLength(csv), updatedAt: new Date().toISOString() };
}

function isSupportedSheet(name, mime = "") {
  const lower = name.toLowerCase();
  return lower.endsWith(".csv") || mime.includes("csv") || mime === "text/plain";
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
