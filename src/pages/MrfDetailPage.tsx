import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowRight, CheckCircle2, CircleDashed, XCircle, FileText, Stamp, Printer, MessageSquare } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { nextApproval, mrfTotal, roleLabel, useStore } from '@/lib/db'
import { useLang } from '@/lib/i18n'
import { fmtDate, fmtDateTime, fmtMoney } from '@/lib/format'
import { QUOTATION_THRESHOLD } from '@/types'
import { priorityBadge } from '@/pages/PurchasesPage'

export default function MrfDetailPage() {
  const { id } = useParams()
  const { db, currentUser, send } = useStore()
  const { t, lang } = useLang()
  const [note, setNote] = useState('')
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)

  const mrf = db.mrfs.find((m) => m.id === id)
  if (!mrf) {
    return (
      <div className="space-y-4">
        <p>{t('d.notFound')}</p>
        <Link to="/purchases"><Button variant="outline">{t('d.back')}</Button></Link>
      </div>
    )
  }

  const nxt = nextApproval(mrf)
  const myTurn = !!currentUser && nxt?.role === currentUser.role
  const needQt = mrf.items.some((i) => (i.estimatedPrice ?? 0) > QUOTATION_THRESHOLD)
  const over = mrf.items.filter((i) => (i.estimatedPrice ?? 0) > QUOTATION_THRESHOLD)
  const comments = db.comments.filter((c) => c.mrfId === mrf.id)

  function decide(approve: boolean) {
    if (!myTurn || !nxt || !mrf || !currentUser || busy) return
    if (!approve && !note.trim()) {
      toast.error(t('rj.err'))
      return
    }
    setBusy(true)
    void send('decideApproval', { mrfId: mrf.id, approve, note: note.trim() || undefined })
      .then(() => {
        toast.success(approve ? `${t('d.approvedToast')} ${roleLabel(currentUser.role, lang)}` : t('d.rejectedToast'))
        setNote('')
      })
      .catch(() => {
        /* رسالة الخطأ تظهر تلقائياً */
      })
      .finally(() => setBusy(false))
  }

  function addComment() {
    if (!mrf || !comment.trim() || busy) return
    setBusy(true)
    void send('addComment', { mrfId: mrf.id, text: comment.trim() })
      .then(() => setComment(''))
      .catch(() => {
        /* رسالة الخطأ تظهر تلقائياً */
      })
      .finally(() => setBusy(false))
  }

  const statusBadge =
    mrf.status === 'approved' ? t('p.statusApproved') : mrf.status === 'rejected' ? t('p.statusRejected') : t('p.statusPending')
  const statusCls =
    mrf.status === 'approved' ? 'bg-green-600' : mrf.status === 'rejected' ? 'bg-red-600' : 'bg-amber-500'
  const hdr = 'border px-2 py-1.5'

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/purchases"><Button variant="ghost" size="icon"><ArrowRight className="size-4 rtl:rotate-180" /></Button></Link>
          <h1 className="text-2xl font-bold">{mrf.mrfNo}</h1>
          <Badge className={priorityBadge(mrf.priority)}>
            {t(mrf.priority === 'normal' ? 'p.priorityNormal' : mrf.priority === 'urgent' ? 'p.priorityUrgent' : 'p.priorityTop')}
          </Badge>
          <Badge className={statusCls}>{statusBadge}</Badge>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm text-muted-foreground">
            {t('d.estTotal')} <span className="font-bold text-foreground">{fmtMoney(mrfTotal(mrf))}</span>
          </div>
          <Link to={`/print/mrf/${mrf.id}`} target="_blank">
            <Button variant="outline" size="sm">
              <Printer className="me-2 size-4" /> {t('pr.print')}
            </Button>
          </Link>
        </div>
      </div>

      {/* بيانات النموذج */}
      <Card>
        <CardContent className="grid gap-3 pt-6 text-sm sm:grid-cols-4">
          <Field label={t('f.site')} value={mrf.site} />
          <Field label={t('p.department')} value={mrf.department} />
          <Field label={t('f.facility')} value={mrf.facility} />
          <Field label={t('f.requiredDate')} value={fmtDate(mrf.requiredDate)} />
          <Field label={t('f.requestedBy')} value={mrf.requestedBy} />
          <Field label={t('f.employeeNo')} value={mrf.employeeNo} />
          <Field label={t('common.date')} value={fmtDate(mrf.date)} />
          <Field label={t('f.workOrder')} value={mrf.workOrder} />
        </CardContent>
      </Card>

      {/* البنود */}
      <Card>
        <CardHeader className="pb-2"><CardTitle>{t('d.items')}</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full border text-sm">
            <thead>
              <tr className="bg-muted text-start">
                <th className={`${hdr} w-10`}>{t('common.sn')}</th>
                <th className={hdr}>{t('items.partNo')}</th>
                <th className={hdr}>{t('items.description')}</th>
                <th className={hdr}>{t('common.qty')}</th>
                <th className={hdr}>{t('items.uom')}</th>
                <th className={hdr}>{t('common.available')}</th>
                <th className={hdr}>{t('d.unitPrice')}</th>
                <th className={hdr}>{t('d.lineTotal')}</th>
                <th className={hdr}>{t('common.notes')}</th>
              </tr>
            </thead>
            <tbody>
              {mrf.items.map((i, idx) => {
                const isOver = (i.estimatedPrice ?? 0) > QUOTATION_THRESHOLD
                return (
                  <tr key={i.id}>
                    <td className="border px-2 py-1 text-center text-muted-foreground">{idx + 1}</td>
                    <td className="border px-2 py-1 font-mono">{i.partNo}</td>
                    <td className="border px-2 py-1">{i.description}</td>
                    <td className="border px-2 py-1 text-center">{i.qty}</td>
                    <td className="border px-2 py-1 text-center">{i.uom}</td>
                    <td className="border px-2 py-1 text-center">{i.onHand}</td>
                    <td className={`border px-2 py-1 text-center ${isOver ? 'font-bold text-red-700' : ''}`}>
                      {fmtMoney(i.estimatedPrice)}
                    </td>
                    <td className="border px-2 py-1 text-center">{fmtMoney((i.estimatedPrice ?? 0) * i.qty)}</td>
                    <td className="border px-2 py-1">{i.remarks ?? '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {needQt && (
            <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
              <FileText className="mt-0.5 size-4 shrink-0 text-amber-600" />
              <div>
                <p className="font-semibold text-amber-800">
                  {t('d.lineExceeds')} {over.length} {over.length === 1 ? t('d.lineExceeds1') : t('d.linesExceed')} {QUOTATION_THRESHOLD} {t('d.quotationWarn')}
                </p>
                {mrf.quotation ? (
                  <p className="mt-1">
                    {t('d.quotationFile')}{' '}
                    {mrf.quotation.dataUrl ? (
                      <a href={mrf.quotation.dataUrl} download={mrf.quotation.name} className="font-medium text-primary hover:underline">
                        {mrf.quotation.name}
                      </a>
                    ) : (
                      <span className="font-medium">{mrf.quotation.name}</span>
                    )}
                  </p>
                ) : (
                  <p className="mt-1 font-bold text-red-700">{t('d.noQuotation')}</p>
                )}
              </div>
            </div>
          )}
          {mrf.remarks && <p className="mt-3 text-sm text-muted-foreground">{t('d.generalRemarks')} {mrf.remarks}</p>}
        </CardContent>
      </Card>

      {/* سلسلة الموافقات — توقيعات الورقة */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Stamp className="size-4" />
            {t('d.chain')}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {mrf.approvals.map((a, idx) => (
            <div
              key={a.role}
              className={`relative rounded-lg border-2 p-4 text-center ${
                a.status === 'approved'
                  ? 'border-green-500 bg-green-50'
                  : a.status === 'rejected'
                    ? 'border-red-500 bg-red-50'
                    : nxt?.role === a.role
                      ? 'border-amber-400 bg-amber-50'
                      : 'border-dashed border-muted-foreground/40'
              }`}
            >
              <div className="text-sm font-bold">{roleLabel(a.role, lang)}</div>
              <div className="text-xs text-muted-foreground">{t('d.step')} {idx + 1} {t('d.inChain')}</div>

              {a.role === 'projectManagement' && (
                <Badge className="mt-1 bg-purple-600">{t('d.extra')} {QUOTATION_THRESHOLD} {lang === 'ar' ? 'ر.س' : 'SAR'}</Badge>
              )}

              <div className="mt-3 flex min-h-14 items-center justify-center">
                {a.status === 'approved' && (
                  <div className="stamp-approved">
                    <CheckCircle2 className="size-4" />
                    <div>
                      <div className="font-bold">{t('d.approved')}</div>
                      <div className="text-xs font-normal">{a.by} — {fmtDateTime(a.at)}</div>
                    </div>
                  </div>
                )}
                {a.status === 'rejected' && (
                  <div className="stamp-rejected">
                    <XCircle className="size-4" />
                    <div>
                      <div className="font-bold">{t('d.rejected')}</div>
                      <div className="text-xs font-normal">{a.by} — {fmtDateTime(a.at)}</div>
                    </div>
                  </div>
                )}
                {a.status === 'pending' && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <CircleDashed className="size-4" />
                    <span className="text-sm">{nxt?.role === a.role ? t('d.waitingSign') : t('d.notYet')}</span>
                  </div>
                )}
              </div>
              {a.note && <p className="mt-1 text-xs text-muted-foreground">«{a.note}»</p>}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* أدوات التوقيع */}
      {mrf.status === 'pending' && (
        <Card className={myTurn ? 'border-primary' : ''}>
          <CardContent className="space-y-3 pt-6">
            {myTurn ? (
              <>
                <p className="font-semibold text-primary">
                  {t('d.yourTurn')} ({currentUser ? roleLabel(currentUser.role, lang) : ''}) {t('d.signNow')}
                </p>
                <Textarea
                  placeholder={t('d.signNote')}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button size="sm" className="bg-green-600 hover:bg-green-700" disabled={busy} onClick={() => decide(true)}>
                    <CheckCircle2 className="me-2 size-4" /> {t('d.sign')}
                  </Button>
                  <Button size="sm" variant="destructive" disabled={busy} onClick={() => decide(false)}>
                    <XCircle className="me-2 size-4" /> {t('d.reject')}
                  </Button>
                </div>
                {!note.trim() && (
                  <p className="text-xs text-muted-foreground">{t('rj.hint')}</p>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t('d.waiting')} <span className="font-semibold text-foreground">{nxt ? roleLabel(nxt.role, lang) : '—'}</span>
                {t('d.switchHint')}
              </p>
            )}
          </CardContent>
        </Card>
      )}
      {/* التعليقات والملاحظات */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="size-5" />
            {t('cm.title')} ({comments.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {comments.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('cm.empty')}</p>
          ) : (
            <ul className="divide-y text-sm">
              {comments.map((c) => (
                <li key={c.id} className="py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{c.author}</span>
                    <Badge variant="outline">{roleLabel(c.role, lang)}</Badge>
                    <span className="text-xs text-muted-foreground">{fmtDateTime(c.at)}</span>
                  </div>
                  <p className="mt-1">{c.text}</p>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <Textarea
              placeholder={t('cm.placeholder')}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="min-h-10 flex-1"
            />
            <Button disabled={!comment.trim() || busy} onClick={addComment}>
              {t('cm.send')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value || '—'}</div>
    </div>
  )
}
