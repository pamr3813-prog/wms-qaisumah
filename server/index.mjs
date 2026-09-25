// خادم نظام المستودعات والمشتريات — مزامنة سحابية لحظية (WebSocket) + صلاحيات + إشعارات + تصدير Excel
// التشغيل: node server/index.mjs   (المنفذ 7101، ويتم الوصول عبر proxy من خادم Vite على /api و /ws)
import { createServer } from 'http'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { WebSocketServer } from 'ws'
import express from 'express'
import ExcelJS from 'exceljs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT || process.env.WMS_PORT || 7101
/* مسار قاعدة البيانات: قرص دائم على Render، أو ملف محلي في التطوير */
const DATA_FILE = process.env.WMS_DATA_FILE || join(__dirname, 'data.json')
/* لقطة احتياطية مرفقة بالكود — تُستعيد تلقائياً عندما يكون القرص الدائم فارغاً (أول إقلاع) */
const SNAPSHOT_FILE = join(__dirname, 'data.snapshot.json')

const uid = () => Math.random().toString(36).slice(2, 10)

// ===== الصلاحيات =====
export const PERMS = {
  canEditVouchers: ['logisticsSupervisor', 'admin'], // الاستلامات وجداول الصرف
  canEditItems: ['storekeeper', 'logisticsSupervisor', 'admin'],
  canEditPetty: ['logisticsSupervisor', 'admin'], // شيتات الإكسل: اللوجستيك فقط
  canIssueStock: ['logisticsSupervisor', 'admin'],
  canManageUsers: ['admin'],
  canCreateMrf: ['storekeeper', 'purchasing', 'siteSupervisor', 'logisticsSupervisor', 'omSuperintendent', 'siteManager', 'admin'],
}
const has = (user, perm) => {
  if (!user) return false
  const base = !!PERMS[perm]?.includes(user.role)
  const o = user.permOverrides?.[perm]
  return o === undefined ? base : !!o
}

// ===== البذر =====
function buildSeed() {
  const read = (f) => JSON.parse(readFileSync(join(__dirname, 'seed', f), 'utf-8'))
  const pettyRows = read('petty.json').filter((p) => p.description && !/NO\s*PETTY/i.test(p.description))
  const jan = read('janitorial.json')
  const con = read('consumable.json')
  const now = new Date().toISOString()

  const items = [
    { id: 'it1', partNo: 'FLT-001', description: 'فلتر هواء لمكيف مركزي', uom: 'قطعة', category: 'تكييف', minStock: 10 },
    { id: 'it2', partNo: 'BRG-220', description: 'بلية محرك 220 ملم', uom: 'قطعة', category: 'ميكانيكا', minStock: 5 },
    { id: 'it3', partNo: 'OIL-46', description: 'زيت هيدروليك ISO 46', uom: 'برميل', category: 'زيوت', minStock: 4 },
    { id: 'it4', partNo: 'LMP-LED', description: 'لمبة LED صناعية 100 واط', uom: 'قطعة', category: 'كهرباء', minStock: 20 },
    { id: 'it5', partNo: 'BLT-M12', description: 'برغي شد M12 × 50', uom: 'علبة', category: 'مسامير', minStock: 15 },
  ]
  const movements = [
    { id: uid(), type: 'in', voucherNo: 'IN-0001', itemId: 'it1', qty: 25, date: now, refNo: 'PO-1001', notes: 'استلام دفعة أولى', attachments: [], createdBy: 'أمين المستودع', createdAt: now },
    { id: uid(), type: 'in', voucherNo: 'IN-0002', itemId: 'it3', qty: 6, date: now, refNo: 'PO-1002', notes: '', attachments: [], createdBy: 'أمين المستودع', createdAt: now },
    { id: uid(), type: 'out', voucherNo: 'OUT-0001', itemId: 'it1', qty: 4, date: now, notes: 'صرف لصيانة دورية', attachments: [], createdBy: 'أمين المستودع', createdAt: now },
  ]
  const mrfs = [
    {
      id: 'mrf1', mrfNo: 'MRF-0001', site: 'مطار الملك فهد الدولي', department: 'الصيانة الميكانيكية',
      facility: 'المبنى الرئيسي - محطة التكييف', requiredDate: '2026-09-30', requestedBy: 'م. خالد العتيبي',
      employeeNo: 'EMP-1024', date: '2026-09-18', priority: 'urgent',
      items: [
        { id: uid(), partNo: 'BRG-220', description: 'بلية محرك 220 ملم', qty: 2, uom: 'قطعة', onHand: 0, remarks: 'لصيانة الطلمبة الرئيسية', estimatedPrice: 350 },
        { id: uid(), partNo: 'OIL-46', description: 'زيت هيدروليك ISO 46', qty: 2, uom: 'برميل', onHand: 6, remarks: '', estimatedPrice: 280 },
      ],
      remarks: 'مطلوب قبل موعد الصيانة الوقائية الشهرية', workOrder: 'WO-2026-118',
      approvals: [
        { role: 'siteSupervisor', status: 'approved', by: 'مشرف الموقع', at: '2026-09-18T10:30:00' },
        { role: 'logisticsSupervisor', status: 'approved', by: 'المشرف اللوجستي', at: '2026-09-18T13:05:00' },
        { role: 'omSuperintendent', status: 'pending' },
        { role: 'siteManager', status: 'pending' },
      ],
      status: 'pending', createdAt: '2026-09-18T09:00:00',
    },
    {
      id: 'mrf2', mrfNo: 'MRF-0002', site: 'مطار الملك فهد الدولي', department: 'الكهرباء',
      facility: 'المحطة الفرعية رقم 3', requiredDate: '2026-10-05', requestedBy: 'أ. ناصر القحطاني',
      employeeNo: 'EMP-2210', date: '2026-09-19', priority: 'normal',
      items: [
        { id: uid(), partNo: 'CBR-630A', description: 'قاطع رئيسي 630 أمبير ACB', qty: 1, uom: 'قطعة', onHand: 0, remarks: 'استبدال القاطع التالف', estimatedPrice: 1850 },
      ],
      remarks: 'يتطلب إرفاق عرض السعر — بند يتجاوز 500 ريال', workOrder: 'WO-2026-125',
      quotation: { id: uid(), name: 'عرض-سعر-قاطع-630A.pdf', dataUrl: '', size: 0, mime: 'application/pdf', uploadedAt: '2026-09-19T11:00:00', uploadedBy: 'مسؤول المشتريات' },
      approvals: [
        { role: 'siteSupervisor', status: 'approved', by: 'مشرف الموقع', at: '2026-09-19T09:15:00' },
        { role: 'logisticsSupervisor', status: 'approved', by: 'المشرف اللوجستي', at: '2026-09-20T11:00:00' },
        { role: 'omSuperintendent', status: 'pending' },
        { role: 'siteManager', status: 'pending' },
        { role: 'projectManagement', status: 'pending' },
      ],
      status: 'pending', createdAt: '2026-09-19T08:30:00',
    },
  ]

  const mkUser = (name, email, role, pin) => ({ id: uid(), name, email, role, pin, active: true, createdAt: now })

  return {
    items,
    movements,
    mrfs,
    pettyCash: pettyRows.map((p) => ({ id: uid(), month: p.sheet, date: p.date || '', department: p.department, description: p.description, invoiceNo: p.invoiceNo, qty: p.qty, unitPrice: p.unitPrice, totalPrice: p.totalPrice, vat: p.vat, total: p.total, remarks: p.remarks, imported: true, by: '' })),
    janitorial: jan.map((s) => ({ id: uid(), no: s.no, airport: s.airport, section: s.section, description: s.description, manufacturer: s.manufacturer, partNo: s.partNo, uom: s.uom, qty: s.qty || 0, used: s.used || 0, remarks: s.remarks, imported: true })),
    consumables: con.map((s) => ({ id: uid(), no: s.no, airport: s.airport, section: s.section, description: s.description, manufacturer: s.manufacturer, partNo: s.partNo, uom: s.uom, qty: s.qty || 0, used: s.used || 0, remarks: s.remarks, imported: true })),
    stockUsages: [],
    issuances: [],
    counters: { voucherIn: 2, voucherOut: 1, mrf: 2 },
    users: [
      mkUser('مدير النظام / System Admin', 'admin@qaisumah-airport.sa', 'admin', '1234'),
      mkUser('أمين المستودع / Storekeeper', 'store@qaisumah-airport.sa', 'storekeeper', '1111'),
      mkUser('مسؤول المشتريات / Purchasing Officer', 'purchasing@qaisumah-airport.sa', 'purchasing', '2222'),
      mkUser('مشرف الموقع / Site Supervisor', 'site.supervisor@qaisumah-airport.sa', 'siteSupervisor', '3333'),
      mkUser('المشرف اللوجستي / Logistics Supervisor', 'logistics@qaisumah-airport.sa', 'logisticsSupervisor', '4444'),
      mkUser('مدير العمليات والصيانة / O&M Superintendent', 'om@qaisumah-airport.sa', 'omSuperintendent', '5555'),
      mkUser('مدير الموقع / Site Manager', 'site.manager@qaisumah-airport.sa', 'siteManager', '6666'),
      mkUser('إدارة المشروع / Project Management', 'pm@almajal.com.sa', 'projectManagement', '7777'),
    ],
    comments: [],
    notifications: [],
    pettyClosed: {},
  }
}

// ===== التخزين السحابي (Supabase Storage) — اختياري عبر متغيرات البيئة =====
const SUPA_URL = process.env.SUPABASE_URL
const SUPA_KEY = process.env.SUPABASE_SERVICE_KEY
const SUPA_BUCKET = process.env.SUPABASE_BUCKET || 'wms-data'
const CLOUD_MODE = !!(SUPA_URL && SUPA_KEY)

async function cloudUpload(json) {
  const r = await fetch(`${SUPA_URL}/storage/v1/object/${SUPA_BUCKET}/data.json`, {
    method: 'PUT',
    headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, 'Content-Type': 'application/json' },
    body: json,
  })
  if (!r.ok) console.error('Supabase upload failed:', r.status, await r.text().catch(() => ''))
}

async function cloudDownload() {
  const r = await fetch(`${SUPA_URL}/storage/v1/object/${SUPA_BUCKET}/data.json`, {
    headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
  })
  if (r.status === 404) return null
  if (r.status === 400) {
    /* Supabase يرجع 400 NoSuchKey عند غياب الملف بدلاً من 404 */
    const body = await r.text().catch(() => '')
    if (body.includes('NoSuchKey') || body.includes('not_found')) return null
    throw new Error(`Supabase download failed: ${r.status} ${body.slice(0, 200)}`)
  }
  if (!r.ok) throw new Error(`Supabase download failed: ${r.status}`)
  return JSON.parse(await r.text())
}

function loadData() {
  if (existsSync(DATA_FILE)) {
    try { return JSON.parse(readFileSync(DATA_FILE, 'utf-8')) } catch { /* إعادة بذر */ }
  }
  /* القرص الدائم فارغ (أول إقلاع بعد إرفاق القرص): استعد من اللقطة المرفقة بالكود */
  if (existsSync(SNAPSHOT_FILE)) {
    try {
      const snap = JSON.parse(readFileSync(SNAPSHOT_FILE, 'utf-8'))
      saveData(snap)
      console.log('Restored data from bundled snapshot ->', DATA_FILE)
      return snap
    } catch { /* لقطة تالفة — أكمل لإعادة البذر */ }
  }
  const seed = buildSeed()
  saveData(seed)
  return seed
}

/* حفظ محلي فوري + رفع سحابي متتابع (حفاظاً على الترتيب) */
let cloudChain = Promise.resolve()
function saveData(db) {
  const json = JSON.stringify(db)
  try {
    mkdirSync(dirname(DATA_FILE), { recursive: true })
    writeFileSync(DATA_FILE, json)
  } catch (e) {
    console.error('local save failed:', e.message)
  }
  if (CLOUD_MODE) {
    cloudChain = cloudChain.then(() => cloudUpload(json)).catch((e) => console.error('cloud save:', e.message))
  }
}

async function initData() {
  if (CLOUD_MODE) {
    /* بذر إجباري مرة واحدة: القرص المحلي هو المرجع ويُرفق للسحابة فوق ما فيها */
    if (process.env.WMS_SEED_CLOUD === '1') {
      const local = loadData()
      await cloudUpload(JSON.stringify(local))
      console.log('WMS_SEED_CLOUD: uploaded local disk data to Supabase (local wins)')
      return local
    }
    try {
      const remote = await cloudDownload()
      if (remote) {
        writeFileSync(DATA_FILE, JSON.stringify(remote))
        console.log('Loaded data from Supabase cloud storage')
        return remote
      }
      /* أول تشغيل سحابي: ارفع نسخة البذر المحلية */
      const local = loadData()
      await cloudUpload(JSON.stringify(local))
      return local
    } catch (e) {
      console.error('Cloud load failed, falling back to local:', e.message)
    }
  }
  return loadData()
}

let db = await initData()
if (!db.issuances) db.issuances = []
db.pettyClosed ??= {}

// ===== تطبيع تواريخ البيتي كاش =====
// صيغ قديمة موجودة في البيانات: ISO بترتيب yyyy-dd-mm (اليوم في الوسط) و dd/m/yyyy المختصرة
// النتيجة الموحدة: 'DD/MM/YYYY'
function normPettyDate(v) {
  if (v == null || v === '') return ''
  const s = String(v).trim()
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/) // yyyy-dd-mm (من استيراد قديم معكوس)
  if (m) return `${m[2].padStart(2, '0')}/${m[3].padStart(2, '0')}/${m[1]}`
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/) // dd/mm/yyyy (اختصار بخانة واحدة)
  if (m) return `${m[1].padStart(2, '0')}/${m[2].padStart(2, '0')}/${m[3]}`
  return s
}
// تحويل 'DD/MM/YYYY' إلى كائن Date حقيقي — يُستخدم عند تصدير الإكسل
function parsePettyDate(v) {
  const s = normPettyDate(v)
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  if (!m) return null
  return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]))
}
let normalizedCount = 0
for (const p of db.pettyCash ?? []) {
  const n = normPettyDate(p.date)
  if (n !== p.date) { p.date = n; normalizedCount++ }
}
if (normalizedCount) console.log(`Normalized ${normalizedCount} petty cash dates`)
const sessions = new Map() // token -> userId

// ===== إشعارات =====
function notify(text, role = null, link = null) {
  db.notifications.unshift({ id: uid(), text, link, at: new Date().toISOString(), readBy: [], role })
  if (db.notifications.length > 200) db.notifications.length = 200
}

// ===== تطبيق الإجراءات ===== (يعيد الكيان المُنشأ عند الحاجة)
function applyAction(action, user) {
  const { type, payload } = action
  const now = new Date().toISOString()
  let result = null

  switch (type) {
    case 'addItem':
      if (!has(user, 'canEditItems')) throw new Error('غير مصرح')
      result = { ...payload, id: uid() }
      db.items.push(result)
      notify(`أضاف ${user.name} صنفاً جديداً: ${payload.description}`)
      break

    case 'deleteItem':
      if (!has(user, 'canEditItems')) throw new Error('غير مصرح')
      db.items = db.items.filter((i) => i.id !== payload.id)
      notify(`حذف ${user.name} الصنف (${payload.partNo})`)
      break

    case 'addMovement': {
      if (!has(user, 'canEditVouchers')) throw new Error('غير مصرح — تعديل الاستلامات وجداول الصرف للمشرف اللوجستيك فقط')
      const voucherNo = `${payload.type === 'in' ? 'IN' : 'OUT'}-${String((payload.type === 'in' ? db.counters.voucherIn : db.counters.voucherOut) + 1).padStart(4, '0')}`
      const movement = { ...payload, id: uid(), voucherNo, createdBy: user.name, createdAt: now }
      db.movements.unshift(movement)
      if (payload.type === 'in') db.counters.voucherIn++
      else db.counters.voucherOut++
      notify(`سجّل ${user.name} ${payload.type === 'in' ? 'سند وارد' : 'سند صادر'} ${voucherNo}`)
      break
    }

    case 'receiveModuleStock': {
      if (!has(user, 'canEditVouchers')) throw new Error('غير مصرح — تعديل الاستلامات وجداول الصرف للمشرف اللوجستيك فقط')
      const kind = payload.kind === 'janitorial' ? 'janitorial' : 'consumables'
      const item = db[kind].find((i) => i.id === payload.itemId)
      if (!item) throw new Error('البند غير موجود')
      if (!(payload.qty > 0)) throw new Error('الكمية يجب أن تكون أكبر من صفر')
      const voucherNo = `IN-${String(db.counters.voucherIn + 1).padStart(4, '0')}`
      db.counters.voucherIn++
      item.qty += payload.qty
      db.movements.unshift({
        id: uid(),
        itemId: item.id,
        kind,
        qty: payload.qty,
        type: 'in',
        date: payload.date || now.slice(0, 10),
        refNo: payload.refNo || undefined,
        note: payload.note || undefined,
        voucherNo,
        mrfId: undefined,
        attachments: [],
        receivedBy: user.name,
        createdBy: user.name,
        createdAt: now,
      })
      notify(`استلم ${user.name} ${payload.qty} ${item.uom} من «${item.description}» إلى ${kind === 'janitorial' ? 'مواد النظافة' : 'المستهلكات'} بسند ${voucherNo}`)
      break
    }

    case 'createMrf': {
      if (!has(user, 'canCreateMrf')) throw new Error('غير مصرح')
      const requiresQt = payload.items.some((i) => (i.estimatedPrice ?? 0) > 500)
      const chain = ['siteSupervisor', 'logisticsSupervisor', 'omSuperintendent', 'siteManager']
      if (requiresQt) chain.push('projectManagement')
      const mrf = {
        ...payload,
        id: uid(),
        mrfNo: `MRF-${String(db.counters.mrf + 1).padStart(4, '0')}`,
        approvals: chain.map((role) => ({ role, status: 'pending' })),
        status: 'pending',
        createdAt: now,
        createdBy: user.name,
      }
      db.mrfs.unshift(mrf)
      db.counters.mrf++
      result = mrf
      notify(`طلب شراء جديد ${mrf.mrfNo} من ${user.name} — بانتظار اعتماد مشرف الموقع`, null, `/purchases/${mrf.id}`)
      break
    }

    case 'decideApproval': {
      const { mrfId, approve, note } = payload
      const mrf = db.mrfs.find((m) => m.id === mrfId)
      if (!mrf) throw new Error('الطلب غير موجود')
      const approval = mrf.approvals.find((a) => a.status === 'pending')
      if (!approval) throw new Error('لا يوجد موقف بانتظار التوقيع')
      if (approval.role !== user.role) throw new Error(`غير مصرح — التوقيع مخصص لـ ${approval.role}`)
      if (!approve && !note?.trim()) throw new Error('يجب كتابة سبب الرفض / الملاحظات')
      approval.status = approve ? 'approved' : 'rejected'
      approval.by = user.name
      approval.at = now
      approval.note = note || undefined
      mrf.status = mrf.approvals.some((a) => a.status === 'rejected')
        ? 'rejected'
        : mrf.approvals.every((a) => a.status === 'approved')
          ? 'approved'
          : 'pending'
      const next = mrf.approvals.find((a) => a.status === 'pending')
      if (approve && !next && mrf.status === 'approved') {
        /* اكتملت كل التوقيعات — إرسال آلي إلى مسؤول المشتريات لتنفيذ الشراء */
        mrf.sentToPurchasingAt = now
        notify(`اكتملت التوقيعات على الطلب ${mrf.mrfNo} — أُرسل إليك آلياً لبدء التنفيذ والشراء`, 'purchasing', `/purchases/${mrf.id}`)
        notify(`اعتمد ${user.name} الطلب ${mrf.mrfNo} — اكتملت التوقيعات وأُرسل آلياً إلى مسؤول المشتريات`, null, `/purchases/${mrf.id}`)
      } else {
        notify(approve
          ? `اعتمد ${user.name} الطلب ${mrf.mrfNo}${next ? ` — بانتظار ${next.role}` : ' — اكتملت الاعتمادات'}`
          : `رفض ${user.name} الطلب ${mrf.mrfNo}: ${note}`, null, `/purchases/${mrf.id}`)
      }
      break
    }

    case 'addComment': {
      const mrf = db.mrfs.find((m) => m.id === payload.mrfId)
      if (!mrf) throw new Error('الطلب غير موجود')
      db.comments.push({ id: uid(), mrfId: payload.mrfId, author: user.name, role: user.role, text: payload.text, at: now })
      notify(`علق ${user.name} على الطلب ${mrf.mrfNo}: ${payload.text.slice(0, 80)}`, null, `/purchases/${mrf.id}`)
      break
    }

    case 'addPettyEntry':
      if (!has(user, 'canEditPetty')) throw new Error('غير مصرح — البيتي كاش للمشرف اللوجستي فقط')
      if (db.pettyClosed?.[payload.month]) throw new Error(`شهر ${payload.month} محفوظ (مغلق) — لا يمكن الإضافة إليه`)
      result = { ...payload, id: uid(), imported: false, by: user.name }
      db.pettyCash.unshift(result)
      notify(`سجّل ${user.name} مصروف بيتي كاش: ${payload.description}`)
      break

    case 'addStockItem':
      if (!has(user, 'canIssueStock')) throw new Error('غير مصرح')
      result = { ...payload.item, id: uid(), imported: false, by: user.name }
      if (payload.kind === 'janitorial') db.janitorial.push(result)
      else db.consumables.push(result)
      notify(`أضاف ${user.name} بنداً إلى ${payload.kind === 'janitorial' ? 'مواد النظافة' : 'المستهلكات'}: ${payload.item.description}`)
      break

    case 'recordUsage': {
      if (!has(user, 'canIssueStock')) throw new Error('غير مصرح')
      const list = payload.kind === 'janitorial' ? db.janitorial : db.consumables
      const item = list.find((i) => i.id === payload.itemId)
      if (!item) throw new Error('البند غير موجود')
      if (payload.qty > item.qty - item.used) throw new Error('الكمية أكبر من المتاح الفعلي')
      item.used += payload.qty
      db.stockUsages.unshift({ id: uid(), itemId: payload.itemId, kind: payload.kind, qty: payload.qty, note: payload.note, date: now, by: user.name })
      notify(`صرف ${user.name} ${payload.qty} ${item.uom} من «${item.description}»`)
      break
    }

    case 'updateStockItem': {
      if (!has(user, 'canIssueStock')) throw new Error('غير مصرح')
      const list = payload.kind === 'janitorial' ? db.janitorial : db.consumables
      const item = list.find((i) => i.id === payload.id)
      if (!item) throw new Error('البند غير موجود')
      const f = payload.fields || {}
      if (f.qty != null && Number(f.qty) < item.used) throw new Error(`الكمية الواردة لا يمكن أن تقل عن المستخدم (${item.used})`)
      for (const k of ['airport', 'section', 'description', 'manufacturer', 'partNo', 'uom', 'remarks']) {
        if (f[k] !== undefined) item[k] = f[k]
      }
      if (f.qty != null) item.qty = Number(f.qty)
      notify(`عدّل ${user.name} بنداً في ${payload.kind === 'janitorial' ? 'مواد النظافة' : 'المستهلكات'}: ${item.description}`)
      break
    }

    case 'deleteStockItem': {
      if (!has(user, 'canIssueStock')) throw new Error('غير مصرح')
      const key = payload.kind === 'janitorial' ? 'janitorial' : 'consumables'
      const item = db[key].find((i) => i.id === payload.id)
      if (!item) break
      db[key] = db[key].filter((i) => i.id !== payload.id)
      db.stockUsages = db.stockUsages.filter((u) => u.itemId !== payload.id)
      notify(`حذف ${user.name} بنداً من ${payload.kind === 'janitorial' ? 'مواد النظافة' : 'المستهلكات'}: ${item.description}`)
      break
    }

    case 'updatePettyEntry': {
      if (!has(user, 'canEditPetty')) throw new Error('غير مصرح — البيتي كاش للمشرف اللوجستي فقط')
      const entry = db.pettyCash.find((p) => p.id === payload.id)
      if (!entry) throw new Error('البند غير موجود')
      if (db.pettyClosed?.[entry.month]) throw new Error(`شهر ${entry.month} محفوظ (مغلق) — لا يمكن التعديل عليه`)
      const f = payload.fields || {}
      if (f.month && db.pettyClosed?.[f.month]) throw new Error(`شهر ${f.month} محفوظ (مغلق) — لا يمكن النقل إليه`)
      for (const k of ['month', 'date', 'department', 'description', 'invoiceNo', 'remarks']) {
        if (f[k] !== undefined) entry[k] = f[k]
      }
      if (f.qty != null) entry.qty = Number(f.qty)
      if (f.unitPrice != null) entry.unitPrice = Number(f.unitPrice)
      entry.totalPrice = (entry.qty || 0) * (entry.unitPrice || 0)
      entry.vat = entry.totalPrice * 0.15
      entry.total = entry.totalPrice + entry.vat
      notify(`عدّل ${user.name} بنداً في البيتي كاش: ${entry.description}`)
      break
    }

    case 'deletePettyEntry': {
      if (!has(user, 'canEditPetty')) throw new Error('غير مصرح — البيتي كاش للمشرف اللوجستي فقط')
      const entry = db.pettyCash.find((p) => p.id === payload.id)
      if (!entry) break
      if (db.pettyClosed?.[entry.month]) throw new Error(`شهر ${entry.month} محفوظ (مغلق) — لا يمكن الحذف منه`)
      db.pettyCash = db.pettyCash.filter((p) => p.id !== payload.id)
      notify(`حذف ${user.name} بنداً من البيتي كاش: ${entry.description}`)
      break
    }

    case 'closePettyMonth': {
      if (!has(user, 'canEditPetty')) throw new Error('غير مصرح — البيتي كاش للمشرف اللوجستي فقط')
      const month = payload.month
      if (!month) throw new Error('حدد الشهر')
      const rows = db.pettyCash.filter((p) => p.month === month)
      db.pettyClosed ??= {}
      db.pettyClosed[month] = {
        at: now,
        by: user.name,
        count: rows.length,
        total: Math.round(rows.reduce((s, p) => s + (p.total || 0), 0) * 100) / 100,
        vat: Math.round(rows.reduce((s, p) => s + (p.vat || 0), 0) * 100) / 100,
      }
      notify(`حفظ وإغلاق ${user.name} شهر البيتي كاش ${month} — ${rows.length} قيد بإجمالي ${db.pettyClosed[month].total} ر.س`)
      result = db.pettyClosed[month]
      break
    }

    case 'reopenPettyMonth': {
      if (!has(user, 'canEditPetty')) throw new Error('غير مصرح — البيتي كاش للمشرف اللوجستي فقط')
      const month = payload.month
      if (db.pettyClosed?.[month]) {
        delete db.pettyClosed[month]
        notify(`أعاد ${user.name} فتح شهر البيتي كاش ${month} للتعديل`)
      }
      break
    }

    case 'createIssuance': {
      if (!has(user, 'canEditVouchers')) throw new Error('غير مصرح — الصرف للمشرف اللوجستيك فقط')
      const kind = payload.kind === 'janitorial' || payload.kind === 'consumables' ? payload.kind : 'warehouse'
      let item, available
      if (kind === 'warehouse') {
        item = db.items.find((i) => i.id === payload.itemId)
        if (!item) throw new Error('الصنف غير موجود')
        available = db.movements.filter((m) => m.itemId === item.id).reduce((s, m) => s + (m.type === 'in' ? m.qty : -m.qty), 0)
      } else {
        const list = kind === 'janitorial' ? db.janitorial : db.consumables
        item = list.find((i) => i.id === payload.itemId)
        if (!item) throw new Error('البند غير موجود')
        available = item.qty - item.used
      }
      if (payload.qty > available) throw new Error(`الكمية المتاحة من «${item.description}» هي ${available} فقط`)
      const receiver = db.users.find((u) => u.id === payload.receiverId && u.active)
      if (!receiver) throw new Error('مستلم المواد غير موجود')
      const pending = db.issuances.filter((x) => x.itemId === item.id && x.kind === kind && x.status === 'pending').reduce((s, x) => s + x.qty, 0)
      if (payload.qty > available - pending) throw new Error('هناك طلب صرف معلق على نفس الصنف يتجاوز الرصيد المتاح')
      result = {
        id: uid(),
        kind,
        itemId: item.id,
        itemDescription: item.description,
        partNo: item.partNo,
        uom: item.uom,
        qty: payload.qty,
        department: payload.department || '',
        note: payload.note || '',
        receiverId: receiver.id,
        receiverName: receiver.name,
        status: 'pending',
        createdBy: user.name,
        createdAt: now,
      }
      db.issuances.unshift(result)
      notify(`طلب صرف جديد: ${result.qty} ${result.uom} من «${result.itemDescription}» إلى ${result.department} — بانتظار موافقة المستلم ${receiver.name}`)
      break
    }

    case 'approveIssuance': {
      const iss = db.issuances.find((x) => x.id === payload.id)
      if (!iss) throw new Error('الطلب غير موجود')
      if (iss.status !== 'pending') throw new Error('تم اعتماد هذا الطلب مسبقاً')
      if (iss.receiverId !== user.id && !has(user, 'canManageUsers')) {
        throw new Error(`غير مصرح — الاستلام مخصص لـ ${iss.receiverName}`)
      }
      // الخصم التلقائي من المخزون عند الاعتماد
      const voucherNo = `OUT-${String(db.counters.voucherOut + 1).padStart(4, '0')}`
      db.counters.voucherOut++
      if (iss.kind === 'janitorial' || iss.kind === 'consumables') {
        /* صرف من مواد النظافة / المستهلكات — الخصم من الكمية الفعلية */
        const list = iss.kind === 'janitorial' ? db.janitorial : db.consumables
        const item = list.find((i) => i.id === iss.itemId)
        if (!item) throw new Error('البند غير موجود')
        if (iss.qty > item.qty - item.used) throw new Error(`الكمية الفعلية المتاحة من «${item.description}» هي ${item.qty - item.used} فقط`)
        item.used += iss.qty
        db.stockUsages.unshift({ id: uid(), itemId: iss.itemId, kind: iss.kind, qty: iss.qty, note: iss.department || iss.note, date: now, by: user.name })
      } else {
        /* صرف من المستودع — سند صادر يخصم الرصيد */
        db.movements.unshift({
          id: uid(),
          itemId: iss.itemId,
          qty: iss.qty,
          type: 'out',
          date: now.slice(0, 10),
          refNo: iss.department || undefined,
          note: iss.note || undefined,
          voucherNo,
          mrfId: undefined,
          attachments: [],
          receivedBy: user.name,
          createdBy: user.name,
          createdAt: now,
        })
      }
      iss.status = 'approved'
      iss.approvedBy = user.name
      iss.approvedAt = now
      iss.voucherNo = voucherNo
      notify(`اعتمد ${user.name} استلام ${iss.qty} ${iss.uom} من «${iss.itemDescription}» — تم الخصم تلقائياً من المخزون بسند ${voucherNo}`)
      break
    }

    case 'upsertUser': {
      if (!has(user, 'canManageUsers')) throw new Error('غير مصرح — إدارة المستخدمين للمدير فقط')
      const u = payload
      if (db.users.some((x) => x.email === u.email && x.id !== u.id)) throw new Error('البريد الإلكتروني مسجل مسبقاً')
      if (u.id) {
        const target = db.users.find((x) => x.id === u.id)
        if (!target) throw new Error('المستخدم غير موجود')
        if (target.role === 'admin' && (u.role !== 'admin' || u.active === false)) {
          const admins = db.users.filter((x) => x.role === 'admin' && x.active && x.id !== u.id)
          if (!admins.length) throw new Error('لا يمكن إلغاء آخر مدير للنظام')
        }
        target.name = u.name
        target.email = u.email
        target.role = u.role
        if (u.pin) target.pin = u.pin /* الرقم السري فارغ = الإبقاء على الحالي */
        target.active = u.active !== false
        target.permOverrides = u.permOverrides || undefined
        notify(`حدّث المدير بيانات المستخدم ${u.name}`)
      } else {
        db.users.push({ id: uid(), name: u.name, email: u.email, role: u.role, pin: u.pin || '0000', active: u.active !== false, permOverrides: u.permOverrides || undefined, createdAt: now })
        notify(`أضاف المدير مستخدماً جديداً: ${u.name} (${u.role})`)
      }
      break
    }

    case 'deleteUser': {
      if (!has(user, 'canManageUsers')) throw new Error('غير مصرح')
      const target = db.users.find((x) => x.id === payload.id)
      if (!target) break
      if (target.id === user.id) throw new Error('لا يمكنك حذف حسابك الحالي')
      if (target.role === 'admin' && db.users.filter((x) => x.role === 'admin' && x.active).length <= 1) throw new Error('لا يمكن حذف آخر مدير للنظام')
      db.users = db.users.filter((x) => x.id !== payload.id)
      notify(`حذف المدير المستخدم ${target.name}`)
      break
    }

    case 'markNotificationRead':
      db.notifications.forEach((n) => {
        if (!n.readBy.includes(user.id)) n.readBy.push(user.id)
      })
      break

    default:
      throw new Error(`إجراء غير معروف: ${type}`)
  }

  saveData(db)
  return result
}

// ===== HTTP =====
const app = express()
app.use(express.json({ limit: '25mb' }))

app.get('/api/health', (_req, res) => res.json({ ok: true, users: db.users.length }))

// قائمة المستخدمين لشاشة الدخول (بدون أرقام PIN)
app.get('/api/users', (_req, res) => {
  res.json(db.users.filter((u) => u.active).map(({ pin, ...u }) => u))
})

app.post('/api/login', (req, res) => {
  const { userId, pin } = req.body || {}
  const user = db.users.find((u) => u.id === userId && u.active)
  if (!user || user.pin !== pin) return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' })
  const token = uid() + uid()
  sessions.set(token, user.id)
  const { pin: _p, ...safe } = user
  res.json({ token, user: safe })
})

function auth(req) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  const userId = sessions.get(token)
  return db.users.find((u) => u.id === userId && u.active)
}

// تصدير Excel بنفس نمط الملفات الأصلية (الألوان والخطوط والأوراق الشهرية)
const FONT = 'Sakkal Majalla'
const ACCENT1_LIGHT = 'FFB4C6E7' // أزرق فاتح (theme4 tint 0.6)
const ACCENT2 = 'FFED7D31'       // برتقالي (theme5 tint 0)
const ACCENT2_LIGHT = 'FFF8CBAD' // برتقالي فاتح (theme5 tint 0.6)
const BLACK = 'FF000000'

const SHEET_ORDER = ['SEPT', 'OCT', 'NOVE', 'DEC', 'JAN-2026', 'FEB-2026', 'MARCH-2026', 'APRIL-2026', 'MAY-2026', 'JUN-2026', 'JULY-2026', 'Aug-2026', 'SEP-2026']
const MONTH_START = {
  SEPT: '2025-09-01', OCT: '2025-10-01', NOVE: '2025-11-01', DEC: '2025-12-01',
  'JAN-2026': '2026-01-01', 'FEB-2026': '2026-02-01', 'MARCH-2026': '2026-03-01',
  'APRIL-2026': '2026-04-01', 'MAY-2026': '2026-05-01', 'JUN-2026': '2026-06-01',
  'JULY-2026': '2026-07-01', 'Aug-2026': '2026-08-01', 'SEP-2026': '2026-09-01',
}

function baseStyle(cell, { bold = false, size = 11, fill = null } = {}) {
  cell.font = { name: FONT, bold, size, color: { argb: BLACK } }
  cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
  cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }
  if (fill) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } }
}

app.get('/api/export/:kind', async (req, res) => {
  const user = auth(req)
  if (!user) return res.status(401).json({ error: 'تسجيل الدخول مطلوب' })
  const kind = req.params.kind
  // المشرفون لا يملكون إلا طلبات المواد والموافقات — منع تصدير شيتات الإكسل عنهم
  if (user.role === 'siteSupervisor') return res.status(403).json({ error: 'غير مصرح — التصدير للمشرف اللوجستي' })
  const wb = new ExcelJS.Workbook()
  // لوجو مطارات الدمام على الترويسة (كالأوراق الأصلية)
  let logoId = null
  try {
    logoId = wb.addImage({ filename: join(__dirname, '..', 'public', 'logos', 'dammam-airports.png'), extension: 'png' })
  } catch { /* اللوجو اختياري */ }
  const addLogo = (ws) => {
    if (logoId == null) return
    ws.addImage(logoId, { tl: { col: 0, row: 0, colOff: 40000, rowOff: 30000 }, ext: { width: 170, height: 33 } })
  }

  if (kind === 'petty-cash') {
    // ورقة لكل شهر كما في الملف الأصلي
    const present = Array.from(new Set(db.pettyCash.map((p) => p.month)))
    const ordered = [...SHEET_ORDER.filter((m) => present.includes(m)), ...present.filter((m) => !SHEET_ORDER.includes(m)).sort()]
    for (const m of ordered) {
      const ws = wb.addWorksheet(m, { views: [{ rightToLeft: false }] })
      addLogo(ws)
      const rows = db.pettyCash.filter((p) => p.month === m)
      ws.mergeCells('A1:K1')
      const t = ws.getCell('A1')
      /* عنوان الشهر كنص ثابت بأحرف لاتينية — numFmt 'mmmm yyyy' يظهر بالعربية على الجوال */
      const MONTH_EN = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER']
      const mStart = MONTH_START[m] ? new Date(MONTH_START[m]) : parsePettyDate(rows[0]?.date)
      t.value = mStart ? `${MONTH_EN[mStart.getMonth()]} ${mStart.getFullYear()}` : m
      baseStyle(t, { bold: true, size: 16 })
      ws.getRow(1).height = 30
      const hdr = ws.addRow(['S/N', 'DATE', 'DEPARTMENT', 'ITEM DESCRIPTION', 'INVOICE NO', 'QTY', 'UNIT PRICE', 'TOTAL PRICE', 'VAT 15%', 'TOTAL', 'REMARKS'])
      hdr.eachCell((c) => baseStyle(c, { bold: true, size: 14, fill: ACCENT2_LIGHT }))
      ws.getRow(2).height = 28
      let n = 1
      for (const p of rows) {
        const dt = parsePettyDate(p.date)
        const r = ws.addRow([n++, dt ?? p.date, p.department, p.description, p.invoiceNo, p.qty, p.unitPrice, null, null, null, p.remarks ?? ''])
        if (dt) r.getCell(2).numFmt = 'DD/MM/YYYY'
        const rn = r.number
        r.getCell(8).value = { formula: `F${rn}*G${rn}` }
        r.getCell(9).value = { formula: `H${rn}*0.15` }
        r.getCell(10).value = { formula: `H${rn}+I${rn}` }
        r.eachCell((c) => baseStyle(c, { size: 11 }))
        r.getCell(1).font = { name: FONT, bold: true, size: 11, color: { argb: BLACK } }
        // التفاف النص داخل حدود الخلية — لا يسمح بتجاوز الهوامش
        r.height = String(p.description ?? '').length > 40 ? 30 : 20
      }
      // صف الإجمالي أسفل كل شهر (كالأوراق الأصلية)
      const last = ws.rowCount
      const tr = ws.addRow(['', '', '', 'TOTAL', '', '', '', { formula: `SUM(H3:H${last})` }, { formula: `SUM(I3:I${last})` }, { formula: `SUM(J3:J${last})` }, ''])
      tr.eachCell((c) => {
        baseStyle(c, { bold: true, size: 12, fill: ACCENT2_LIGHT })
        c.numFmt = '#,##0.00'
      })
      ws.getRow(tr.number).height = 22
      ;[7.7, 16.7, 23.7, 40.7, 19.7, 9.7, 15.7, 14, 12, 14, 69].forEach((w, i) => { ws.getColumn(i + 1).width = w })
    }
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', 'attachment; filename="PETTY CASH REPORT.xlsx"')
    await wb.xlsx.write(res)
    res.end()
    return
  }

  // المستهلكات / مواد النظافة
  const isJan = kind === 'janitorial'
  const list = isJan ? db.janitorial : db.consumables
  const ws = wb.addWorksheet('REPORT')
  addLogo(ws)
  ws.views = [{ state: 'frozen', xSplit: 3, ySplit: 2, rightToLeft: false }]
  ws.mergeCells('A1:K1')
  const t = ws.getCell('A1')
  t.value = isJan ? 'SOFT SERVICES - JANITORIAL MATERIAL REPORT' : 'CONSUMABLE AND NON-REIMBURSABLE REPORT'
  baseStyle(t, { bold: true, size: 14, fill: ACCENT1_LIGHT })
  ws.getRow(1).height = 32
  const hdr = ws.addRow(['No.', 'Airport', 'SECTION', 'ITEM DESCRIPTION', 'Manufacturer', 'Part#', 'UOM', 'QTY', 'USED QTY', 'ACTUAL QTY', 'REMARKS'])
  hdr.eachCell((c) => baseStyle(c, { bold: true, size: 14, fill: ACCENT2 }))
  ws.getRow(2).height = 28
  let i = 1
  for (const s of list) {
    const r = ws.addRow([i++, s.airport, s.section, s.description, s.manufacturer, s.partNo, s.uom, s.qty, s.used, null, s.remarks ?? ''])
    const rn = r.number
    r.getCell(10).value = { formula: `H${rn}-I${rn}` }
    r.eachCell((c) => baseStyle(c, { size: isJan ? 12 : 10 }))
    r.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } }
    r.getCell(10).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ACCENT2_LIGHT } }
    // التفاف النص داخل حدود الخلية — لا يسمح بتجاوز الهوامش
    r.height = String(s.description ?? '').length > 50 ? 34 : 22
  }
  ;(isJan ? [7.2, 12.2, 28, 50.5, 15.5, 14.5, 11.5, 9.7, 7.2, 11.5, 84.5] : [7.1, 12.1, 28, 78.6, 17.3, 14.7, 14.6, 9.7, 7.1, 11.4, 54.9])
    .forEach((w, idx) => { ws.getColumn(idx + 1).width = w })
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename="${isJan ? 'SOFT SERVICES - JANITORIAL' : 'CONSUMABLE AND NON-RIEMBURSABLE'}.xlsx"`)
  await wb.xlsx.write(res)
  res.end()
})

// ===== WebSocket =====
const server = createServer(app)
const wss = new WebSocketServer({ server, path: '/ws' })

function broadcast() {
  const msg = JSON.stringify({ type: 'state', db, at: Date.now() })
  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(msg)
  }
}

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://localhost')
  const token = url.searchParams.get('token')
  const userId = sessions.get(token)
  const user = db.users.find((u) => u.id === userId && u.active)
  if (!user) {
    ws.send(JSON.stringify({ type: 'error', error: 'جلسة غير صالحة — سجّل الدخول مجدداً' }))
    ws.close()
    return
  }
  ws.send(JSON.stringify({ type: 'state', db, you: user }))
  ws.on('message', (raw) => {
    let msg
    try { msg = JSON.parse(raw) } catch { return }
    if (msg.type === 'ping') { ws.send(JSON.stringify({ type: 'pong' })); return }
    try {
      const result = applyAction(msg, user)
      ws.send(JSON.stringify({ type: 'ack', actionId: msg.actionId, result }))
      broadcast()
    } catch (e) {
      ws.send(JSON.stringify({ type: 'error', error: e.message, actionId: msg.actionId }))
    }
  })
})

// ===== تقديم واجهة المستخدم المبنية (production) =====
const DIST_DIR = join(__dirname, '..', 'dist')
if (existsSync(DIST_DIR)) {
  /* الملفات المبنية بأسماء مشفرة (assets) تُخزن سنة كاملة؛
     index.html لا يُخزن أبداً حتى يحصل الجوال على آخر نسخة فور كل تحديث */
  app.use(express.static(DIST_DIR, {
    setHeaders(res, filePath) {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
      } else {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
      }
    },
  }))
  app.get(/^\/(?!api\/|ws).*/, (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
    res.sendFile(join(DIST_DIR, 'index.html'))
  })
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`WMS server on http://0.0.0.0:${PORT} (WS at /ws, API at /api, cloud: ${CLOUD_MODE ? 'on' : 'off'})`)
})
