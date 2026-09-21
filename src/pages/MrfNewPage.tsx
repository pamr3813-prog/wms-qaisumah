import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { Plus, Trash2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { QUOTATION_THRESHOLD } from '@/types'
import { requiresQuotation, useStore } from '@/lib/db'
import { te } from '@/lib/i18n'
import { fileToAttachment } from '@/components/AttachmentUploader'
import { ReadOnlyBanner } from '@/components/ReadOnly'
import type { Attachment, MrfItem, Priority } from '@/types'

const uid = () => Math.random().toString(36).slice(2, 10)

/** النموذج مطابق للورقة الأصلية: إنجليزي فقط واتجاه من اليسار لليمين */
const t = te

const newRow = (): Row => ({ key: uid(), partNo: '', description: '', qty: '1', uom: 'PCS', onHand: '', remarks: '', estimatedPrice: '' })

interface Row {
  key: string
  partNo: string
  description: string
  qty: string
  uom: string
  onHand: string
  remarks: string
  estimatedPrice: string
}

const PRIO: Priority[] = ['normal', 'urgent', 'top']

export default function MrfNewPage() {
  const { db, stock, send, can } = useStore()
  const navigate = useNavigate()
  const [sending, setSending] = useState(false)
  const canCreate = can('canCreateMrf')

  const [site, setSite] = useState('Qaisumah Airport')
  const [department, setDepartment] = useState('')
  const [facility, setFacility] = useState('')
  const [requiredDate, setRequiredDate] = useState('')
  const [requestedBy, setRequestedBy] = useState('')
  const [employeeNo, setEmployeeNo] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [priority, setPriority] = useState<Priority>('normal')
  const [remarks, setRemarks] = useState('')
  const [workOrder, setWorkOrder] = useState('')
  const [rows, setRows] = useState<Row[]>([newRow()])
  const [quotation, setQuotation] = useState<Attachment | null>(null)

  const needQuotation = useMemo(
    () =>
      requiresQuotation(
        rows.map((r) => ({ estimatedPrice: Number(r.estimatedPrice) || 0 })),
      ),
    [rows],
  )

  /** عند إدخال رقم قطعة مسجلة بالمستودع يتم التعبئة التلقائية */
  function onPartNo(row: Row, value: string) {
    const item = db.items.find((i) => i.partNo.toLowerCase() === value.toLowerCase())
    setRows((rs) =>
      rs.map((r) =>
        r.key === row.key
          ? {
              ...r,
              partNo: value,
              description: item ? item.description : r.description,
              uom: item ? item.uom : r.uom,
              onHand: item ? String(stock(item.id)) : r.onHand,
            }
          : r,
      ),
    )
  }

  async function onQuotationFile(file: File | null) {
    if (!file) return
    if (file.size > 3 * 1024 * 1024) {
      toast.error('File exceeds 3 MB')
      return
    }
    const att = await fileToAttachment(file)
    setQuotation({ ...att, uploadedBy: 'Purchasing officer' })
  }

  function submit() {
    if (!canCreate) {
      toast.error(t('perm.denied'))
      return
    }
    const valid = rows.filter((r) => r.partNo.trim() && r.description.trim() && Number(r.qty) > 0)
    if (!department.trim() || !facility.trim() || !requestedBy.trim() || !requiredDate) {
      toast.error(t('f.errFields'))
      return
    }
    if (!valid.length) {
      toast.error(t('f.errRows'))
      return
    }
    if (needQuotation && !quotation) {
      toast.error(t('f.errQuotation'))
      return
    }

    const items: MrfItem[] = valid.map((r) => ({
      id: uid(),
      partNo: r.partNo.trim(),
      description: r.description.trim(),
      qty: Number(r.qty),
      uom: r.uom,
      onHand: Number(r.onHand) || 0,
      remarks: r.remarks.trim() || undefined,
      estimatedPrice: Number(r.estimatedPrice) || undefined,
    }))

    setSending(true)
    send('createMrf', {
      site,
      department,
      facility,
      requiredDate,
      requestedBy,
      employeeNo,
      date,
      priority,
      items,
      remarks: remarks || undefined,
      workOrder: workOrder || undefined,
      quotation: quotation ?? undefined,
    })
      .then((res) => {
        const mrf = res as { id: string; mrfNo: string }
        toast.success(`${t('f.sent')} ${mrf.mrfNo} ${t('f.toChain')}`)
        navigate(`/purchases/${mrf.id}`)
      })
      .catch(() => {
        /* رسالة الخطأ تظهر تلقائياً */
      })
      .finally(() => setSending(false))
  }

  const inputCls = 'h-8 px-2 text-sm'
  const cellInput = 'h-8 w-full rounded border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary'
  const hdr = 'border px-2 py-1.5 font-semibold'

  return (
    <div dir="ltr" className="mx-auto max-w-5xl space-y-5">
      {!canCreate && <ReadOnlyBanner />}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('f.title')}</h1>
        <Button onClick={submit} disabled={!canCreate || sending}>{sending ? t('ex.exporting') : t('f.submit')}</Button>
      </div>

      {/* ترويسة النموذج */}
      <Card>
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t('f.site')}</Label>
              <Input value={site} onChange={(e) => setSite(e.target.value)} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('f.department')}</Label>
              <Input value={department} onChange={(e) => setDepartment(e.target.value)} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('f.facility')}</Label>
              <Input value={facility} onChange={(e) => setFacility(e.target.value)} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('f.requiredDate')}</Label>
              <Input type="date" value={requiredDate} onChange={(e) => setRequiredDate(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t('f.requestedBy')}</Label>
              <Input value={requestedBy} onChange={(e) => setRequestedBy(e.target.value)} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('f.employeeNo')}</Label>
              <Input value={employeeNo} onChange={(e) => setEmployeeNo(e.target.value)} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('common.date')}</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('f.mrfNo')}</Label>
              <Input disabled value={t('f.autoNo')} className={`${inputCls} text-muted-foreground`} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* الأولوية */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-6 pt-6">
          <span className="text-sm font-semibold">{t('f.priorityLabel')}</span>
          {PRIO.map((p) => (
            <label key={p} className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="radio"
                name="priority"
                checked={priority === p}
                onChange={() => setPriority(p)}
                className="accent-primary"
              />
              <span className={p === 'top' ? 'font-bold text-red-600' : ''}>{t(`p.priority${p === 'normal' ? 'Normal' : p === 'urgent' ? 'Urgent' : 'Top'}`)}</span>
              {p === 'top' && <span className="inline-block h-3 w-6 rounded-sm bg-red-600" />}
            </label>
          ))}
        </CardContent>
      </Card>

      {/* جدول البنود */}
      <Card>
        <CardContent className="space-y-3 pt-6">
          <div className="overflow-x-auto">
            <table className="w-full border text-sm">
              <thead>
                <tr className="bg-muted text-start">
                  <th className={`${hdr} w-10`}>{t('common.sn')}</th>
                  <th className={hdr}>{t('f.partNo')}</th>
                  <th className={hdr}>{t('f.description')}</th>
                  <th className={`${hdr} w-16`}>{t('f.qty')}</th>
                  <th className={`${hdr} w-20`}>{t('f.uom')}</th>
                  <th className={`${hdr} w-16`}>{t('f.onHand')}</th>
                  <th className={`${hdr} w-24`}>{t('f.estPrice')}</th>
                  <th className={hdr}>{t('f.remarksRow')}</th>
                  <th className="border w-10"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => (
                  <tr key={r.key}>
                    <td className="border px-2 py-1 text-center text-muted-foreground">{idx + 1}</td>
                    <td className="border p-1">
                      <input list="parts" className={cellInput} value={r.partNo} onChange={(e) => onPartNo(r, e.target.value)} placeholder="PART-###" />
                    </td>
                    <td className="border p-1">
                      <input className={cellInput} value={r.description} onChange={(e) => setRows(rows.map((x) => (x.key === r.key ? { ...x, description: e.target.value } : x)))} />
                    </td>
                    <td className="border p-1">
                      <input type="number" min="1" className={cellInput} value={r.qty} onChange={(e) => setRows(rows.map((x) => (x.key === r.key ? { ...x, qty: e.target.value } : x)))} />
                    </td>
                    <td className="border p-1">
                      <input className={cellInput} value={r.uom} onChange={(e) => setRows(rows.map((x) => (x.key === r.key ? { ...x, uom: e.target.value } : x)))} />
                    </td>
                    <td className="border p-1">
                      <input type="number" className={`${cellInput} text-muted-foreground`} value={r.onHand} onChange={(e) => setRows(rows.map((x) => (x.key === r.key ? { ...x, onHand: e.target.value } : x)))} />
                    </td>
                    <td className="border p-1">
                      <input
                        type="number"
                        min="0"
                        className={`${cellInput} ${Number(r.estimatedPrice) > QUOTATION_THRESHOLD ? 'border-red-500 bg-red-50 font-bold text-red-700' : ''}`}
                        value={r.estimatedPrice}
                        onChange={(e) => setRows(rows.map((x) => (x.key === r.key ? { ...x, estimatedPrice: e.target.value } : x)))}
                      />
                    </td>
                    <td className="border p-1">
                      <input className={cellInput} value={r.remarks} onChange={(e) => setRows(rows.map((x) => (x.key === r.key ? { ...x, remarks: e.target.value } : x)))} />
                    </td>
                    <td className="border p-1 text-center">
                      <button type="button" onClick={() => setRows(rows.filter((x) => x.key !== r.key))} disabled={rows.length === 1}>
                        <Trash2 className="size-4 text-destructive disabled:opacity-30" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <datalist id="parts">
              {db.items.map((i) => <option key={i.id} value={i.partNo}>{i.description}</option>)}
            </datalist>
          </div>
          <Button variant="outline" size="sm" onClick={() => setRows([...rows, newRow()])}>
            <Plus className="me-1 size-4" /> {t('v.addRow')}
          </Button>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t('f.generalRemarks')}</Label>
              <Input value={remarks} onChange={(e) => setRemarks(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('f.workOrder')}</Label>
              <Input value={workOrder} onChange={(e) => setWorkOrder(e.target.value)} placeholder={t('f.woPh')} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* قاعدة الـ 500 ريال */}
      <Card className={needQuotation ? 'border-amber-400 bg-amber-50' : ''}>
        <CardContent className="space-y-3 pt-6">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className={`size-5 ${needQuotation ? 'text-amber-600' : 'text-muted-foreground'}`} />
            {t('f.ruleTitle')}
          </div>
          {needQuotation ? (
            <div className="space-y-2">
              <p className="text-sm text-amber-800">{t('f.ruleNeed')}</p>
              <div className="flex items-center gap-3">
                <Input
                  type="file"
                  accept="application/pdf,image/*"
                  className="max-w-sm bg-background"
                  onChange={(e) => onQuotationFile(e.target.files?.[0] ?? null)}
                />
                {quotation && (
                  <span className="text-sm font-medium text-green-700">{t('f.attached')} {quotation.name}</span>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t('f.ruleOk')}</p>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button size="lg" onClick={submit} disabled={!canCreate || sending}>{sending ? t('ex.exporting') : t('f.submit')}</Button>
      </div>
    </div>
  )
}
