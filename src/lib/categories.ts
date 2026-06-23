/**
 * Shared FAQ category hierarchy definition.
 * Used by both the API and frontend to ensure consistency.
 */

export interface SubcategoryDef {
  name: string;
}

export interface CategoryDef {
  name: string;
  icon: string;
  gradient: string;
  description: string;
  subcategories: string[];
}

export const FAQ_CATEGORIES: CategoryDef[] = [
  {
    name: 'Getting Started',
    icon: '🚀',
    gradient: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
    description: 'Everything you need to begin your internship journey',
    subcategories: ['Registration', 'Onboarding', 'First Steps', 'Account Setup'],
  },
  {
    name: 'Internship Experience',
    icon: '💼',
    gradient: 'linear-gradient(135deg, #f59e0b, #ef4444)',
    description: 'Day-to-day internship life, mentorship, and projects',
    subcategories: ['Daily Workflow', 'Mentorship', 'Projects', 'Team Collaboration'],
  },
  {
    name: 'Platforms & Technical Help',
    icon: '🖥️',
    gradient: 'linear-gradient(135deg, #10b981, #3b82f6)',
    description: 'LMS access, software tools, and troubleshooting',
    subcategories: ['LMS Access', 'Software Tools', 'Troubleshooting', 'Login Issues'],
  },
  {
    name: 'Policies & Guidelines',
    icon: '📋',
    gradient: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
    description: 'Attendance, code of conduct, and leave policies',
    subcategories: ['Attendance', 'Code of Conduct', 'Leave Policy', 'Working Hours'],
  },
  {
    name: 'Certificates & Completion',
    icon: '🎓',
    gradient: 'linear-gradient(135deg, #f59e0b, #10b981)',
    description: 'Certificate issuance, completion criteria, and evaluations',
    subcategories: ['Certificate Issuance', 'Completion Criteria', 'Feedback & Evaluation', 'Post-Internship'],
  },
  {
    name: 'Other',
    icon: '📦',
    gradient: 'linear-gradient(135deg, #64748b, #475569)',
    description: 'Uncategorized questions and miscellaneous topics',
    subcategories: ['General'],
  },
];

/**
 * Map of legacy freeform category values to the new hierarchy.
 * Keys are lowercase legacy category names, values are { category, subcategory }.
 */
export const LEGACY_CATEGORY_MAP: Record<string, { category: string; subcategory: string }> = {
  // Getting Started mappings
  'registration': { category: 'Getting Started', subcategory: 'Registration' },
  'onboarding': { category: 'Getting Started', subcategory: 'Onboarding' },
  'getting started': { category: 'Getting Started', subcategory: 'First Steps' },
  'account': { category: 'Getting Started', subcategory: 'Account Setup' },
  'account setup': { category: 'Getting Started', subcategory: 'Account Setup' },

  // Internship Experience mappings
  'internship': { category: 'Internship Experience', subcategory: 'Daily Workflow' },
  'internship experience': { category: 'Internship Experience', subcategory: 'Daily Workflow' },
  'mentorship': { category: 'Internship Experience', subcategory: 'Mentorship' },
  'projects': { category: 'Internship Experience', subcategory: 'Projects' },
  'team': { category: 'Internship Experience', subcategory: 'Team Collaboration' },

  // Platforms & Technical Help mappings
  'technical': { category: 'Platforms & Technical Help', subcategory: 'Troubleshooting' },
  'technical help': { category: 'Platforms & Technical Help', subcategory: 'Troubleshooting' },
  'lms': { category: 'Platforms & Technical Help', subcategory: 'LMS Access' },
  'software': { category: 'Platforms & Technical Help', subcategory: 'Software Tools' },
  'login': { category: 'Platforms & Technical Help', subcategory: 'Login Issues' },
  'platforms': { category: 'Platforms & Technical Help', subcategory: 'Software Tools' },

  // Policies & Guidelines mappings
  'policies': { category: 'Policies & Guidelines', subcategory: 'Code of Conduct' },
  'guidelines': { category: 'Policies & Guidelines', subcategory: 'Code of Conduct' },
  'attendance': { category: 'Policies & Guidelines', subcategory: 'Attendance' },
  'leave': { category: 'Policies & Guidelines', subcategory: 'Leave Policy' },
  'working hours': { category: 'Policies & Guidelines', subcategory: 'Working Hours' },
  'code of conduct': { category: 'Policies & Guidelines', subcategory: 'Code of Conduct' },

  // Certificates & Completion mappings
  'certificates': { category: 'Certificates & Completion', subcategory: 'Certificate Issuance' },
  'certificate': { category: 'Certificates & Completion', subcategory: 'Certificate Issuance' },
  'completion': { category: 'Certificates & Completion', subcategory: 'Completion Criteria' },
  'evaluation': { category: 'Certificates & Completion', subcategory: 'Feedback & Evaluation' },
  'feedback': { category: 'Certificates & Completion', subcategory: 'Feedback & Evaluation' },

  // Common legacy values mapped to best-fit
  'academics': { category: 'Internship Experience', subcategory: 'Projects' },
  'hostel': { category: 'Policies & Guidelines', subcategory: 'Code of Conduct' },
  'general': { category: 'Other', subcategory: 'General' },
  'other': { category: 'Other', subcategory: 'General' },
  'uncategorized': { category: 'Other', subcategory: 'General' },
  'misc': { category: 'Other', subcategory: 'General' },
};

/**
 * Resolve a legacy freeform category to the new hierarchy.
 * Returns the mapped category/subcategory or defaults to Getting Started > First Steps.
 */
export function resolveLegacyCategory(legacyCategory: string): { category: string; subcategory: string } {
  if (!legacyCategory || !legacyCategory.trim()) {
    return { category: 'Other', subcategory: 'General' };
  }

  const key = legacyCategory.trim().toLowerCase();

  // Direct match in legacy map
  if (LEGACY_CATEGORY_MAP[key]) {
    return LEGACY_CATEGORY_MAP[key];
  }

  // Check if it matches a main category name directly
  const mainCat = FAQ_CATEGORIES.find(c => c.name.toLowerCase() === key);
  if (mainCat) {
    return { category: mainCat.name, subcategory: mainCat.subcategories[0] };
  }

  // Check if it matches a subcategory name directly
  for (const cat of FAQ_CATEGORIES) {
    const sub = cat.subcategories.find(s => s.toLowerCase() === key);
    if (sub) {
      return { category: cat.name, subcategory: sub };
    }
  }

  // Partial match in legacy map keys
  for (const [mapKey, value] of Object.entries(LEGACY_CATEGORY_MAP)) {
    if (key.includes(mapKey) || mapKey.includes(key)) {
      return value;
    }
  }

  // Default — uncategorized FAQs go to "Other"
  return { category: 'Other', subcategory: 'General' };
}

/**
 * Resolve a FAQ's category/subcategory to a known category.
 * If the category exists in the provided list, use it; otherwise fall back to "Other > General".
 */
export function resolveToKnownCategory(
  faqCategory: string,
  faqSubcategory: string,
  knownCategories: CategoryDef[]
): { category: string; subcategory: string } {
  if (!faqCategory) {
    return { category: 'Other', subcategory: 'General' };
  }

  const cat = knownCategories.find(c => c.name === faqCategory);
  if (cat) {
    // Category exists; check if subcategory exists within it
    if (faqSubcategory && cat.subcategories.includes(faqSubcategory)) {
      return { category: faqCategory, subcategory: faqSubcategory };
    }
    // Subcategory doesn't match — use first subcategory of this category
    return { category: faqCategory, subcategory: cat.subcategories[0] || 'General' };
  }

  // Category not recognized — try legacy resolution
  const legacy = resolveLegacyCategory(faqCategory);
  const legacyCat = knownCategories.find(c => c.name === legacy.category);
  if (legacyCat) {
    return legacy;
  }

  // Fallback
  return { category: 'Other', subcategory: 'General' };
}

// =============================================
// Dynamic Category Management (MongoDB-backed)
// =============================================

import { getDb } from '@/lib/mongodb';

const CATEGORIES_COLLECTION = 'faq_categories';

/**
 * Get all categories from MongoDB. Seeds from FAQ_CATEGORIES if collection is empty.
 */
export async function getCategories(): Promise<CategoryDef[]> {
  const db = await getDb();
  const collection = db.collection(CATEGORIES_COLLECTION);

  let cats = await collection.find({}).sort({ order: 1, name: 1 }).toArray();

  // Seed if empty
  if (cats.length === 0) {
    const seedData = FAQ_CATEGORIES.map((cat, idx) => ({
      name: cat.name,
      icon: cat.icon,
      gradient: cat.gradient,
      description: cat.description,
      subcategories: cat.subcategories,
      isProtected: cat.name === 'Other', // "Other" cannot be deleted
      order: idx,
      createdAt: new Date(),
    }));
    await collection.insertMany(seedData);
    cats = await collection.find({}).sort({ order: 1, name: 1 }).toArray();
  }

  return cats.map(cat => ({
    name: cat.name,
    icon: cat.icon || '📁',
    gradient: cat.gradient || 'linear-gradient(135deg, #64748b, #475569)',
    description: cat.description || '',
    subcategories: cat.subcategories || [],
  }));
}

/**
 * Add a new category to MongoDB.
 */
export async function addCategory(category: {
  name: string;
  icon?: string;
  gradient?: string;
  description?: string;
  subcategories?: string[];
}): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  const collection = db.collection(CATEGORIES_COLLECTION);

  // Check for duplicate name
  const existing = await collection.findOne({ name: category.name });
  if (existing) {
    return { success: false, error: 'Category already exists' };
  }

  const count = await collection.countDocuments();
  await collection.insertOne({
    name: category.name,
    icon: category.icon || '📁',
    gradient: category.gradient || 'linear-gradient(135deg, #64748b, #475569)',
    description: category.description || '',
    subcategories: category.subcategories || ['General'],
    isProtected: false,
    order: count,
    createdAt: new Date(),
  });

  return { success: true };
}

/**
 * Delete a category from MongoDB. Moves FAQs to "Other > General".
 */
export async function deleteCategory(categoryName: string): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  const collection = db.collection(CATEGORIES_COLLECTION);

  const existing = await collection.findOne({ name: categoryName });
  if (!existing) {
    return { success: false, error: 'Category not found' };
  }
  if (existing.isProtected) {
    return { success: false, error: 'Cannot delete the "Other" category' };
  }

  // Move all FAQs in this category to "Other > General"
  await db.collection('faqs').updateMany(
    { category: categoryName },
    { $set: { category: 'Other', subcategory: 'General', updatedAt: new Date() } }
  );

  await collection.deleteOne({ name: categoryName });
  return { success: true };
}

/**
 * Add a subcategory to an existing category.
 */
export async function addSubcategory(
  categoryName: string,
  subcategoryName: string
): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  const collection = db.collection(CATEGORIES_COLLECTION);

  const cat = await collection.findOne({ name: categoryName });
  if (!cat) {
    return { success: false, error: 'Category not found' };
  }

  if (cat.subcategories.includes(subcategoryName)) {
    return { success: false, error: 'Subcategory already exists' };
  }

  await collection.updateOne(
    { name: categoryName },
    { $push: { subcategories: subcategoryName } as any }
  );

  return { success: true };
}

/**
 * Delete a subcategory from a category. Moves FAQs to first remaining subcategory or "General".
 */
export async function deleteSubcategory(
  categoryName: string,
  subcategoryName: string
): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  const collection = db.collection(CATEGORIES_COLLECTION);

  const cat = await collection.findOne({ name: categoryName });
  if (!cat) {
    return { success: false, error: 'Category not found' };
  }

  if (!cat.subcategories.includes(subcategoryName)) {
    return { success: false, error: 'Subcategory not found' };
  }

  // Must keep at least one subcategory
  if (cat.subcategories.length <= 1) {
    return { success: false, error: 'Cannot delete the last subcategory' };
  }

  // Get fallback subcategory (first one that isn't the one being deleted)
  const fallback = cat.subcategories.find((s: string) => s !== subcategoryName) || 'General';

  // Move FAQs
  await db.collection('faqs').updateMany(
    { category: categoryName, subcategory: subcategoryName },
    { $set: { subcategory: fallback, updatedAt: new Date() } }
  );

  await collection.updateOne(
    { name: categoryName },
    { $pull: { subcategories: subcategoryName } as any }
  );

  return { success: true };
}
