import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { query } from './db';

const JWT_SECRET = process.env.JWT_SECRET || 'goodfood-secret-key-change-in-production';
const COOKIE_NAME = 'auth_token';

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: 'master' | 'manager' | 'partner';
  status: string;
  customer_id: number | null;
  allowed_tabs?: string[] | null;
  can_view_margin?: boolean;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function createToken(user: AuthUser): string {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role, customer_id: user.customer_id, allowed_tabs: user.allowed_tabs ?? null, can_view_margin: !!user.can_view_margin },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function verifyToken(token: string): AuthUser | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthUser;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function getUserById(id: number) {
  const rows = await query('SELECT * FROM users WHERE id = $1', [id]);
  return rows[0] || null;
}

export async function login(email: string, password: string): Promise<{ token: string; user: AuthUser } | null> {
  const rows = await query('SELECT * FROM users WHERE email = $1', [email]);
  if (rows.length === 0) return null;

  const user = rows[0];
  if (user.status !== 'approved') return null;

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) return null;

  const authUser: AuthUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
    customer_id: user.customer_id,
    allowed_tabs: user.allowed_tabs || null,
    can_view_margin: !!user.can_view_margin,
  };

  return { token: createToken(authUser), user: authUser };
}
