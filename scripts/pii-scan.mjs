import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";

const roots = ["apps", "packages", "tests", "infra", ".github"];
const supported = new Set([".ts", ".tsx", ".js", ".mjs", ".md", ".yml", ".yaml", ".json", ".prisma", ".css"]);
const patterns = [
  { name: "realistic Indian mobile number", regex: /(?:\+91[- ]?)?[6-9]\d{9}/ },
  { name: "oauth token", regex: /(?:gho|ghp|ya29|xox[baprs])_[A-Za-z0-9_/-]{12,}/ },
  { name: "private key", regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: "raw mrn", regex: /MRN[-_ ]?\d{4,}/i },
  { name: "raw uhid", regex: /UHID[-_ ]?\d{4,}/i },
  { name: "raw policy id", regex: /POLICY[-_ ]?\d{6,}/i },
  { name: "raw MIME content", regex: /(?:MIME-Version|DKIM-Signature|Received):/i }
];
const allowedSynthetic = ["UHID-TEST-0001", "IP-TEST-0001", "POLICY-TEST-1234", "MEMBER-TEST-0001"];
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
const findings = [];
for (const file of files) {
  let body = readFileSync(file, "utf8");
  for (const safe of allowedSynthetic) body = body.replaceAll(safe, "");
  for (const pattern of patterns) if (pattern.regex.test(body)) findings.push(`${file}: ${pattern.name}`);
}
if (findings.length) {
  console.error("PII/secret scan failed:");
  console.error(findings.join("\n"));
  process.exit(1);
}
console.log(`PII/secret scan passed: ${files.length} files scanned`);
