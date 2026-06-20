import { type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { getDb } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

// Helper to check super admin auth
async function isSuperAdmin(): Promise<boolean> {
    const cookieStore = await cookies();
    const adminToken = cookieStore.get('admin_token');
    const adminRole = cookieStore.get('admin_role');
    return !!(adminToken?.value === 'authenticated' && adminRole?.value === 'super_admin');
}

// GET /api/admin/manage-admins — list all admin accounts (super admin only)
export async function GET() {
    try {
        if (!(await isSuperAdmin())) {
            return Response.json({ error: 'Unauthorized — Super Admin access required' }, { status: 403 });
        }

        const db = await getDb();
        const admins = await db.collection('admins')
            .find({}, { projection: { password: 0 } })
            .sort({ createdAt: -1 })
            .toArray();

        return Response.json({ admins });
    } catch (error) {
        console.error('GET /api/admin/manage-admins error:', error);
        return Response.json({ error: 'Failed to fetch admins' }, { status: 500 });
    }
}

// POST /api/admin/manage-admins — create a new admin account (super admin only)
export async function POST(request: NextRequest) {
    try {
        if (!(await isSuperAdmin())) {
            return Response.json({ error: 'Unauthorized — Super Admin access required' }, { status: 403 });
        }

        const body = await request.json();
        const { username, password } = body;

        if (!username || !password) {
            return Response.json({ error: 'Username and password are required' }, { status: 400 });
        }

        const cleanUsername = username.toLowerCase().trim();
        if (cleanUsername.length < 3 || cleanUsername.length > 30) {
            return Response.json({ error: 'Username must be 3-30 characters' }, { status: 400 });
        }

        if (password.length < 6) {
            return Response.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
        }

        const db = await getDb();

        // Check for duplicate username
        const existing = await db.collection('admins').findOne({ username: cleanUsername });
        if (existing) {
            return Response.json({ error: 'An admin with this username already exists' }, { status: 409 });
        }

        const result = await db.collection('admins').insertOne({
            username: cleanUsername,
            password, // In production, hash this
            active: true,
            createdAt: new Date(),
        });

        return Response.json({
            success: true,
            admin: {
                _id: result.insertedId.toString(),
                username: cleanUsername,
                active: true,
            },
        }, { status: 201 });
    } catch (error) {
        console.error('POST /api/admin/manage-admins error:', error);
        return Response.json({ error: 'Failed to create admin' }, { status: 500 });
    }
}

// DELETE /api/admin/manage-admins — delete an admin account (super admin only)
export async function DELETE(request: NextRequest) {
    try {
        if (!(await isSuperAdmin())) {
            return Response.json({ error: 'Unauthorized — Super Admin access required' }, { status: 403 });
        }

        const body = await request.json();
        const { id } = body;

        if (!id || !/^[a-f0-9]{24}$/.test(id)) {
            return Response.json({ error: 'Valid admin ID is required' }, { status: 400 });
        }

        const db = await getDb();
        const result = await db.collection('admins').deleteOne({ _id: new ObjectId(id) });

        if (result.deletedCount === 0) {
            return Response.json({ error: 'Admin not found' }, { status: 404 });
        }

        return Response.json({ success: true });
    } catch (error) {
        console.error('DELETE /api/admin/manage-admins error:', error);
        return Response.json({ error: 'Failed to delete admin' }, { status: 500 });
    }
}
