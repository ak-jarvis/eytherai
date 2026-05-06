import { existsSync } from 'node:fs';

const required = [
  'apps/api', 'apps/worker', 'apps/web', 'packages/contracts', 'packages/db',
  'packages/ui', 'packages/config', 'tests/e2e', 'tests/fixtures/synthetic',
  'infra/railway', 'infra/vercel', '.github/workflows/ci.yml', '.github/pull_request_template.md'
];
const forbidden = ['infra/aws'];
const missing = required.filter((path) => !existsSync(path));
const presentForbidden = forbidden.filter((path) => existsSync(path));
if (missing.length || presentForbidden.length) {
  console.error(JSON.stringify({ missing, presentForbidden }, null, 2));
  process.exit(1);
}
console.log('scaffold lint passed');
