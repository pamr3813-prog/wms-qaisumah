import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { actualOf, useStore } from '@/lib/db'
import { useLang } from '@/lib/i18n'
import { fmtDateTime } from '@/lib/format'
import { sectionLabel } from '@/lib/sections'
import { SearchableSelect } from '@/components/SearchableSelect'

type Cat = 'all' | 'warehouse' | 'janitorial' | 'consumables'

interface StockRow {
  key: string
  cat: Exclude<Cat, 'all'>
  id: string
  partNo: string
  description: string
  uom: string
  qty: number
  low: boolean
  section?: string
}

export default function InventoryPage() {
  const { db, stock } = useStore()
  const { t, lang } = useLang()
  const [selected, setSelected] = useState<string | null>(null)
  const [cat, setCat] = useState<Cat>('all')
  const [sec, setSec] = useState<string>('all')

  const rows = useMemo<StockRow[]>(() => {
    const warehouse: StockRow[] = db.items.map((i) => {
      const s = stock(i.id)
      return {
        key: `w-${i.id}`, cat: 'warehouse', id: i.id,
        partNo: i.partNo, description: i.description, uom: i.uom,
        qty: s, low: s <= i.minStock,
      }
    })
    const fromModule = (list: typeof db.janitorial, c: 'janitorial' | 'consumables'): StockRow[] =>
      list.map((i) => {
        const a = actualOf(i)
        return {
          key: `${c}-${i.id}`, cat: c, id: i.id,
          partNo: i.partNo ?? '', description: i.description, uom: i.uom,
          qty: a, low: a <= 0,
          section: c === 'consumables' ? i.section : undefined,
        }
      })
    return [...warehouse, ...fromModule(db.janitorial, 'janitorial'), ...fromModule(db.consumables, 'consumables')]
  }, [db.items, db.janitorial, db.consumables, stock])

  const filtered = useMemo(() => {
    let r = cat === 'all' ? rows : rows.filter((x) => x.cat === cat)
    if (cat === 'consumables' && sec !== 'all') r = r.filter((x) => (x.section ?? '').trim() === sec)
    return r
  }, [rows, cat, sec])

  const sections = useMemo(
    () => [...new Set(db.consumables.map((i) => (i.section ?? '').trim()).filter(Boolean))].sort(),
    [db.consumables],
  )

  const selMovements = db.movements.filter((m) => m.itemId === selected)
  const selUsage = db.stockUsages.filter((u) => u.itemId === selected)
  const selRow = rows.find((r) => r.key === selected)

  const CATS: Array<{ id: Cat; label: string }> = [
    { id: 'all', label: t('common.all') },
    { id: 'warehouse', label: t('inv.catWarehouse') },
    { id: 'janitorial', label: t('inv.catJanitorial') },
    { id: 'consumables', label: t('inv.catConsumables') },
  ]

  const catBadge = (r: StockRow): { label: string; cls: string } => {
    if (r.cat === 'warehouse') return { label: t('inv.catWarehouse'), cls: 'bg-slate-100 text-slate-700' }
    if (r.cat === 'janitorial') return { label: t('inv.catJanitorial'), cls: 'bg-blue-100 text-blue-700' }
    return { label: sectionLabel(r.section ?? '', lang), cls: 'bg-orange-100 text-orange-700' }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="lg:col-span-3">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">{t('inv.title')}</h1>
          <div className="flex flex-wrap items-center gap-1.5">
            {CATS.map((c) => (
              <Button
                key={c.id}
                size="sm"
                variant={cat === c.id ? 'default' : 'outline'}
                onClick={() => { setCat(c.id); if (c.id !== 'consumables') setSec('all') }}
              >
                {c.label}
              </Button>
            ))}
            {cat === 'consumables' && (
              <SearchableSelect
                className="w-48"
                options={[
                  { value: 'all', label: t('inv.allConsumables') },
                  ...sections.map((s) => ({ value: s, label: sectionLabel(s, lang) })),
                ]}
                value={sec}
                onChange={setSec}
                clearable={false}
              />
            )}
          </div>
        </div>
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('inv.cat')}</TableHead>
                <TableHead>{t('items.partNo')}</TableHead>
                <TableHead>{t('items.description')}</TableHead>
                <TableHead>{t('items.uom')}</TableHead>
                <TableHead>{t('items.stock')}</TableHead>
                <TableHead>{t('p.status')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow
                  key={r.key}
                  className="cursor-pointer"
                  onClick={() => setSelected(r.key)}
                >
                  <TableCell>
                    <Badge variant="secondary" className={catBadge(r).cls}>{catBadge(r).label}</Badge>
                  </TableCell>
                  <TableCell className="font-mono font-medium">{r.partNo || '—'}</TableCell>
                  <TableCell>{r.description}</TableCell>
                  <TableCell>{r.uom}</TableCell>
                  <TableCell className="text-lg font-bold">{r.qty}</TableCell>
                  <TableCell>
                    <Badge variant={r.low ? 'destructive' : 'secondary'}>
                      {r.low ? t('inv.low') : t('inv.ok')}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">{t('common.none')}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="lg:col-span-2">
        <h2 className="mb-4 text-lg font-bold">
          {selRow ? `— ${selRow.description}` : ''}
        </h2>
        {selRow?.cat === 'warehouse' ? (
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('v.no')}</TableHead>
                  <TableHead>{t('inv.type')}</TableHead>
                  <TableHead>{t('common.qty')}</TableHead>
                  <TableHead>{t('common.date')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selMovements.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-mono text-sm">{m.voucherNo}</TableCell>
                    <TableCell>
                      <Badge variant={m.type === 'in' ? 'default' : 'destructive'}>
                        {m.type === 'in' ? t('inv.in') : t('inv.out')}
                      </Badge>
                    </TableCell>
                    <TableCell>{m.type === 'in' ? '+' : '−'}{m.qty}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{fmtDateTime(m.date)}</TableCell>
                  </TableRow>
                ))}
                {selMovements.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">{t('inv.noMoves')}</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        ) : selRow ? (
          /* سجل صرف مواد النظافة / المستهلكات */
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('common.date')}</TableHead>
                  <TableHead>{t('common.qty')}</TableHead>
                  <TableHead>{t('st.useFor')}</TableHead>
                  <TableHead>{t('by.label')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selUsage.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="text-sm text-muted-foreground">{fmtDateTime(u.date)}</TableCell>
                    <TableCell><Badge variant="destructive">−{u.qty}</Badge></TableCell>
                    <TableCell className="text-sm">{u.note ?? ''}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{u.by}</TableCell>
                  </TableRow>
                ))}
                {selUsage.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">{t('inv.noUsage')}</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="text-muted-foreground">{t('inv.pick')}</p>
        )}
      </div>
    </div>
  )
}
