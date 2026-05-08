import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";

const roots = ["tests/fixtures", "tests/e2e"];
const supportedExtensions = new Set([".json", ".md", ".ts", ".tsx", ".js", ".mjs"]);
const banned = [
  { name: "Indian mobile number", regex: /(?:\+91[- ]?)?[6-9]\d{9}/ },
  { name: "Aadhaar-like number", regex: /\d{4}[- ]?\d{4}[- ]?\d{4}/ },
  { name: "PAN-like id", regex: /[A-Z]{5}\d{4}[A-Z]/ },
  { name: "non-test email domain", regex: /[A-Z0-9._%+-]+@(?!example\.test|[^@\s]+\.test)[A-Z0-9.-]+\.[A-Z]{2,}/i },
  { name: "raw MIME content", regex: /(?:MIME-Version|DKIM-Signature|Received):/i },
  { name: "OAuth token", regex: /(?:gho|ghp|ya29|xox[baprs])_[A-Za-z0-9_/-]{12,}/ },
  { name: "private key", regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ }
];
const files = [];
function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) walk(full);
    if (stats.isFile() && supportedExtensions.has(extname(entry))) files.push(full);
  }
}
for (const root of roots) walk(root);
const failures = [];
for (const file of files) {
  const body = readFileSync(file, "utf8");
  for (const pattern of banned) if (pattern.regex.test(body)) failures.push(`${file}: ${pattern.name}`);
}
if (failures.length) {
  console.error("Synthetic fixture hygiene failed:");
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(`Synthetic fixture hygiene passed: ${files.length} files scanned`);
