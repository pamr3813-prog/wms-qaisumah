import { Link } from 'react-router'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { nextApproval, mrfTotal, ROLES, useStore } from '@/lib/db'
import { useLang } from '@/lib/i18n'
import { fmtDate, fmtMoney } from '@/lib/format'
import type { Priority } from '@/types'

const STATUS = {
  pending: 'p.statusPending',
  approved: 'p.statusApproved',
  rejected: 'p.statusRejected',
} as const

const STATUS_CLS = {
  pending: 'bg-amber-500',
  approved: 'bg-green-600',
  rejected: 'bg-red-600',
} as const

const PRIO = {
  normal: 'p.priorityNormal',
  urgent: 'p.priorityUrgent',
  top: 'p.priorityTop',
} as const

export function priorityBadge(p: Priority) {
  return p === 'top' ? 'bg-red-600' : p === 'urgent' ? 'bg-orange-500' : 'bg-slate-500'
}

export default function PurchasesPage() {
  const { db } = useStore()
  const { t } = useLang()

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('p.title')}</h1>
        <Link to="/purchases/new">
          <Button><Plus className="me-2 size-4" /> {t('p.new')}</Button>
        </Link>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('p.no')}</TableHead>
              <TableHead>{t('common.date')}</TableHead>
              <TableHead>{t('p.site')}</TableHead>
              <TableHead>{t('p.department')}</TableHead>
              <TableHead>{t('p.priority')}</TableHead>
              <TableHead>{t('p.estTotal')}</TableHead>
              <TableHead>{t('p.waiting')}</TableHead>
              <TableHead>{t('p.status')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {db.mrfs.map((m) => {
              const nxt = nextApproval(m)
              return (
                <TableRow key={m.id}>
                  <TableCell>
                    <Link to={`/purchases/${m.id}`} className="font-mono font-medium text-primary hover:underline">
                      {m.mrfNo}
                    </Link>
                  </TableCell>
                  <TableCell>{fmtDate(m.date)}</TableCell>
                  <TableCell>{m.site}</TableCell>
                  <TableCell>{m.department}</TableCell>
                  <TableCell><Badge className={priorityBadge(m.priority)}>{t(PRIO[m.priority])}</Badge></TableCell>
                  <TableCell>{fmtMoney(mrfTotal(m))}</TableCell>
                  <TableCell className="text-muted-foreground">{nxt ? ROLES[nxt.role] : '—'}</TableCell>
                  <TableCell><Badge className={STATUS_CLS[m.status]}>{t(STATUS[m.status])}</Badge></TableCell>
                </TableRow>
              )
            })}
            {db.mrfs.length === 0 && (
              <TableRow><TableCell colSpan={8} className="py-10 text-center text-muted-foreground">{t('p.empty')}</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
