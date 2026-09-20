// ترجمة أسماء الأقسام كما هي مسجلة في خلية القسم (SECTION)
export const SECTION_AR: Record<string, string> = {
  ELECTRICAL: 'كهرباء',
  MECHANIC: 'ميكانيكا',
  'A/C': 'تكييف',
  AC: 'تكييف',
  'POWER PLANT': 'محطة توليد',
  CIVIL: 'أعمال مدنية',
  AFL: 'إضاءة المدرج',
  COMMUNICATION: 'اتصالات',
  'LAND SCAPE': 'تنسيق المواقع',
  'CIVIL PAINT': 'دهانات',
  'CAMP BUILDING': 'مباني المعسكر',
  'P&G': 'P&G',
  'MOTOR  POOL': 'حظيرة المركبات',
  'MOTOR POOL': 'حظيرة المركبات',
  SAFTEY: 'السلامة',
  CLEANLINESS: 'النظافة',
  'ELECTRICITY & AFL': 'كهرباء وإضاءة مدرج',
  'POWER PLANT &MOTOR POOL': 'محطة توليد ومركبات',
  ELECTRONIC: 'إلكترونيات',
  JANITORIAL: 'النظافة',
}

/** اسم القسم معروضاً: بالعربية مترجماً وبالإنجليزية كما هو مسجل */
export function sectionLabel(section: string, lang: 'ar' | 'en'): string {
  const s = (section ?? '').trim()
  if (!s) return lang === 'ar' ? 'بدون قسم' : 'No section'
  if (lang === 'en') return s
  return SECTION_AR[s.toUpperCase()] ?? s
}
