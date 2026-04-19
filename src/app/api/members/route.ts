import { query } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

// 마스터 전용: 회원 목록 조회
export async function GET() {
  const session = await getSession();
  if (!session || session.role !== 'master') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const data = await query(`
    SELECT u.*, c.company_name
    FROM users u
    LEFT JOIN customers c ON u.customer_id = c.id
    ORDER BY
      CASE u.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,
      u.created_at DESC
  `);
  return NextResponse.json(data);
}

// 마스터 전용: 회원 상태 변경 (승인/거절/삭제)
export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'master') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id, action, customer_id, role, allowed_tabs } = await request.json();

  if (action === 'approve') {
    await query('UPDATE users SET status = $1, customer_id = $2 WHERE id = $3', ['approved', customer_id, id]);
    return NextResponse.json({ success: true });
  }
  if (action === 'reject') {
    await query('UPDATE users SET status = $1 WHERE id = $2', ['rejected', id]);
    return NextResponse.json({ success: true });
  }
  if (action === 'delete') {
    await query('DELETE FROM users WHERE id = $1 AND role != $2', [id, 'master']);
    return NextResponse.json({ success: true });
  }
  if (action === 'update_role') {
    // 매니저 권한 설정 (master ↔ manager ↔ partner 변경 포함)
    if (!['master', 'manager', 'partner'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }
    await query('UPDATE users SET role = $1 WHERE id = $2 AND role != $3', [role, id, 'master']);
    return NextResponse.json({ success: true });
  }
  if (action === 'update_tabs') {
    // 매니저 탭 권한 설정 (JSONB 배열)
    const tabs = Array.isArray(allowed_tabs) ? JSON.stringify(allowed_tabs) : null;
    await query('UPDATE users SET allowed_tabs = $1::jsonb WHERE id = $2 AND role = $3', [tabs, id, 'manager']);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
