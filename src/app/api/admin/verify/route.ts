import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

// GET /api/admin/verify — check if current session is admin and return role
export async function GET() {
  try {
    const cookieStore = await cookies();
    const adminToken = cookieStore.get('admin_token');
    const adminRole = cookieStore.get('admin_role');
    const adminUsername = cookieStore.get('admin_username');

    if (adminToken && adminToken.value === 'authenticated') {
      return Response.json({
        authenticated: true,
        role: adminRole?.value || 'admin',
        username: adminUsername?.value || null,
      });
    }

    return Response.json({ authenticated: false }, { status: 401 });
  } catch (error) {
    console.error('GET /api/admin/verify error:', error);
    return Response.json({ authenticated: false }, { status: 500 });
  }
}
