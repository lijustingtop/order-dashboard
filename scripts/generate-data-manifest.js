import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const publicDir = path.join(root, "public");
const ordersDir = path.join(root, "data", "orders");
const inventoryDir = path.join(root, "data", "inventory");

await fs.mkdir(publicDir, { recursive: true });
await fs.rm(path.join(publicDir, "data"), { recursive: true, force: true });
await copyCsvDir(ordersDir, path.join(publicDir, "data", "orders"));
await copyCsvDir(inventoryDir, path.join(publicDir, "data", "inventory"));

const manifest = {
  mode: "static",
  ordersDir: "data/orders",
  inventoryDir: "data/inventory",
  orders: await listCsvFiles(ordersDir),
  inventory: await listCsvFiles(inventoryDir),
};

await fs.writeFile(path.join(publicDir, "data-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

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

async function copyCsvDir(sourceDir, targetDir) {
  await fs.mkdir(targetDir, { recursive: true });
  const entries = await fs.readdir(sourceDir, { withFileTypes: true }).catch(() => []);
  await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".csv"))
      .map((entry) => fs.copyFile(path.join(sourceDir, entry.name), path.join(targetDir, entry.name))),
  );
}
