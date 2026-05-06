export function databaseUrlFromEnv(env: NodeJS.ProcessEnv = process.env): string {
  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL must be provided by Railway env or local synthetic dev env');
  }
  return env.DATABASE_URL;
}
