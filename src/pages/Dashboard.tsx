import { Link } from 'react-router'
import { ArrowDownToLine, ArrowUpFromLine, Boxes, ShoppingCart, AlertTriangle, CheckCircle2, Clock, Banknote, SprayCan, PackageOpen } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PRIORITIES, nextApproval, roleLabel, useStore } from '@/lib/db'
import { useLang } from '@/lib/i18n'
import { fmtDateTime, fmtMoney } from '@/lib/format'

const SHEET_ORDER = ['SEPT', 'OCT', 'NOVE', 'DEC', 'JAN-2026', 'FEB-2026', 'MARCH-2026', 'APRIL-2026', 'MAY-2026', 'JUN-2026', 'JULY-2026', 'Aug-2026', 'SEP-2026']

export default function Dashboard() {
  const { db, stock, currentUser } = useStore()
  const { t, lang } = useLang()
  const isSupervisor = currentUser?.role === 'siteSupervisor'

  const lowStock = db.items.filter((i) => stock(i.id) <= i.minStock)
  const pendingForMe = db.mrfs.filter((m) => m.status === 'pending' && nextApproval(m)?.role === currentUser?.role)
  const pendingAll = db.mrfs.filter((m) => m.status === 'pending')
  // مجموع مصروفات الشهر الحالي — نفس رقم إجمالي الشيت في ملف الإكسل
  const currentMonth = SHEET_ORDER.filter((m) => db.pettyCash.some((p) => p.month === m)).at(-1) ?? ''
  const pettyTotal = db.pettyCash.filter((p) => p.month === currentMonth).reduce((s, p) => s + (p.total ?? 0), 0)
  const myIssuances = currentUser ? db.issuances.filter((i) => i.status === 'pending' && i.receiverId === currentUser.id) : []

  const stats = [
    { label: t('dash.items'), value: db.items.length, icon: Boxes, to: '/items' },
    { label: t('dash.inbound'), value: db.movements.filter((m) => m.type === 'in').length, icon: ArrowDownToLine, to: '/inbound' },
    { label: t('dash.outbound'), value: db.movements.filter((m) => m.type === 'out').length, icon: ArrowUpFromLine, to: '/outbound' },
    { label: t('dash.purchases'), value: db.mrfs.length, icon: ShoppingCart, to: '/purchases' },
  ]

  const stats2 = [
    { label: `${t('dash.pettyMonth')}${currentMonth ? ` (${currentMonth})` : ''}`, value: fmtMoney(pettyTotal), icon: Banknote, to: '/petty-cash' },
    { label: t('dash.janitorial'), value: db.janitorial.length, icon: SprayCan, to: '/janitorial' },
    { label: t('dash.consumables'), value: db.consumables.length, icon: PackageOpen, to: '/consumables' },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('dash.title')}</h1>

      {!isSupervisor && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map(({ label, value, icon: Icon, to }) => (
              <Link key={label} to={to}>
                <Card className="transition-shadow hover:shadow-md">
                  <CardContent className="flex items-center gap-4 p-5">
                    <div className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="size-5" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{value}</div>
                      <div className="text-sm text-muted-foreground">{label}</div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {stats2.map(({ label, value, icon: Icon, to }) => (
              <Link key={label} to={to}>
                <Card className="transition-shadow hover:shadow-md">
                  <CardContent className="flex items-center gap-4 p-5">
                    <div className="flex size-11 items-center justify-center rounded-lg bg-green-600/10 text-green-700">
                      <Icon className="size-5" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{value}</div>
                      <div className="text-sm text-muted-foreground">{label}</div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </>
      )}

      {myIssuances.length > 0 && (
        <Card className="border-sky-300 bg-sky-50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg text-sky-800">
              <PackageOpen className="size-5" />
              {t('is.pendingForMe')} ({myIssuances.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {myIssuances.map((iss) => (
                <li key={iss.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                    <Badge variant="outline">−{iss.qty} {iss.uom}</Badge>
                    <span className="min-w-0 break-words">{iss.itemDescription}</span>
                    <span className="text-muted-foreground">{iss.department} — {t('by.label')}: {iss.createdBy}</span>
                  </div>
                  <Link to="/outbound" className="text-sm font-medium text-primary hover:underline">
                    {t('is.receive')}
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {pendingForMe.length > 0 && (
        <Card className="border-amber-300 bg-amber-50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg text-amber-800">
              <Clock className="size-5" />
              {t('dash.yourTurn')} ({currentUser ? roleLabel(currentUser.role, lang) : '—'}) — {pendingForMe.length} {t('dash.requests')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {pendingForMe.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                    <Badge variant="outline">{m.mrfNo}</Badge>
                    <span className="min-w-0 break-words">{m.department} — {m.facility}</span>
                    <Badge className={m.priority === 'top' ? 'bg-red-600' : m.priority === 'urgent' ? 'bg-orange-500' : 'bg-slate-500'}>
                      {PRIORITIES[m.priority]}
                    </Badge>
                  </div>
                  <Link to={`/purchases/${m.id}`} className="text-sm font-medium text-primary hover:underline">
                    {t('dash.showSign')}
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {!isSupervisor && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <AlertTriangle className="size-5 text-amber-500" />
                {t('dash.lowStock')} ({lowStock.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {lowStock.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('dash.lowStockOk')}</p>
              ) : (
                <ul className="divide-y text-sm">
                  {lowStock.map((i) => (
                    <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <span className="min-w-0 break-words">{i.description} <span className="text-muted-foreground">({i.partNo})</span></span>
                      <Badge variant="destructive">
                        {t('dash.available')} {stock(i.id)} / {t('dash.minStock')} {i.minStock}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <CheckCircle2 className="size-5 text-primary" />
              {t('dash.pendingCircuit')} ({pendingAll.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y text-sm">
              {pendingAll.slice(0, 6).map((m) => {
                const nxt = nextApproval(m)
                return (
                  <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                      <Badge variant="outline">{m.mrfNo}</Badge>
                      <span className="text-muted-foreground">{fmtDateTime(m.createdAt)}</span>
                    </div>
                    <span className="text-muted-foreground">{t('dash.waitingFor')}: {nxt ? roleLabel(nxt.role, lang) : '—'}</span>
                  </li>
                )
              })}
              {pendingAll.length === 0 && <li className="py-2 text-muted-foreground">{t('dash.noPending')}</li>}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
