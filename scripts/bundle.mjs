// Betikleri birleştirir: src/ + shared/ → inject.js, watcher/ + shared/ → watcher.js, capture/ → dmcapture.js
//   node scripts/bundle.mjs          → app/gen/ (uygulama bunları yükler)
//   node scripts/bundle.mjs --test   → test/out/ (instagram.com alan adı koruması kaldırılır; sahte API'li test sayfası localhost'ta çalışır)
import { readFileSync, writeFileSync, readdirSync, mkdirSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TEST = process.argv.includes("--test");
const OUT = join(ROOT, TEST ? "test/out" : "app/gen");
const HDR = "// OTOMATİK ÜRETİLİR — düzenleme için src/, shared/, watcher/ ve capture/ altındaki dosyaları değiştir, sonra npm run bundle çalıştır.\n";
const GUARD = "if (!/(^|\\.)instagram\\.com$/.test(location.hostname)) return;";

const files = (dir) => readdirSync(join(ROOT, dir)).filter((f) => f.endsWith(".js")).sort().map((f) => join(dir, f));
const read = (f) => readFileSync(join(ROOT, f), "utf8");
// Önce 00-head (IIFE açılışı), sonra ortak kod, sonra klasörün geri kalanı
const withShared = (dir) => {
  const [head, ...rest] = files(dir);
  return [head, ...files("shared"), ...rest].map(read).join("");
};
function strip(s) {
  if (!TEST) return s;
  if (!s.includes(GUARD)) throw new Error("alan adı koruma satırı bulunamadı");
  return s.split(GUARD).join("/* test: alan adı koruması kapalı */");
}

mkdirSync(OUT, { recursive: true });
const outputs = {
  "inject.js": withShared("src"),
  "watcher.js": withShared("watcher"),
  "dmcapture.js": files("capture").map(read).join(""),
};
for (const [name, body] of Object.entries(outputs)) {
  const p = join(OUT, name);
  writeFileSync(p, HDR + strip(body));
  execFileSync(process.execPath, ["--check", p], { stdio: "inherit" });
}
if (TEST) copyFileSync(join(ROOT, "test/index.html"), join(OUT, "index.html"));
console.log("Betikler hazır: " + OUT);
