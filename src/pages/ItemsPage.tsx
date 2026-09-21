import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ReadOnlyBanner } from '@/components/ReadOnly'
import { useStore } from '@/lib/db'
import { useLang } from '@/lib/i18n'

const UOMS = ['قطعة', 'علبة', 'برميل', 'كرتونة', 'متر', 'كجم', 'لفة', 'طقم']

export default function ItemsPage() {
  const { db, stock, send, can } = useStore()
  const { t, lang } = useLang()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ partNo: '', description: '', uom: 'قطعة', category: '', minStock: '5' })
  const editable = can('canEditItems')

  async function submit() {
    if (!form.partNo.trim() || !form.description.trim()) return
    try {
      await send('addItem', {
        partNo: form.partNo.trim(),
        description: form.description.trim(),
        uom: form.uom,
        category: form.category.trim() || (lang === 'ar' ? 'عام' : 'General'),
        minStock: Number(form.minStock) || 0,
      })
      setForm({ partNo: '', description: '', uom: 'قطعة', category: '', minStock: '5' })
      setOpen(false)
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  async function remove(id: string, partNo: string) {
    try {
      await send('deleteItem', { id, partNo })
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('items.title')}</h1>
        {editable ? (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="me-2 size-4" /> {t('items.add')}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('items.new')}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label>{t('items.partNo')}</Label>
                  <Input value={form.partNo} onChange={(e) => setForm({ ...form, partNo: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('items.description')}</Label>
                  <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label>{t('items.uom')}</Label>
                    <select
                      className="flex h-9 w-full rounded-md border bg-background px-3 text-sm"
                      value={form.uom}
                      onChange={(e) => setForm({ ...form, uom: e.target.value })}
                    >
                      {UOMS.map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t('items.category')}</Label>
                    <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t('items.minStock')}</Label>
                    <Input type="number" value={form.minStock} onChange={(e) => setForm({ ...form, minStock: e.target.value })} />
                  </div>
                </div>
                <Button className="w-full" onClick={submit}>{t('common.save')}</Button>
              </div>
            </DialogContent>
          </Dialog>
        ) : (
          <ReadOnlyBanner />
        )}
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('items.partNo')}</TableHead>
              <TableHead>{t('items.description')}</TableHead>
              <TableHead>{t('items.category')}</TableHead>
              <TableHead>{t('items.uom')}</TableHead>
              <TableHead>{t('items.stock')}</TableHead>
              <TableHead>{t('items.minStock')}</TableHead>
              {editable && <TableHead></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {db.items.map((i) => {
              const s = stock(i.id)
              const low = s <= i.minStock
              return (
                <TableRow key={i.id}>
                  <TableCell className="whitespace-normal break-all font-mono font-medium">{i.partNo}</TableCell>
                  <TableCell className="max-w-96 whitespace-normal break-words">{i.description}</TableCell>
                  <TableCell>{i.category}</TableCell>
                  <TableCell>{i.uom}</TableCell>
                  <TableCell>
                    <Badge variant={low ? 'destructive' : 'secondary'}>{s}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{i.minStock}</TableCell>
                  {editable && (
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => remove(i.id, i.partNo)}>
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              )
            })}
            {db.items.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">{t('items.none')}</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
