import { z } from 'zod';

export const ClaimWorklistStatus = z.enum(['query_pending', 'preauth_pending', 'settlement_pending', 'short_payment_review']);
export type ClaimWorklistStatus = z.infer<typeof ClaimWorklistStatus>;

export const SyntheticClaimSummary = z.object({
  claimId: z.string().startsWith('synthetic_'),
  hospitalBranchCode: z.string().startsWith('branch_'),
  status: ClaimWorklistStatus,
  outstandingAmountPaise: z.number().int().nonnegative()
});
export type SyntheticClaimSummary = z.infer<typeof SyntheticClaimSummary>;
