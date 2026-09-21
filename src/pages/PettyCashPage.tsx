import { useMemo, useState } from 'react'
import { Plus, FileSpreadsheet, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ReadOnlyBanner } from '@/components/ReadOnly'
import { exportFile, useStore } from '@/lib/db'
import { useLang } from '@/lib/i18n'
import { fmtDate, fmtMoney } from '@/lib/format'
import { SearchableSelect } from '@/components/SearchableSelect'

const SHEET_ORDER = ['SEPT', 'OCT', 'NOVE', 'DEC', 'JAN-2026', 'FEB-2026', 'MARCH-2026', 'APRIL-2026', 'MAY-2026', 'JUN-2026', 'JULY-2026', 'Aug-2026', 'SEP-2026']

const DEPTS = ['AC', 'CIVIL', 'ELECTRICAL', 'LANDSCAPE', 'MOTOR POOL', 'P&G', 'PAWERPLANT', 'PLUMBING', 'COMMNUCATION', 'OTHER']

export default function PettyCashPage() {
  const { db, send, can } = useStore()
  const { t, lang } = useLang()
  const [month, setMonth] = useState('SEP-2026')
  const [dept, setDept] = useState('')
  const [exporting, setExporting] = useState(false)
  const editable = can('canEditPetty')

  const months = useMemo(() => {
    const set = new Set(db.pettyCash.map((p) => p.month))
    return SHEET_ORDER.filter((m) => set.has(m))
  }, [db.pettyCash])

  const departments = useMemo(() => {
    const set = new Set(db.pettyCash.map((p) => p.department).filter(Boolean))
    return Array.from(set).sort()
  }, [db.pettyCash])

  const filtered = useMemo(
    () =>
      db.pettyCash
        .filter((p) => p.month === month)
        .filter((p) => !dept || p.department === dept)
        .sort((a, b) => Number(a.date?.slice(-2)) - Number(b.date?.slice(-2))),
    [db.pettyCash, month, dept],
  )

  const monthTotal = filtered.reduce((s, p) => s + (p.total ?? 0), 0)
  const monthVat = filtered.reduce((s, p) => s + (p.vat ?? 0), 0)

  async function doExport() {
    setExporting(true)
    try {
      await exportFile('petty-cash')
    } catch {
      toast.error(t('auth.offline'))
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t('pc.title')}</h1>
          <p className="text-xs text-muted-foreground">{t('pc.imported')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={doExport} disabled={exporting}>
            <FileSpreadsheet className="me-2 size-4 text-green-700" />
            {exporting ? t('ex.exporting') : t('ex.export')}
          </Button>
          {editable ? (
            <EntryDialog months={months} departments={departments} defaultMonth={month} onSave={send} />
          ) : (
            <ReadOnlyBanner />
          )}
        </div>
      </div>

      {/* الفلاتر والملخص */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 pt-6">
          <div className="space-y-1.5">
            <Label>{t('pc.month')}</Label>
            <select className="h-9 rounded-md border bg-background px-3 text-sm" value={month} onChange={(e) => setMonth(e.target.value)}>
              {months.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>{t('pc.department')}</Label>
            <select className="h-9 rounded-md border bg-background px-3 text-sm" value={dept} onChange={(e) => setDept(e.target.value)}>
              <option value="">{t('common.all')}</option>
              {departments.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="ms-auto text-end">
            <div className="text-xs text-muted-foreground">
              {t('pc.grandTotal')} — {filtered.length} {t('pc.entries')}
            </div>
            <div className="text-xl font-bold text-primary">{fmtMoney(monthTotal)}</div>
            <div className="text-xs text-muted-foreground">{t('pc.vat')}: {fmtMoney(monthVat)}</div>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">{t('common.sn')}</TableHead>
              <TableHead>{t('common.date')}</TableHead>
              <TableHead>{t('pc.department')}</TableHead>
              <TableHead>{lang === 'ar' ? 'وصف الصنف' : 'Item description'}</TableHead>
              <TableHead>{t('pc.invoiceNo')}</TableHead>
              <TableHead className="text-center">{t('common.qty')}</TableHead>
              <TableHead className="text-center">{t('pc.unitPrice')}</TableHead>
              <TableHead className="text-center">{t('pc.price')}</TableHead>
              <TableHead className="text-center">{t('pc.vat')}</TableHead>
              <TableHead className="text-center">{t('common.total')}</TableHead>
              <TableHead>{t('by.label')}</TableHead>
              <TableHead className="w-20">{t('common.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((p, idx) => (
              <TableRow key={p.id}>
                <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                <TableCell className="whitespace-nowrap">{fmtDate(p.date)}</TableCell>
                <TableCell><Badge variant="secondary">{p.department}</Badge></TableCell>
                <TableCell className="max-w-96 whitespace-normal break-words">{p.description}</TableCell>
                <TableCell className="font-mono text-xs">{p.invoiceNo}</TableCell>
                <TableCell className="text-center">{p.qty ?? '—'}</TableCell>
                <TableCell className="text-center">{fmtMoney(p.unitPrice)}</TableCell>
                <TableCell className="text-center">{fmtMoney(p.totalPrice)}</TableCell>
                <TableCell className="text-center text-muted-foreground">{fmtMoney(p.vat)}</TableCell>
                <TableCell className="text-center font-semibold">{fmtMoney(p.total)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{p.by ?? (p.imported ? 'استيراد' : '')}</TableCell>
                <TableCell>
                  {editable && (
                    <div className="flex items-center">
                      <EntryDialog months={months} departments={departments} defaultMonth={month} onSave={send} initial={p} />
                      <Button
                        variant="ghost"
                        size="icon"
                        title={t('common.delete')}
                        onClick={async () => {
                          if (!window.confirm(`${t('common.confirmDelete')}\n${p.description}`)) return
                          try {
                            await send('deletePettyEntry', { id: p.id })
                            toast.success(t('common.deleted'))
                          } catch {
                            /* رسالة الخطأ تظهر تلقائياً */
                          }
                        }}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={12} className="py-10 text-center text-muted-foreground">{t('common.none')}</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function EntryDialog({
  months,
  departments,
  defaultMonth,
  onSave,
  initial,
}: {
  months: string[]
  departments: string[]
  defaultMonth: string
  onSave: (type: string, payload: unknown) => Promise<unknown>
  initial?: import('@/types').PettyEntry
}) {
  const { t, lang } = useLang()
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState(initial?.month ?? defaultMonth)
  const [date, setDate] = useState(initial?.date ?? new Date().toISOString().slice(0, 10))
  const [dept, setDept] = useState(initial?.department ?? '')
  const [desc, setDesc] = useState(initial?.description ?? '')
  const [invoice, setInvoice] = useState(initial?.invoiceNo ?? '')
  const [qty, setQty] = useState(String(initial?.qty ?? 1))
  const [unitPrice, setUnitPrice] = useState(String(initial?.unitPrice ?? ''))
  const [remarks, setRemarks] = useState(initial?.remarks ?? '')

  const price = (Number(qty) || 0) * (Number(unitPrice) || 0)
  const vat = price * 0.15
  const total = price + vat

  async function submit() {
    if (!dept || !desc.trim() || !invoice.trim() || !(Number(qty) > 0)) {
      toast.error(t('pc.errFields'))
      return
    }
    try {
      if (initial) {
        await onSave('updatePettyEntry', {
          id: initial.id,
          fields: {
            month,
            date,
            department: dept,
            description: desc.trim(),
            invoiceNo: invoice.trim(),
            qty: Number(qty),
            unitPrice: Number(unitPrice) || 0,
            remarks: remarks.trim() || null,
          },
        })
      } else {
        await onSave('addPettyEntry', {
          month,
          date,
          department: dept,
          description: desc.trim(),
          invoiceNo: invoice.trim(),
          qty: Number(qty),
          unitPrice: Number(unitPrice) || 0,
          totalPrice: price,
          vat,
          total,
          remarks: remarks.trim() || null,
        })
      }
      toast.success(t('pc.saved'))
      setOpen(false)
      setDesc(''); setInvoice(''); setQty('1'); setUnitPrice(''); setRemarks('')
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {initial ? (
          <Button variant="ghost" size="icon" title={t('common.edit')}>
            <Pencil className="size-4 text-primary" />
          </Button>
        ) : (
          <Button><Plus className="me-2 size-4" /> {t('pc.add')}</Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{initial ? t('common.edit') : t('pc.newEntry')}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 py-2">
          <div className="space-y-1.5">
            <Label>{t('pc.month')}</Label>
            <select className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={month} onChange={(e) => setMonth(e.target.value)}>
              {months.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>{t('common.date')}</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t('pc.department')}</Label>
            <SearchableSelect
              options={[...new Set([...DEPTS, ...departments])].map((d) => ({ value: d, label: d }))}
              value={dept}
              onChange={setDept}
              placeholder="—"
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t('pc.invoiceNo')}</Label>
            <Input value={invoice} onChange={(e) => setInvoice(e.target.value)} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>{lang === 'ar' ? 'وصف الصنف' : 'Item description'}</Label>
            <Input value={desc} onChange={(e) => setDesc(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t('common.qty')}</Label>
            <Input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t('pc.unitPrice')}</Label>
            <Input type="number" min="0" step="0.01" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} />
          </div>
          <div className="col-span-2 rounded-md bg-muted p-3 text-sm">
            <div className="flex justify-between"><span>{t('pc.price')}</span><span>{fmtMoney(price)}</span></div>
            <div className="flex justify-between text-muted-foreground"><span>{t('pc.vat')}</span><span>{fmtMoney(vat)}</span></div>
            <div className="flex justify-between border-t pt-1 font-bold"><span>{t('common.total')}</span><span>{fmtMoney(total)}</span></div>
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>{t('common.notes')}</Label>
            <Input value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </div>
        </div>
        <Button className="w-full" onClick={submit}>{t('pc.add')}</Button>
      </DialogContent>
    </Dialog>
  )
}
