import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";

const roots = ["apps", "packages", "tests", "infra", ".github"];
const deprecatedRoutePatterns = [
  /api\/auth\/gmail\/callback/i,
  /prior authorization/i,
  /\bpayer\b(?![-_ ]mix)/i
];
const supported = new Set([".ts", ".tsx", ".js", ".mjs", ".md", ".yml", ".yaml", ".json", ".prisma"]);
const files = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (["node_modules", ".next", "dist", ".turbo"].includes(entry)) continue;
    const stats = statSync(full);
    if (stats.isDirectory()) walk(full);
    if (stats.isFile() && supported.has(extname(entry))) files.push(full);
  }
}

for (const root of roots) walk(root);
const failures = [];
for (const file of files) {
  const body = readFileSync(file, "utf8");
  for (const pattern of deprecatedRoutePatterns) {
    if (pattern.test(body)) failures.push(`${file}: deprecated/non-India-first term ${pattern}`);
  }
}
if (failures.length) {
  console.error("lint failed:");
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(`lint passed: ${files.length} files scanned for route/language guardrails`);
