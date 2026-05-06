import { describe, expect, it } from 'vitest';
import { SyntheticClaimSummary } from './index';

describe('SyntheticClaimSummary', () => {
  it('accepts synthetic claim ids and hospital branch codes only', () => {
    const parsed = SyntheticClaimSummary.parse({
      claimId: 'synthetic_claim_001',
      hospitalBranchCode: 'branch_demo',
      status: 'query_pending',
      outstandingAmountPaise: 1250000
    });
    expect(parsed.status).toBe('query_pending');
  });
});
