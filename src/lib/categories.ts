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
  'general': { category: 'Getting Started', subcategory: 'First Steps' },
};

/**
 * Resolve a legacy freeform category to the new hierarchy.
 * Returns the mapped category/subcategory or defaults to Getting Started > First Steps.
 */
export function resolveLegacyCategory(legacyCategory: string): { category: string; subcategory: string } {
  if (!legacyCategory || !legacyCategory.trim()) {
    return { category: 'Getting Started', subcategory: 'First Steps' };
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

  // Default
  return { category: 'Getting Started', subcategory: 'First Steps' };
}
