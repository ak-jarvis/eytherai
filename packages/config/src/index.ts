import { z } from 'zod';

export const deploymentBoundary = {
  backend: 'railway',
  frontend: 'vercel',
  objectStorage: 'deferred_synthetic_only',
  awsScaffoldAllowed: false
} as const;

export const RedactedEnvSchema = z.object({
  DATABASE_URL: z.string().min(1).optional(),
  API_BASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_API_BASE_URL: z.string().url().optional(),
  DOCUMENT_STORAGE_MODE: z.literal('deferred_synthetic_only').default('deferred_synthetic_only')
});

export const redactionTerms = [
  'raw_mime',
  'oauth_token',
  'policy_member_id',
  'phone_address',
  'hospital_document_text'
] as const;
