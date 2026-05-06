import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const requiredPaths = [
  'apps/api', 'apps/worker', 'apps/web', 'packages/contracts', 'packages/db',
  'packages/ui', 'packages/config', 'tests/e2e', 'tests/fixtures/synthetic',
  'infra/railway', 'infra/vercel', '.github/workflows/ci.yml', '.github/pull_request_template.md'
];

describe('GOV-01 scaffold contract', () => {
  it.each(requiredPaths)('contains %s', (path) => {
    expect(existsSync(path)).toBe(true);
  });

  it('does not scaffold AWS infra', () => {
    expect(existsSync('infra/aws')).toBe(false);
  });
});
