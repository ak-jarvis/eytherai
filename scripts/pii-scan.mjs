import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const roots = ['tests/fixtures/synthetic', 'apps', 'packages', 'infra'];
const patterns = [
  { name: 'aadhaar_like', regex: /\b\d{4}\s?\d{4}\s?\d{4}\b/ },
  { name: 'pan_like', regex: /\b[A-Z]{5}\d{4}[A-Z]\b/ },
  { name: 'phone_like', regex: /(?:\+91[-\s]?)?[6-9]\d{9}/ },
  { name: 'raw_secret_placeholder_bypass', regex: /(client_secret|password|token)\s*[:=]\s*['"](?!\[REDACTED\])[^'"]{8,}/i }
];
const extensions = new Set(['.ts', '.tsx', '.js', '.mjs', '.json', '.md', '.sql', '.prisma', '.txt']);
const findings = [];
function walk(path) {
  if (path.includes('/node_modules/') || path.includes('/.next/') || path.includes('/dist/') || path.includes('/.turbo/')) return;
  const stat = statSync(path);
  if (stat.isDirectory()) {
    for (const child of readdirSync(path)) walk(join(path, child));
    return;
  }
  if (![...extensions].some((ext) => path.endsWith(ext))) return;
  const text = readFileSync(path, 'utf8');
  for (const pattern of patterns) {
    if (pattern.regex.test(text)) findings.push({ path, pattern: pattern.name });
  }
}
for (const root of roots) walk(root);
if (findings.length) {
  console.error(JSON.stringify(findings, null, 2));
  process.exit(1);
}
console.log('synthetic fixture and scaffold PII scan passed');
