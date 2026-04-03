import { neon } from '@neondatabase/serverless';

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function query(text: string, params?: unknown[]): Promise<any[]> {
  const sql = neon(process.env.DATABASE_URL!, { fullResults: false });
  // neon supports (string, params[]) overload at runtime
  return (sql as any)(text, params);
}
