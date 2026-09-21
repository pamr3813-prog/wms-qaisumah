import { useMemo, useState } from 'react'
import { Send } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { SearchableSelect, type SearchOption } from '@/components/SearchableSelect'
import { actualOf, useStore } from '@/lib/db'
import { useLang } from '@/lib/i18n'
import { sectionLabel } from '@/lib/sections'

/** حوار طلب صرف مواد لقسم — لا يُخصم المخزون إلا بعد موافقة مستلم المواد */
export function IssuanceDialog() {
  const { db, send, stock } = useStore()
  const { t, lang } = useLang()
  const [open, setOpen] = useState(false)
  const [itemRef, setItemRef] = useState('')
  const [qty, setQty] = useState('1')
  const [department, setDepartment] = useState('')
  const [receiverId, setReceiverId] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  /* الأصناف المتاحة صرفاً من كل المصادر — قابلة للبحث بالكتابة */
  const itemOptions = useMemo<SearchOption[]>(() => [
    ...db.items.filter((i) => stock(i.id) > 0).map((i) => ({
      value: `w:${i.id}`,
      label: `${i.partNo} — ${i.description} (${t('common.available')} ${stock(i.id)} ${i.uom})`,
      group: t('inv.catWarehouse'),
    })),
    ...db.janitorial.filter((i) => actualOf(i) > 0).map((i) => ({
      value: `j:${i.id}`,
      label: `${i.partNo ? i.partNo + ' — ' : ''}${i.description} (${t('common.available')} ${actualOf(i)} ${i.uom})`,
      group: t('inv.catJanitorial'),
    })),
    ...db.consumables.filter((i) => actualOf(i) > 0).map((i) => ({
      value: `c:${i.id}`,
      label: `${sectionLabel(i.section, lang)} — ${i.description} (${t('common.available')} ${actualOf(i)} ${i.uom})`,
      group: t('inv.catConsumables'),
    })),
  ], [db.items, db.janitorial, db.consumables, stock, t, lang])

  const receiverOptions = useMemo<SearchOption[]>(() =>
    db.users.filter((u) => u.active).map((u) => ({ value: u.id, label: u.name })),
  [db.users])

  async function submit() {
    const m = itemRef.match(/^(w|j|c):(.+)$/)
    if (!m || Number(qty) <= 0 || !department.trim() || !receiverId) {
      toast.error(t('f.errFields'))
      return
    }
    const kind = m[1] === 'j' ? 'janitorial' : m[1] === 'c' ? 'consumables' : 'warehouse'
    setBusy(true)
    try {
      await send('createIssuance', {
        kind,
        itemId: m[2],
        qty: Number(qty),
        department: department.trim(),
        receiverId,
        note: note.trim(),
      })
      toast.success(t('is.sent'))
      setOpen(false)
      setItemRef(''); setQty('1'); setDepartment(''); setReceiverId(''); setNote('')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Send className="me-2 size-4" />
          {t('is.new')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('is.new')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>{t('is.item')}</Label>
            <SearchableSelect
              options={itemOptions}
              value={itemRef}
              onChange={setItemRef}
              placeholder={t('v.pickItem')}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t('common.qty')}</Label>
              <Input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('is.dept')}</Label>
              <Input value={department} onChange={(e) => setDepartment(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{t('is.receiver')}</Label>
            <SearchableSelect
              options={receiverOptions}
              value={receiverId}
              onChange={setReceiverId}
              placeholder={t('by.label')}
            />
          </div>

          <div className="space-y-1.5">
            <Label>{t('is.note')}</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          <Button className="w-full" onClick={submit} disabled={busy}>
            {busy ? t('ex.exporting') : t('is.request')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
