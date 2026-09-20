// ===== أنواع البيانات الأساسية =====

export type RoleKey =
  | 'storekeeper' // أمين المستودع
  | 'purchasing' // مسؤول المشتريات
  | 'siteSupervisor' // مشرف الموقع
  | 'logisticsSupervisor' // المشرف اللوجستي
  | 'omSuperintendent' // مدير العمليات والصيانة
  | 'siteManager' // مدير الموقع
  | 'projectManagement' // إدارة المشروع
  | 'admin' // مدير النظام

export interface Attachment {
  id: string
  name: string
  dataUrl: string // base64
  size: number
  mime: string
  uploadedAt: string
  uploadedBy: string
}

export interface Item {
  id: string
  partNo: string
  description: string
  uom: string // وحدة القياس
  category: string
  minStock: number
}

export type MovementType = 'in' | 'out'

export interface Movement {
  id: string
  type: MovementType
  voucherNo: string // رقم السند
  itemId: string
  kind?: 'warehouse' | 'janitorial' | 'consumables' // مصدر الصنف (افتراضياً المستودع)
  qty: number
  date: string
  refNo?: string // مرجع / أمر شراء
  mrfId?: string // مرتبط بطلب شراء
  notes?: string
  attachments: Attachment[]
  receivedBy?: string
  createdBy: string
  createdAt: string
}

export type Priority = 'normal' | 'urgent' | 'top'

export interface MrfItem {
  id: string
  partNo: string
  description: string
  qty: number
  uom: string
  onHand: number // المتاح بالمخزن
  remarks?: string
  estimatedPrice?: number // السعر التقديري للوحدة
}

export type ApprovalStatus = 'pending' | 'approved' | 'rejected'

export interface Approval {
  role: RoleKey
  status: ApprovalStatus
  by?: string
  at?: string
  note?: string
}

export type MrfStatus = 'pending' | 'approved' | 'rejected'

export interface Mrf {
  id: string
  mrfNo: string
  site: string
  department: string
  facility: string
  requiredDate: string
  requestedBy: string
  employeeNo: string
  date: string
  priority: Priority
  items: MrfItem[]
  remarks?: string
  workOrder?: string
  quotation?: Attachment // عرض السعر (إلزامي إذا تجاوز بند 500 ريال)
  approvals: Approval[]
  status: MrfStatus
  createdAt: string
}

export const QUOTATION_THRESHOLD = 500 // ريال

// ===== البيتي كاش =====

export interface PettyEntry {
  id: string
  month: string // اسم الشهر كما في ملف الإكسل (SEPT, OCT…)
  date: string
  department: string
  description: string
  invoiceNo: string
  qty: number | null
  unitPrice: number | null
  totalPrice: number | null // قبل الضريبة
  vat: number | null
  total: number | null // شامل الضريبة
  remarks: string | null
  imported: boolean
  by?: string // من قام بالتسجيل
}

// ===== النظافة / المستهلكات =====

export type StockKind = 'janitorial' | 'consumable'

export interface StockItem {
  id: string
  no: string
  airport: string
  section: string
  description: string
  manufacturer: string
  partNo: string
  uom: string
  qty: number // الوارد
  used: number // المستخدم
  remarks: string | null
  imported: boolean
}

export interface StockUsage {
  id: string
  itemId: string
  kind: StockKind
  qty: number
  note: string
  date: string
  by: string
}
