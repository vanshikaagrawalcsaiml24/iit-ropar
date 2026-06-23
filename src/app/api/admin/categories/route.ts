import { type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { sanitizeInput } from '@/lib/security';
import {
  getCategories,
  addCategory,
  deleteCategory,
  addSubcategory,
  deleteSubcategory,
} from '@/lib/categories';

export const dynamic = 'force-dynamic';

// Helper to check super admin authentication
async function isSuperAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const adminToken = cookieStore.get('admin_token');
  const adminRole = cookieStore.get('admin_role');
  return !!(
    adminToken?.value === 'authenticated' &&
    adminRole?.value === 'super_admin'
  );
}

// Helper to check admin authentication (admin or super_admin)
async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const adminToken = cookieStore.get('admin_token');
  const adminRole = cookieStore.get('admin_role');
  return !!(
    adminToken?.value === 'authenticated' &&
    (adminRole?.value === 'super_admin' || adminRole?.value === 'admin')
  );
}

// GET /api/admin/categories — fetch all dynamic categories
export async function GET() {
  try {
    if (!(await isAdmin())) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const categories = await getCategories();
    return Response.json({ categories });
  } catch (error) {
    console.error('GET /api/admin/categories error:', error);
    return Response.json({ error: 'Failed to fetch categories' }, { status: 500 });
  }
}

// POST /api/admin/categories — add a category or subcategory (super_admin only)
export async function POST(request: NextRequest) {
  try {
    if (!(await isSuperAdmin())) {
      return Response.json({ error: 'Unauthorized — super admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { action } = body;

    if (action === 'add_category') {
      const name = sanitizeInput(body.name || '').trim();
      const icon = (body.icon || '📁').trim();
      const description = sanitizeInput(body.description || '').trim();
      const subcategories = (body.subcategories || ['General']).map((s: string) => sanitizeInput(s).trim()).filter(Boolean);

      if (!name) {
        return Response.json({ error: 'Category name is required' }, { status: 400 });
      }

      const result = await addCategory({ name, icon, description, subcategories });
      if (!result.success) {
        return Response.json({ error: result.error }, { status: 400 });
      }

      return Response.json({ success: true, message: `Category "${name}" created` });
    }

    if (action === 'add_subcategory') {
      const categoryName = sanitizeInput(body.categoryName || '').trim();
      const subcategoryName = sanitizeInput(body.subcategoryName || '').trim();

      if (!categoryName || !subcategoryName) {
        return Response.json({ error: 'Category and subcategory names are required' }, { status: 400 });
      }

      const result = await addSubcategory(categoryName, subcategoryName);
      if (!result.success) {
        return Response.json({ error: result.error }, { status: 400 });
      }

      return Response.json({ success: true, message: `Subcategory "${subcategoryName}" added to "${categoryName}"` });
    }

    return Response.json({ error: 'Invalid action. Use "add_category" or "add_subcategory"' }, { status: 400 });
  } catch (error) {
    console.error('POST /api/admin/categories error:', error);
    return Response.json({ error: 'Failed to process category action' }, { status: 500 });
  }
}

// DELETE /api/admin/categories — delete a category or subcategory (super_admin only)
export async function DELETE(request: NextRequest) {
  try {
    if (!(await isSuperAdmin())) {
      return Response.json({ error: 'Unauthorized — super admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { action } = body;

    if (action === 'delete_category') {
      const categoryName = sanitizeInput(body.categoryName || '').trim();
      if (!categoryName) {
        return Response.json({ error: 'Category name is required' }, { status: 400 });
      }

      const result = await deleteCategory(categoryName);
      if (!result.success) {
        return Response.json({ error: result.error }, { status: 400 });
      }

      return Response.json({ success: true, message: `Category "${categoryName}" deleted. FAQs moved to "Other".` });
    }

    if (action === 'delete_subcategory') {
      const categoryName = sanitizeInput(body.categoryName || '').trim();
      const subcategoryName = sanitizeInput(body.subcategoryName || '').trim();

      if (!categoryName || !subcategoryName) {
        return Response.json({ error: 'Category and subcategory names are required' }, { status: 400 });
      }

      const result = await deleteSubcategory(categoryName, subcategoryName);
      if (!result.success) {
        return Response.json({ error: result.error }, { status: 400 });
      }

      return Response.json({ success: true, message: `Subcategory "${subcategoryName}" deleted from "${categoryName}"` });
    }

    return Response.json({ error: 'Invalid action. Use "delete_category" or "delete_subcategory"' }, { status: 400 });
  } catch (error) {
    console.error('DELETE /api/admin/categories error:', error);
    return Response.json({ error: 'Failed to process category deletion' }, { status: 500 });
  }
}
