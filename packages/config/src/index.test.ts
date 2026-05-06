import { describe, expect, it } from 'vitest';
import { deploymentBoundary, RedactedEnvSchema } from './index';

describe('deploymentBoundary', () => {
  it('keeps GOV-01 on Railway and Vercel without AWS scaffold', () => {
    expect(deploymentBoundary.backend).toBe('railway');
    expect(deploymentBoundary.frontend).toBe('vercel');
    expect(deploymentBoundary.awsScaffoldAllowed).toBe(false);
  });

  it('defaults document storage to synthetic-only deferral', () => {
    expect(RedactedEnvSchema.parse({}).DOCUMENT_STORAGE_MODE).toBe('deferred_synthetic_only');
  });
});
