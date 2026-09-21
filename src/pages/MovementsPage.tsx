import { useState } from 'react'
import { Link } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AttachmentList } from '@/components/AttachmentUploader'
import { VoucherDialog } from '@/components/VoucherDialog'
import { IssuanceDialog } from '@/components/IssuanceDialog'
import { ReadOnlyBanner } from '@/components/ReadOnly'
import { useStore } from '@/lib/db'
import { useLang } from '@/lib/i18n'
import { fmtDate, fmtDateTime } from '@/lib/format'
import type { MovementType } from '@/types'

export default function MovementsPage({ type }: { type: MovementType }) {
  const { db, can, currentUser, send } = useStore()
  const { t, lang } = useLang()
  const isIn = type === 'in'
  const [q, setQ] = useState('')
  const ql = q.trim().toLowerCase()
  const hit = (...vals: Array<string | null | undefined>) => !ql || vals.some((v) => (v ?? '').toLowerCase().includes(ql))
  /* الصنف من أي مصدر: المستودع أو مواد النظافة أو المستهلكات */
  const itemName = (m: (typeof db.movements)[number]) => {
    if (!m.kind || m.kind === 'warehouse') return db.items.find((i) => i.id === m.itemId)
    const mod = m.kind === 'janitorial' ? db.janitorial : db.consumables
    return mod.find((i) => i.id === m.itemId)
  }
  const list = db.movements
    .filter((m) => m.type === type)
    .filter((m) => hit(m.voucherNo, m.refNo, m.createdBy, m.notes, itemName(m)?.description, itemName(m)?.partNo))
  const editable = can('canEditVouchers')
  const pendingIssuances = isIn
    ? []
    : db.issuances.filter((i) => i.status === 'pending').filter((i) => hit(i.itemDescription, i.partNo, i.department, i.createdBy, i.receiverName, i.voucherNo))
  /* الصادر المعتمد من مواد النظافة والمستهلكات — يظهر في سندات الصادر */
  const moduleIssuances = isIn
    ? []
    : db.issuances
        .filter((i) => i.status === 'approved' && (i.kind === 'janitorial' || i.kind === 'consumables'))
        .filter((i) => hit(i.itemDescription, i.partNo, i.department, i.createdBy, i.receiverName, i.voucherNo))

  async function approve(id: string) {
    try {
      await send('approveIssuance', { id })
    } catch (e) {
      /* تظهر رسالة الخطأ تلقائياً */
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{isIn ? t('v.in.title') : t('v.out.title')}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('common.search')} className="w-44 md:w-56" />
          {editable ? (
            <div className="flex gap-2">
              {!isIn && <IssuanceDialog />}
              <VoucherDialog type={type} />
            </div>
          ) : (
            <ReadOnlyBanner />
          )}
        </div>
      </div>

      {!isIn && pendingIssuances.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50">
          <div className="border-b border-amber-300 px-4 py-2 font-semibold text-amber-800">
            {t('is.title')} ({pendingIssuances.length})
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('is.item')}</TableHead>
                <TableHead>{t('common.qty')}</TableHead>
                <TableHead>{t('is.dept')}</TableHead>
                <TableHead>{t('by.label')}</TableHead>
                <TableHead>{t('is.receiver')}</TableHead>
                <TableHead>{t('common.date')}</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingIssuances.map((iss) => {
                const canApprove = currentUser && (currentUser.id === iss.receiverId || can('canManageUsers'))
                return (
                  <TableRow key={iss.id}>
                    <TableCell>
                      {iss.itemDescription} <span className="text-muted-foreground">({iss.partNo})</span>{' '}
                      {iss.kind === 'janitorial' || iss.kind === 'consumables' ? (
                        <Badge variant="secondary" className={iss.kind === 'janitorial' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}>
                          {iss.kind === 'janitorial' ? t('inv.catJanitorial') : t('inv.catConsumables')}
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Badge variant="destructive">−{iss.qty} {iss.uom}</Badge>
                    </TableCell>
                    <TableCell>{iss.department || '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{iss.createdBy}</TableCell>
                    <TableCell>{iss.receiverName}</TableCell>
                    <TableCell className="text-muted-foreground">{fmtDateTime(iss.createdAt)}</TableCell>
                    <TableCell className="text-end">
                      {canApprove ? (
                        <Button size="sm" onClick={() => approve(iss.id)}>{t('is.receive')}</Button>
                      ) : (
                        <Badge variant="outline" className="text-amber-700">{t('is.waiting')}</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {!isIn && moduleIssuances.length > 0 && (
        <div className="rounded-lg border bg-card">
          <div className="border-b px-4 py-2 font-semibold">
            {t('is.moduleOutTitle')} ({moduleIssuances.length})
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('v.no')}</TableHead>
                <TableHead>{t('common.date')}</TableHead>
                <TableHead>{t('v.item')}</TableHead>
                <TableHead>{t('common.qty')}</TableHead>
                <TableHead>{t('inv.cat')}</TableHead>
                <TableHead>{t('is.dept')}</TableHead>
                <TableHead>{t('by.label')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {moduleIssuances.map((iss) => (
                <TableRow key={iss.id}>
                  <TableCell className="font-mono font-medium">{iss.voucherNo}</TableCell>
                  <TableCell className="text-muted-foreground">{fmtDateTime(iss.approvedAt ?? iss.createdAt)}</TableCell>
                  <TableCell>
                    {iss.itemDescription} <span className="text-muted-foreground">({iss.partNo})</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="destructive">−{iss.qty} {iss.uom}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={iss.kind === 'janitorial' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}>
                      {iss.kind === 'janitorial' ? t('inv.catJanitorial') : t('inv.catConsumables')}
                    </Badge>
                  </TableCell>
                  <TableCell>{iss.department || '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{iss.approvedBy ?? iss.createdBy}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('v.no')}</TableHead>
              <TableHead>{t('common.date')}</TableHead>
              <TableHead>{t('v.item')}</TableHead>
              <TableHead>{t('common.qty')}</TableHead>
              <TableHead>{t('v.ref')}</TableHead>
              <TableHead>{t('v.attachments')}</TableHead>
              <TableHead>{t('by.label')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((m) => {
              const item = itemName(m)
              return (
                <TableRow key={m.id}>
                  <TableCell className="font-mono font-medium">{m.voucherNo}</TableCell>
                  <TableCell>{fmtDate(m.date)}</TableCell>
                  <TableCell>
                    {item ? `${item.description} (${item.partNo || '—'})` : t('v.deletedItem')}{' '}
                    {m.kind === 'janitorial' || m.kind === 'consumables' ? (
                      <Badge variant="secondary" className={m.kind === 'janitorial' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}>
                        {m.kind === 'janitorial' ? t('inv.catJanitorial') : t('inv.catConsumables')}
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <Badge variant={isIn ? 'default' : 'destructive'}>
                      {isIn ? '+' : '−'}{m.qty} {item?.uom}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {m.mrfId ? (
                      <Link to={`/purchases/${m.mrfId}`} className="text-primary hover:underline">
                        {db.mrfs.find((x) => x.id === m.mrfId)?.mrfNo ?? m.refNo ?? '—'}
                      </Link>
                    ) : (
                      m.refNo ?? '—'
                    )}
                  </TableCell>
                  <TableCell><AttachmentList attachments={m.attachments} /></TableCell>
                  <TableCell className="text-muted-foreground">{m.createdBy}</TableCell>
                </TableRow>
              )
            })}
            {list.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  {isIn ? t('v.emptyIn') : lang === 'ar' ? 'لا توجد سندات صادر بعد' : 'No outbound vouchers yet'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
