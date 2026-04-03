import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { login, hashPassword, getSession } from '@/lib/auth';

// POST /api/auth - 로그인 또는 회원가입
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'login') {
      const result = await login(body.email, body.password);
      if (!result) {
        return NextResponse.json({ error: '이메일 또는 비밀번호가 올바르지 않거나, 승인 대기 중입니다.' }, { status: 401 });
      }
      const response = NextResponse.json({ user: result.user });
      response.cookies.set('auth_token', result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60, // 7일
        path: '/',
      });
      return response;
    }

    if (action === 'register') {
      const { email, password, name, customer_id } = body;
      if (!email || !password || !name) {
        return NextResponse.json({ error: '필수 항목을 입력하세요' }, { status: 400 });
      }
      // 중복 확인
      const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
      if (existing.length > 0) {
        return NextResponse.json({ error: '이미 등록된 이메일입니다' }, { status: 400 });
      }
      const hash = await hashPassword(password);
      await query(
        'INSERT INTO users (email, password_hash, name, role, status, customer_id) VALUES ($1, $2, $3, $4, $5, $6)',
        [email, hash, name, 'partner', 'pending', customer_id || null]
      );
      return NextResponse.json({ message: '회원가입이 완료되었습니다. 관리자 승인 후 로그인할 수 있습니다.' }, { status: 201 });
    }

    if (action === 'logout') {
      const response = NextResponse.json({ success: true });
      response.cookies.delete('auth_token');
      return response;
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err) {
    console.error('Auth API error:', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다. DB 연결을 확인하세요.' }, { status: 500 });
  }
}

// GET /api/auth - 현재 세션 확인
export async function GET() {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
  return NextResponse.json({ user });
}
