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

await fs.mkdir(ordersDir, { recursive: true });
await fs.mkdir(inventoryDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: async (_req, _file, cb) => {
      await fs.mkdir(ordersDir, { recursive: true });
      cb(null, ordersDir);
    },
    filename: (_req, file, cb) => cb(null, safeFileName(file.originalname)),
  }),
  fileFilter: (_req, file, cb) => {
    const ok = file.originalname.toLowerCase().endsWith(".csv") || file.mimetype.includes("csv");
    cb(ok ? null : new Error("只支持 CSV 文件"), ok);
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
  res.json({ files: req.files.map((file) => ({ name: file.filename, size: file.size })) });
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

function safeFileName(name) {
  const parsed = path.parse(name);
  const base = parsed.name.replace(/[^\w.\-\u4e00-\u9fa5]+/g, "_").slice(0, 80) || "orders";
  return `${base}_${Date.now()}.csv`;
}

function resolveInside(root, name) {
  const filePath = path.resolve(root, name);
  if (!filePath.startsWith(root)) {
    throw new Error("非法文件路径");
  }
  return filePath;
}
