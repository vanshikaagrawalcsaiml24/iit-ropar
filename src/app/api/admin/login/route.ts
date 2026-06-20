import { type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { getDb } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

// POST /api/admin/login — validate admin password with role support
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { password, role, username } = body;

    const cookieStore = await cookies();

    if (role === 'super_admin') {
      // Super Admin login — password from env
      const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || 'superadmin123';
      if (password !== superAdminPassword) {
        return Response.json({ error: 'Invalid super admin password' }, { status: 401 });
      }

      cookieStore.set('admin_token', 'authenticated', {
        httpOnly: true,
        path: '/',
        maxAge: 60 * 60 * 24,
        sameSite: 'strict',
      });
      cookieStore.set('admin_role', 'super_admin', {
        httpOnly: true,
        path: '/',
        maxAge: 60 * 60 * 24,
        sameSite: 'strict',
      });

      return Response.json({ success: true, role: 'super_admin' });
    }

    if (role === 'admin') {
      // Admin login — validate against MongoDB admins collection
      if (!username || !password) {
        return Response.json({ error: 'Username and password are required' }, { status: 400 });
      }

      const db = await getDb();
      const admin = await db.collection('admins').findOne({
        username: username.toLowerCase().trim(),
      });

      if (!admin || admin.password !== password) {
        return Response.json({ error: 'Invalid admin credentials' }, { status: 401 });
      }

      if (!admin.active) {
        return Response.json({ error: 'This admin account has been deactivated' }, { status: 403 });
      }

      cookieStore.set('admin_token', 'authenticated', {
        httpOnly: true,
        path: '/',
        maxAge: 60 * 60 * 24,
        sameSite: 'strict',
      });
      cookieStore.set('admin_role', 'admin', {
        httpOnly: true,
        path: '/',
        maxAge: 60 * 60 * 24,
        sameSite: 'strict',
      });
      cookieStore.set('admin_username', admin.username, {
        httpOnly: true,
        path: '/',
        maxAge: 60 * 60 * 24,
        sameSite: 'strict',
      });

      return Response.json({ success: true, role: 'admin', username: admin.username });
    }

    // Legacy fallback — old single-password system
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    if (password !== adminPassword) {
      return Response.json({ error: 'Invalid password' }, { status: 401 });
    }

    cookieStore.set('admin_token', 'authenticated', {
      httpOnly: true,
      path: '/',
      maxAge: 60 * 60 * 24,
      sameSite: 'strict',
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('POST /api/admin/login error:', error);
    return Response.json({ error: 'Login failed' }, { status: 500 });
  }
}
