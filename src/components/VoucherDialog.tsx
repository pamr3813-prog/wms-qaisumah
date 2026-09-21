import { useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AttachmentUploader } from '@/components/AttachmentUploader'
import { SearchableSelect, type SearchOption } from '@/components/SearchableSelect'
import { actualOf, useStore } from '@/lib/db'
import { useLang } from '@/lib/i18n'
import { fmtMoney } from '@/lib/format'
import { sectionLabel } from '@/lib/sections'
import type { Attachment, MovementType } from '@/types'

interface Row {
  key: string
  ref: string // w: | j: | c: prefix + id
  qty: string
}

const uid = () => Math.random().toString(36).slice(2, 10)

/** أقسام البيتي كاش المعتادة — تُدمج مع الأقسام المسجلة في البيانات */
const PETTY_DEPTS = ['AC', 'CIVIL', 'ELECTRICAL', 'LANDSCAPE', 'MOTOR POOL', 'P&G', 'PAWERPLANT', 'PLUMBING', 'COMMNUCATION', 'OTHER']

export function VoucherDialog({ type }: { type: MovementType }) {
  const { db, send, stock } = useStore()
  const { t, lang } = useLang()
  const isIn = type === 'in'
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'stock' | 'petty'>('stock')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [refNo, setRefNo] = useState('')
  const [notes, setNotes] = useState('')
  const [rows, setRows] = useState<Row[]>([{ key: uid(), ref: '', qty: '1' }])
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [mrfId, setMrfId] = useState('')

  /* حقول قسم البيتي كاش */
  const [pcMonth, setPcMonth] = useState('SEP-2026')
  const [pcDept, setPcDept] = useState('')
  const [pcInvoice, setPcInvoice] = useState('')
  const [pcDesc, setPcDesc] = useState('')
  const [pcQty, setPcQty] = useState('1')
  const [pcPrice, setPcPrice] = useState('')
  const [pcRemarks, setPcRemarks] = useState('')

  const approvedMrfs = db.mrfs.filter((m) => m.status === 'approved')

  /* كل الاستوك: مستودع + نظافة + مستهلكات — مع القسم لمعرفة تبعية كل مادة */
  const stockOptions = useMemo<SearchOption[]>(() => [
    ...db.items.map((i) => ({
      value: `w:${i.id}`,
      label: `${i.partNo} — ${i.description}${isIn ? '' : ` (${t('common.available')} ${stock(i.id)})`}`,
      group: t('inv.catWarehouse'),
    })),
    ...db.janitorial.map((i) => ({
      value: `j:${i.id}`,
      label: `${i.partNo ? i.partNo + ' — ' : ''}${i.description}${isIn ? '' : ` (${t('common.available')} ${actualOf(i)})`}`,
      group: t('inv.catJanitorial'),
    })),
    ...db.consumables.map((i) => ({
      value: `c:${i.id}`,
      label: `${sectionLabel(i.section, lang)} — ${i.description}${isIn ? '' : ` (${t('common.available')} ${actualOf(i)})`}`,
      group: t('inv.catConsumables'),
    })),
  ], [db.items, db.janitorial, db.consumables, stock, isIn, t, lang])

  const mrfOptions = useMemo<SearchOption[]>(() =>
    approvedMrfs.map((m) => ({ value: m.id, label: `${m.mrfNo} — ${m.department}` })),
  [approvedMrfs])

  const pettyMonths = useMemo(() => {
    const set = new Set(db.pettyCash.map((p) => p.month))
    return ['SEPT', 'OCT', 'NOVE', 'DEC', 'JAN-2026', 'FEB-2026', 'MARCH-2026', 'APRIL-2026', 'MAY-2026', 'JUN-2026', 'JULY-2026', 'Aug-2026', 'SEP-2026'].filter((m) => set.has(m))
  }, [db.pettyCash])

  const pettyDeptOptions = useMemo<SearchOption[]>(() => {
    const set = new Set([...PETTY_DEPTS, ...db.pettyCash.map((p) => p.department).filter(Boolean)])
    return [...set].map((d) => ({ value: d, label: d }))
  }, [db.pettyCash])

  function pickMrf(id: string) {
    setMrfId(id)
    const mrf = db.mrfs.find((m) => m.id === id)
    if (mrf) {
      setRows(mrf.items.map((i) => {
        const item = db.items.find((x) => x.partNo === i.partNo)
        return { key: uid(), ref: item ? `w:${item.id}` : '', qty: String(i.qty) }
      }).filter((r) => r.ref))
    }
  }

  const price = (Number(pcQty) || 0) * (Number(pcPrice) || 0)
  const vat = price * 0.15
  const total = price + vat

  async function submitStock() {
    const valid = rows.filter((r) => r.ref && Number(r.qty) > 0)
    if (!valid.length) {
      toast.error(t('v.errNoRows'))
      return
    }
    if (isIn && attachments.length === 0) {
      toast.error(t('v.errNoReceipt'))
      return
    }
    for (const r of valid) {
      const m = r.ref.match(/^(w|j|c):(.+)$/)!
      if (m[1] === 'w' && !isIn && stock(m[2]) < Number(r.qty)) {
        const item = db.items.find((i) => i.id === m[2])!
        toast.error(`${t('v.errStock')}: ${item.description} (${t('common.available')} ${stock(m[2])})`)
        return
      }
    }
    try {
      for (const r of valid) {
        const m = r.ref.match(/^(w|j|c):(.+)$/)!
        if (m[1] === 'w') {
          await send('addMovement', {
            type,
            itemId: m[2],
            qty: Number(r.qty),
            date: new Date(date).toISOString(),
            refNo: refNo || undefined,
            mrfId: !isIn && mrfId ? mrfId : undefined,
            notes,
            attachments,
          })
        } else if (isIn) {
          await send('receiveModuleStock', {
            kind: m[1] === 'j' ? 'janitorial' : 'consumables',
            itemId: m[2],
            qty: Number(r.qty),
            date: new Date(date).toISOString(),
            refNo: refNo || undefined,
            note: notes || undefined,
          })
        }
      }
      toast.success(t('v.saved'))
      setOpen(false)
      setRows([{ key: uid(), ref: '', qty: '1' }])
      setRefNo(''); setNotes(''); setAttachments([]); setMrfId('')
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  async function submitPetty() {
    if (!pcDept || !pcDesc.trim() || !pcInvoice.trim() || !(Number(pcQty) > 0)) {
      toast.error(t('pc.errFields'))
      return
    }
    try {
      await send('addPettyEntry', {
        month: pcMonth,
        date: new Date(date).toISOString().slice(0, 10),
        department: pcDept,
        description: pcDesc.trim(),
        invoiceNo: pcInvoice.trim(),
        qty: Number(pcQty),
        unitPrice: Number(pcPrice) || 0,
        totalPrice: price,
        vat,
        total,
        remarks: pcRemarks.trim() || null,
      })
      toast.success(t('pc.saved'))
      setOpen(false)
      setPcDept(''); setPcDesc(''); setPcInvoice(''); setPcQty('1'); setPcPrice(''); setPcRemarks('')
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="me-2 size-4" />
          {isIn ? t('v.in.new') : t('v.out.new')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isIn ? t('v.in.new') : t('v.out.new')}</DialogTitle>
        </DialogHeader>

        {isIn && (
          <div className="flex gap-1.5 border-b pb-3">
            <Button size="sm" variant={tab === 'stock' ? 'default' : 'outline'} onClick={() => setTab('stock')}>
              {t('v.tabStock')}
            </Button>
            <Button size="sm" variant={tab === 'petty' ? 'default' : 'outline'} onClick={() => setTab('petty')}>
              {t('v.tabPetty')}
            </Button>
          </div>
        )}

        {isIn && tab === 'petty' ? (
          /* ===== قسم المشتريات المسجلة في البيتي كاش ===== */
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t('pc.month')}</Label>
                <select className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={pcMonth} onChange={(e) => setPcMonth(e.target.value)}>
                  {pettyMonths.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>{t('common.date')}</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{t('pc.department')}</Label>
                <SearchableSelect options={pettyDeptOptions} value={pcDept} onChange={setPcDept} placeholder={t('v.pickItem')} />
              </div>
              <div className="space-y-1.5">
                <Label>{t('pc.invoiceNo')}</Label>
                <Input value={pcInvoice} onChange={(e) => setPcInvoice(e.target.value)} />
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label>{lang === 'ar' ? 'وصف المشتريات' : 'Purchase description'}</Label>
                <Input value={pcDesc} onChange={(e) => setPcDesc(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{t('common.qty')}</Label>
                <Input type="number" min="1" value={pcQty} onChange={(e) => setPcQty(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{t('pc.unitPrice')}</Label>
                <Input type="number" min="0" step="0.01" value={pcPrice} onChange={(e) => setPcPrice(e.target.value)} />
              </div>
              <div className="sm:col-span-2 rounded-md bg-muted p-3 text-sm">
                <div className="flex justify-between"><span>{t('pc.price')}</span><span>{fmtMoney(price)}</span></div>
                <div className="flex justify-between text-muted-foreground"><span>{t('pc.vat')}</span><span>{fmtMoney(vat)}</span></div>
                <div className="flex justify-between border-t pt-1 font-bold"><span>{t('common.total')}</span><span>{fmtMoney(total)}</span></div>
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label>{t('common.notes')}</Label>
                <Input value={pcRemarks} onChange={(e) => setPcRemarks(e.target.value)} />
              </div>
            </div>
            <Button className="w-full" onClick={submitPetty}>{t('v.save')}</Button>
          </div>
        ) : (
          /* ===== قسم الاستلام إلى المخزون / سند الصادر ===== */
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t('v.dateLabel')}</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{isIn ? t('v.poRef') : t('v.refOut')}</Label>
                <Input value={refNo} onChange={(e) => setRefNo(e.target.value)} placeholder={isIn ? 'PO-####' : ''} />
              </div>
            </div>

            {!isIn && (
              <div className="space-y-1.5">
                <Label>{t('v.linkedMrf')}</Label>
                <SearchableSelect options={mrfOptions} value={mrfId} onChange={pickMrf} placeholder={t('v.noLink')} />
              </div>
            )}

            <div className="space-y-2">
              <Label>
                {t('v.rows')}
                {isIn && <Badge variant="secondary" className="ms-2">{t('v.tabStock')}</Badge>}
              </Label>
              {rows.map((r, idx) => (
                <div key={r.key} className="flex items-center gap-2">
                  <span className="w-6 text-center text-sm text-muted-foreground">{idx + 1}</span>
                  <SearchableSelect
                    className="min-w-0 flex-1"
                    options={stockOptions}
                    value={r.ref}
                    onChange={(v) => setRows(rows.map((x) => (x.key === r.key ? { ...x, ref: v } : x)))}
                    placeholder={t('v.pickItem')}
                  />
                  <Input
                    type="number"
                    min="1"
                    className="w-24"
                    value={r.qty}
                    onChange={(e) => setRows(rows.map((x) => (x.key === r.key ? { ...x, qty: e.target.value } : x)))}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setRows(rows.filter((x) => x.key !== r.key))}
                    disabled={rows.length === 1}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setRows([...rows, { key: uid(), ref: '', qty: '1' }])}>
                <Plus className="me-1 size-4" /> {t('v.addRow')}
              </Button>
            </div>

            <div className="space-y-1.5">
              <Label>{t('common.notes')}</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            <AttachmentUploader
              attachments={attachments}
              onChange={setAttachments}
              label={isIn ? t('v.attachIn') : t('v.attachOut')}
              hint={isIn ? t('v.attachHint') : undefined}
            />

            <Button className="w-full" onClick={submitStock}>{t('v.save')}</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
