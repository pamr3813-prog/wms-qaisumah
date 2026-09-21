import { useMemo, useState } from 'react'
import { Plus, MinusCircle, FileSpreadsheet, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { actualOf, exportFile, useStore } from '@/lib/db'
import { useLang } from '@/lib/i18n'
import { sectionLabel } from '@/lib/sections'
import { SearchableSelect } from '@/components/SearchableSelect'
import { ReadOnlyBanner } from '@/components/ReadOnly'
import type { StockItem, StockKind } from '@/types'

export default function StockModulePage({ kind }: { kind: StockKind }) {
  const { db, send, can, currentUser } = useStore()
  const { t, lang } = useLang()
  const [section, setSection] = useState('')
  const [exporting, setExporting] = useState(false)
  const editable = can('canIssueStock')

  const list = kind === 'janitorial' ? db.janitorial : db.consumables
  const title = kind === 'janitorial' ? t('st.title.janitorial') : t('st.title.consumables')

  const sections = useMemo(
    () => Array.from(new Set(list.map((i) => i.section).filter(Boolean))).sort(),
    [list],
  )
  const filtered = useMemo(() => list.filter((i) => !section || i.section === section), [list, section])

  const totals = useMemo(
    () => ({
      qty: Math.round(filtered.reduce((s, i) => s + i.qty, 0) * 100) / 100,
      used: Math.round(filtered.reduce((s, i) => s + i.used, 0) * 100) / 100,
      actual: Math.round(filtered.reduce((s, i) => s + actualOf(i), 0) * 100) / 100,
    }),
    [filtered],
  )

  return (
    <div className="space-y-4">
      {!editable && <ReadOnlyBanner />}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="text-xs text-muted-foreground">{t('st.imported')} — {filtered.length} / {list.length}</p>
        </div>
        <div className="flex items-center gap-2">
          <SearchableSelect
            className="w-56"
            options={[
              { value: '', label: `${t('st.filterSection')}: ${t('common.all')}` },
              ...sections.map((s) => ({ value: s, label: sectionLabel(s, lang) })),
            ]}
            value={section}
            onChange={setSection}
            clearable={false}
          />
          <Button
            variant="outline"
            disabled={exporting}
            onClick={async () => {
              setExporting(true)
              try {
                await exportFile(kind === 'janitorial' ? 'janitorial' : 'consumables')
              } catch {
                toast.error(t('ex.export'))
              } finally {
                setExporting(false)
              }
            }}
          >
            <FileSpreadsheet className="me-2 size-4 text-green-600" />
            {exporting ? t('ex.exporting') : t('ex.export')}
          </Button>
          {editable && <ItemDialog kind={kind} send={send} />}
        </div>
      </div>

      <div className="flex gap-3 text-sm">
        <Badge variant="secondary" className="px-3 py-1.5">{t('st.receivedQty')}: {totals.qty}</Badge>
        <Badge className="bg-orange-500 px-3 py-1.5">{t('st.usedQty')}: {totals.used}</Badge>
        <Badge className="bg-green-600 px-3 py-1.5">{t('st.actualQty')}: {totals.actual}</Badge>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">{t('common.sn')}</TableHead>
              <TableHead>{t('st.airport')}</TableHead>
              <TableHead>{t('st.section')}</TableHead>
              <TableHead>{lang === 'ar' ? 'وصف الصنف' : 'Item description'}</TableHead>
              <TableHead>{t('st.manufacturer')}</TableHead>
              <TableHead>{t('st.partNo')}</TableHead>
              <TableHead className="text-center">{t('items.uom')}</TableHead>
              <TableHead className="text-center">{t('st.receivedQty')}</TableHead>
              <TableHead className="text-center">{t('st.usedQty')}</TableHead>
              <TableHead className="text-center">{t('st.actualQty')}</TableHead>
              <TableHead>{t('common.notes')}</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((i) => {
              const actual = actualOf(i)
              return (
                <TableRow key={i.id}>
                  <TableCell className="text-muted-foreground">{i.no}</TableCell>
                  <TableCell><Badge variant="outline">{i.airport}</Badge></TableCell>
                  <TableCell><Badge variant="secondary" className="bg-orange-50 text-orange-700">{sectionLabel(i.section, lang)}</Badge></TableCell>
                  <TableCell className="max-w-72 whitespace-normal break-words">{i.description}</TableCell>
                  <TableCell className="whitespace-normal break-words text-muted-foreground">{i.manufacturer}</TableCell>
                  <TableCell className="whitespace-normal break-all font-mono text-xs">{i.partNo}</TableCell>
                  <TableCell className="text-center">{i.uom}</TableCell>
                  <TableCell className="text-center">{i.qty}</TableCell>
                  <TableCell className="text-center text-orange-600">{i.used}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={actual > 0 ? 'secondary' : 'destructive'}>{actual}</Badge>
                  </TableCell>
                  <TableCell className="max-w-56 whitespace-normal break-words text-muted-foreground">{i.remarks ?? ''}</TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      <UseDialog
                        item={i}
                        disabled={!editable || actual <= 0}
                        onUse={async (qty, note) => {
                          try {
                            await send('recordUsage', { kind, itemId: i.id, qty, note, by: currentUser?.name })
                            toast.success(t('st.usedOk'))
                          } catch {
                            /* رسالة الخطأ تظهر تلقائياً */
                          }
                        }}
                      />
                      {editable && (
                        <>
                          <ItemDialog kind={kind} send={send} initial={i} />
                          <Button
                            variant="ghost"
                            size="icon"
                            title={t('common.delete')}
                            onClick={async () => {
                              if (!window.confirm(`${t('common.confirmDelete')}\n${i.description}`)) return
                              try {
                                await send('deleteStockItem', { kind, id: i.id })
                                toast.success(t('common.deleted'))
                              } catch {
                                /* رسالة الخطأ تظهر تلقائياً */
                              }
                            }}
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={12} className="py-10 text-center text-muted-foreground">{t('st.empty')}</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function UseDialog({
  item,
  disabled,
  onUse,
}: {
  item: StockItem
  disabled: boolean
  onUse: (qty: number, note: string) => void
}) {
  const { t, lang } = useLang()
  const { db } = useStore()
  const [open, setOpen] = useState(false)
  const [qty, setQty] = useState('1')
  const [dept, setDept] = useState('')
  const note = dept

  /* الأقسام المعروفة — تسهيل اختيار الجهة المستلمة عند الصرف */
  const departments = useMemo(
    () => Array.from(new Set([...db.janitorial, ...db.consumables].map((i) => (i.section ?? '').trim()).filter(Boolean))).sort(),
    [db.janitorial, db.consumables],
  )

  function submit() {
    const q = Number(qty)
    if (!(q > 0)) return
    if (q > actualOf(item)) {
      toast.error(t('st.errQty'))
      return
    }
    onUse(q, note.trim())
    setOpen(false)
    setQty('1')
    setDept('')
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" disabled={disabled} title={t('st.use')}>
          <MinusCircle className="size-4 text-orange-600" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('st.useTitle')} — {item.description}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>{t('st.useQty')} ({item.uom}) — {t('common.available')}: {actualOf(item)}</Label>
            <Input type="number" min="1" max={actualOf(item)} value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t('st.useFor')}</Label>
            <SearchableSelect
              options={[
                { value: '', label: '—' },
                ...departments.map((d) => ({ value: d, label: sectionLabel(d, lang) })),
              ]}
              value={dept}
              onChange={setDept}
              placeholder="—"
              clearable={false}
            />
          </div>
          <Button className="w-full" onClick={submit}>{t('st.use')}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ItemDialog({
  kind,
  send,
  initial,
}: {
  kind: StockKind
  send: (type: string, payload: unknown) => Promise<unknown>
  initial?: StockItem
}) {
  const { db } = useStore()
  const { t, lang } = useLang()
  const [open, setOpen] = useState(false)
  const [airport, setAirport] = useState(initial?.airport ?? 'QSMA')
  const [section, setSection] = useState(initial?.section ?? '')
  const [desc, setDesc] = useState(initial?.description ?? '')
  const [manufacturer, setManufacturer] = useState(initial?.manufacturer ?? '')
  const [partNo, setPartNo] = useState(initial?.partNo ?? '')
  const [uom, setUom] = useState(initial?.uom ?? 'EA')
  const [qty, setQty] = useState(String(initial?.qty ?? 0))
  const [remarks, setRemarks] = useState(initial?.remarks ?? '')

  const list = kind === 'janitorial' ? db.janitorial : db.consumables
  const nextNo = initial?.no ?? String(list.length + 1)

  function submit() {
    if (!desc.trim()) return
    if (initial) {
      void send('updateStockItem', {
        kind,
        id: initial.id,
        fields: {
          airport: airport.trim() || 'QSMA',
          section: section.trim() || 'GENERAL',
          description: desc.trim(),
          manufacturer: manufacturer.trim(),
          partNo: partNo.trim(),
          uom: uom.trim() || 'EA',
          qty: Number(qty) || 0,
          remarks: remarks.trim() || null,
        },
      })
    } else {
      const item: Omit<StockItem, 'id' | 'imported'> = {
        no: nextNo,
        airport: airport.trim() || 'QSMA',
        section: section.trim() || 'GENERAL',
        description: desc.trim(),
        manufacturer: manufacturer.trim(),
        partNo: partNo.trim(),
        uom: uom.trim() || 'EA',
        qty: Number(qty) || 0,
        used: 0,
        remarks: remarks.trim() || null,
      }
      void send('addStockItem', { kind, item })
    }
    setOpen(false)
    setDesc(''); setManufacturer(''); setPartNo(''); setQty('0'); setRemarks('')
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {initial ? (
          <Button variant="ghost" size="icon" title={t('common.edit')}>
            <Pencil className="size-4 text-primary" />
          </Button>
        ) : (
          <Button><Plus className="me-2 size-4" /> {t('st.add')}</Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? `${t('common.edit')} — #${initial.no}` : `${t('st.new')} — #${nextNo}`}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 py-2">
          <div className="space-y-1.5">
            <Label>{t('st.airport')}</Label>
            <Input value={airport} onChange={(e) => setAirport(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t('st.section')}</Label>
            <Input value={section} onChange={(e) => setSection(e.target.value)} placeholder="JANITORIAL / ELECTRICAL…" />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>{lang === 'ar' ? 'وصف الصنف' : 'Item description'}</Label>
            <Input value={desc} onChange={(e) => setDesc(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t('st.manufacturer')}</Label>
            <Input value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t('st.partNo')}</Label>
            <Input value={partNo} onChange={(e) => setPartNo(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t('items.uom')}</Label>
            <Input value={uom} onChange={(e) => setUom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t('st.receivedQty')}</Label>
            <Input type="number" min="0" value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>{t('common.notes')}</Label>
            <Input value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </div>
        </div>
        <Button className="w-full" onClick={submit}>{t('st.add')}</Button>
      </DialogContent>
    </Dialog>
  )
}
