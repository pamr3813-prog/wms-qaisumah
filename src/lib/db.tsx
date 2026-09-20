import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { toast } from 'sonner'
import type {
  Approval,
  Item,
  Movement,
  Mrf,
  MrfItem,
  PettyEntry,
  Priority,
  RoleKey,
  StockItem,
  StockUsage,
} from '@/types'
import { QUOTATION_THRESHOLD } from '@/types'

// ===== الثوابت =====

export const ROLES: Record<RoleKey, string> = {
  storekeeper: 'أمين المستودع',
  purchasing: 'مسؤول المشتريات',
  siteSupervisor: 'مشرف الموقع',
  logisticsSupervisor: 'المشرف اللوجستي',
  omSuperintendent: 'مدير العمليات والصيانة',
  siteManager: 'مدير الموقع',
  projectManagement: 'إدارة المشروع',
  admin: 'مدير النظام',
}

export const ROLES_EN: Record<RoleKey, string> = {
  storekeeper: 'Storekeeper',
  purchasing: 'Purchasing Officer',
  siteSupervisor: 'Site Supervisor',
  logisticsSupervisor: 'Logistics Supervisor',
  omSuperintendent: 'O&M SUP"V',
  siteManager: 'Site Manager',
  projectManagement: 'Project Management',
  admin: 'System Admin',
}

/** المسمى الوظيفي حسب لغة الواجهة — في الإنجليزية يظهر بالإنجليزية وبالأحرف الكبيرة (SITE MANAGER) */
export function roleLabel(role: RoleKey, lang: 'ar' | 'en'): string {
  return lang === 'ar' ? (ROLES[role] ?? role) : (ROLES_EN[role] ?? role).toUpperCase()
}

export const PRIORITIES: Record<Priority, string> = {
  normal: 'عادي',
  urgent: 'عاجل',
  top: 'عاجل جداً',
}

/** مفاتيح ترجمة أسماء الصلاحيات */
export const PERM_LABELS = {
  canEditVouchers: 'ad.permVouchers',
  canEditItems: 'ad.permItems',
  canEditPetty: 'ad.permPetty',
  canIssueStock: 'ad.permStock',
  canManageUsers: 'ad.permUsers',
  canCreateMrf: 'ad.permMrf',
} as const

export type PermKey = keyof typeof PERM_LABELS

/** مصفوفة الصلاحيات — تُفرض على الخادم أيضاً */
export const PERMS: Record<string, RoleKey[]> = {
  canEditVouchers: ['logisticsSupervisor', 'admin'],
  canEditItems: ['storekeeper', 'logisticsSupervisor', 'admin'],
  canEditPetty: ['logisticsSupervisor', 'admin'], // شيتات الإكسل: اللوجستيك فقط
  canIssueStock: ['logisticsSupervisor', 'admin'],
  canManageUsers: ['admin'],
  canCreateMrf: ['storekeeper', 'purchasing', 'siteSupervisor', 'logisticsSupervisor', 'omSuperintendent', 'siteManager', 'admin'],
}

export const BASE_APPROVAL_CHAIN: RoleKey[] = [
  'siteSupervisor',
  'logisticsSupervisor',
  'omSuperintendent',
  'siteManager',
]

export function requiresQuotation(items: Pick<MrfItem, 'estimatedPrice'>[]): boolean {
  return items.some((i) => (i.estimatedPrice ?? 0) > QUOTATION_THRESHOLD)
}

export function buildApprovalChain(items: MrfItem[]): Approval[] {
  const chain = [...BASE_APPROVAL_CHAIN]
  if (requiresQuotation(items)) chain.push('projectManagement')
  return chain.map((role) => ({ role, status: 'pending' as const }))
}

export function nextApproval(mrf: Mrf): Approval | undefined {
  if (mrf.status !== 'pending') return undefined
  return mrf.approvals.find((a) => a.status === 'pending')
}

export function mrfTotal(mrf: Mrf): number {
  return mrf.items.reduce((s, i) => s + (i.estimatedPrice ?? 0) * i.qty, 0)
}

export function actualOf(item: StockItem): number {
  return item.qty - item.used
}

// ===== أنواع السحابة =====

export interface User {
  id: string
  name: string
  email: string
  role: RoleKey
  active: boolean
  /** تجاوزات صلاحيات مخصصة لكل مستخدم — تتجاوز صلاحيات الدور */
  permOverrides?: Record<string, boolean>
  createdAt: string
}

export interface Comment {
  id: string
  mrfId: string
  author: string
  role: RoleKey
  text: string
  at: string
}

export interface Notification {
  id: string
  text: string
  at: string
  readBy: string[]
}

export interface Issuance {
  id: string
  kind?: 'warehouse' | 'janitorial' | 'consumables'
  itemId: string
  itemDescription: string
  partNo: string
  uom: string
  qty: number
  department: string
  note: string
  receiverId: string
  receiverName: string
  status: 'pending' | 'approved'
  createdBy: string
  createdAt: string
  approvedBy?: string
  approvedAt?: string
  voucherNo?: string
}

export interface Db {
  items: Item[]
  movements: Movement[]
  mrfs: Mrf[]
  pettyCash: PettyEntry[]
  janitorial: StockItem[]
  consumables: StockItem[]
  stockUsages: StockUsage[]
  counters: { voucherIn: number; voucherOut: number; mrf: number }
  users: User[]
  comments: Comment[]
  notifications: Notification[]
  issuances: Issuance[]
}

const EMPTY_DB: Db = {
  items: [],
  movements: [],
  mrfs: [],
  pettyCash: [],
  janitorial: [],
  consumables: [],
  stockUsages: [],
  counters: { voucherIn: 0, voucherOut: 0, mrf: 0 },
  users: [],
  comments: [],
  notifications: [],
  issuances: [],
}

// ===== جلسة HTTP =====

export async function fetchUsers(): Promise<Omit<User, 'pin'>[]> {
  const r = await fetch('/api/users')
  if (!r.ok) throw new Error('users fetch failed')
  return r.json()
}

export async function loginRequest(userId: string, pin: string) {
  const r = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, pin }),
  })
  if (!r.ok) throw new Error('login failed')
  return r.json() as Promise<{ token: string; user: User }>
}

export async function exportFile(kind: 'petty-cash' | 'janitorial' | 'consumables'): Promise<void> {
  const token = sessionStorage.getItem('wms-token') || ''
  const r = await fetch(`/api/export/${kind}`, { headers: { Authorization: `Bearer ${token}` } })
  if (!r.ok) throw new Error('export failed')
  const blob = await r.blob()
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${kind}-report.xlsx`
  a.click()
  URL.revokeObjectURL(a.href)
}

// ===== سياق المتجر السحابي =====

interface StoreValue {
  db: Db
  ready: boolean
  online: boolean
  currentUser: User | null
  login: (userId: string, pin: string) => Promise<void>
  logout: () => void
  can: (perm: PermKey) => boolean
  send: (type: string, payload: unknown) => Promise<unknown>
  stock: (itemId: string) => number
  myUnread: number
}

const StoreCtx = createContext<StoreValue | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<Db>(EMPTY_DB)
  const [ready, setReady] = useState(false)
  const [online, setOnline] = useState(false)
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const raw = sessionStorage.getItem('wms-user')
      return raw ? (JSON.parse(raw) as User) : null
    } catch {
      return null
    }
  })
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectRef = useRef<number | null>(null)
  const ackRef = useRef<Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>>(new Map())
  const pendingRef = useRef<{ type: string; payload: unknown; resolve: (v: unknown) => void; reject: (e: Error) => void }[]>([])

  const flushPending = useCallback(() => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== 1) return
    const queue = pendingRef.current.splice(0)
    for (const item of queue) {
      const actionId = Math.random().toString(36).slice(2)
      ackRef.current.set(actionId, { resolve: item.resolve, reject: item.reject })
      ws.send(JSON.stringify({ type: item.type, payload: item.payload, actionId }))
    }
  }, [])

  const connect = useCallback((token: string) => {
    if (reconnectRef.current) {
      window.clearTimeout(reconnectRef.current)
      reconnectRef.current = null
    }
    const proto = location.protocol === 'https:' ? 'wss' : 'ws'
    const ws = new WebSocket(`${proto}://${location.host}/ws?token=${encodeURIComponent(token)}`)
    wsRef.current = ws

    ws.onopen = () => {
      setOnline(true)
      flushPending()
    }
    ws.onclose = () => {
      setOnline(false)
      wsRef.current = null
      // إعادة اتصال تلقائية عند انقطاع الخادم أو الشبكة
      if (sessionStorage.getItem('wms-token')) {
        reconnectRef.current = window.setTimeout(() => connect(token), 1000)
      }
    }
    ws.onmessage = (ev) => {
      let msg
      try {
        msg = JSON.parse(ev.data)
      } catch {
        return
      }
      if (msg.type === 'state') {
        setDb(msg.db)
        setReady(true)
      } else if (msg.type === 'ack') {
        const p = msg.actionId && ackRef.current.get(msg.actionId)
        if (p) {
          ackRef.current.delete(msg.actionId)
          p.resolve(msg.result)
        }
      } else if (msg.type === 'error') {
        const p = msg.actionId && ackRef.current.get(msg.actionId)
        if (p) {
          ackRef.current.delete(msg.actionId)
          p.reject(new Error(msg.error))
        }
        toast.error(msg.error)
      }
    }
  }, [])

  useEffect(() => {
    const token = sessionStorage.getItem('wms-token')
    if (token && currentUser) connect(token)
    else setReady(true)
    return () => wsRef.current?.close()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const login = useCallback(
    async (userId: string, pin: string) => {
      const { token, user } = await loginRequest(userId, pin)
      sessionStorage.setItem('wms-token', token)
      sessionStorage.setItem('wms-user', JSON.stringify(user))
      setCurrentUser(user)
      connect(token)
    },
    [connect],
  )

  const logout = useCallback(() => {
    sessionStorage.removeItem('wms-token')
    sessionStorage.removeItem('wms-user')
    if (reconnectRef.current) {
      window.clearTimeout(reconnectRef.current)
      reconnectRef.current = null
    }
    const queue = pendingRef.current.splice(0)
    queue.forEach((item) => item.reject(new Error('تم تسجيل الخروج')))
    wsRef.current?.close()
    setCurrentUser(null)
    setDb(EMPTY_DB)
  }, [])

  const send = useCallback((type: string, payload: unknown) => {
    return new Promise((resolve, reject) => {
      const ws = wsRef.current
      if (ws && ws.readyState === 1) {
        const actionId = Math.random().toString(36).slice(2)
        ackRef.current.set(actionId, { resolve, reject })
        ws.send(JSON.stringify({ type, payload, actionId }))
        return
      }
      // الاتصال مقطوع مؤقتاً — ضع الإجراء في الانتظار حتى يكتمل إعادة الاتصال
      const item = { type, payload, resolve, reject }
      pendingRef.current.push(item)
      window.setTimeout(() => {
        const idx = pendingRef.current.indexOf(item)
        if (idx >= 0) {
          pendingRef.current.splice(idx, 1)
          reject(new Error('غير متصل بالخادم'))
          toast.error('غير متصل بالخادم')
        }
      }, 8000)
    })
  }, [])

  const stock = useCallback(
    (itemId: string) =>
      db.movements
        .filter((m) => m.itemId === itemId)
        .reduce((s, m) => s + (m.type === 'in' ? m.qty : -m.qty), 0),
    [db.movements],
  )

  const can = useCallback((perm: PermKey) => {
    if (!currentUser) return false
    const base = (PERMS[perm] ?? []).includes(currentUser.role)
    const o = currentUser.permOverrides?.[perm]
    return o === undefined ? base : !!o
  }, [currentUser])

  const myUnread = useMemo(
    () => (currentUser ? db.notifications.filter((n) => !n.readBy.includes(currentUser.id)).length : 0),
    [db.notifications, currentUser],
  )

  const value = useMemo<StoreValue>(
    () => ({ db, ready, online, currentUser, login, logout, can, send, stock, myUnread }),
    [db, ready, online, currentUser, login, logout, can, send, stock, myUnread],
  )

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreCtx)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}

export type { Approval }
