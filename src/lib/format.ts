/** تحليل التاريخ: يفهم DD/MM/YYYY و yyyy-mm-dd (ISO) — لا يعتمد على تفسير المتصفح */
function parseAnyDate(s: string): Date | null {
  const dm = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (dm) return new Date(Number(dm[3]), Number(dm[2]) - 1, Number(dm[1]))
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

export function fmtDate(iso?: string): string {
  if (!iso) return '—'
  const d = parseAnyDate(iso)
  if (!d) return iso
  return d.toLocaleDateString('ar-SA', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

export function fmtDateTime(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('ar-SA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩'

/** لغة الواجهة الحالية — تضبطها شاشة التطبيق الرئيسية عند تبديل اللغة */
let currentLang: 'ar' | 'en' = 'ar'
export function setMoneyLang(l: 'ar' | 'en'): void {
  currentLang = l
}

/** تحويل الأرقام الإنجليزية إلى أرقام عربية مع فواصل عربية */
function toArabicDigits(s: string): string {
  return s
    .replace(/[0-9]/g, (d) => AR_DIGITS[Number(d)])
    .replace(/,/g, '٬')
    .replace(/\./g, '٫')
}

/** المبالغ تتبع لغة الواجهة: أرقام عربية + ر.س في العربية، وأرقام إنجليزية + SAR في الإنجليزية */
export function fmtMoney(n?: number | null): string {
  if (n === undefined || n === null || Number.isNaN(n)) return '—'
  const s = n.toLocaleString('en-US', { maximumFractionDigits: 2 })
  return currentLang === 'ar' ? `${toArabicDigits(s)} ر.س` : `${s} SAR`
}

/** المبالغ بالأرقام الإنجليزية دائماً — للمستندات الرسمية الإنجليزية (نموذج MRF) */
export function fmtMoneyEn(n?: number | null): string {
  if (n === undefined || n === null || Number.isNaN(n)) return '—'
  return `${n.toLocaleString('en-US', { maximumFractionDigits: 2 })} SAR`
}

export function fmtSize(bytes: number): string {
  if (bytes <= 0) return ''
  if (bytes < 1024) return `${bytes} بايت`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} ك.ب`
  return `${(bytes / 1024 / 1024).toFixed(1)} م.ب`
}
