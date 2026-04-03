import { neon } from '@neondatabase/serverless';

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function query(text: string, params?: unknown[]): Promise<any[]> {
  const sql = neon(process.env.DATABASE_URL!);
  return sql.query(text, params) as Promise<any[]>;
}
