import { useEffect, useMemo } from 'react'
import { useParams, Link } from 'react-router'
import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useStore, nextApproval, mrfTotal, ROLES_EN } from '@/lib/db'
import { useLang } from '@/lib/i18n'
import { fmtDate, fmtDateTime, fmtMoneyEn } from '@/lib/format'
import { QUOTATION_THRESHOLD } from '@/types'

/** صفحة طباعة نموذج MRF بنفس تنسيق الورقة الأصلية — جاهزة للحفظ PDF */
export default function MrfPrintPage() {
  const { id } = useParams()
  const { db, ready } = useStore()
  const { t, lang } = useLang()

  const mrf = db.mrfs.find((m) => m.id === id)

  useEffect(() => {
    if (!ready || !mrf) return
    const timer = setTimeout(() => window.print(), 600)
    return () => clearTimeout(timer)
  }, [ready, mrf])

  const rows = useMemo(() => mrf?.items ?? [], [mrf])

  if (ready && !mrf) {
    return (
      <div className="p-10 text-center">
        <p>{t('d.notFound')}</p>
        <Link to="/purchases"><Button variant="outline">{t('d.back')}</Button></Link>
      </div>
    )
  }
  if (!mrf) return null

  const isAr = lang === 'ar'

  return (
    <div className="print-page mx-auto max-w-[210mm] bg-white p-4 text-black">
      {/* شريط أدوات — لا يُطبع */}
      <div className="mb-4 flex items-center justify-between rounded border bg-muted/40 p-2 print:hidden">
        <p className="text-sm text-muted-foreground">{t('pr.approveHint')}</p>
        <div className="flex gap-2">
          <Link to={`/purchases/${mrf.id}`}><Button variant="outline" size="sm">{t('common.back')}</Button></Link>
          <Button size="sm" onClick={() => window.print()}>
            <Printer className="me-2 size-4" /> {t('pr.print')}
          </Button>
        </div>
      </div>

      {/* الترويسة: الشعاران + العنوان */}
      <div className="flex items-start justify-between border-b-2 border-black pb-2">
        <div className="text-center">
          <img src="/logos/dammam-airports.png" alt="Dammam Airports" className="mx-auto h-10 w-auto object-contain" />
          <div className="text-[10px] font-bold">{isAr ? 'مطارات الدمام' : 'DAMMAM AIRPORTS'}</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-black tracking-wide">{t('pr.mrfTitle')}</div>
          <div className="text-sm font-bold">{t('pr.mrfTitleAr')}</div>
          <div className="mt-1 text-xs font-semibold">{t('app.footer')}</div>
        </div>
        <div className="text-center">
          <img src="/logos/al-majal.png" alt="MAG — Al Majal Al Arabi" className="mx-auto h-10 w-auto object-contain" />
          <div className="text-[10px] font-bold">{isAr ? 'المجال العربي' : 'AL MAJAL AL ARABI'}</div>
        </div>
      </div>

      {/* بيانات النموذج */}
      <div className="mt-3 grid grid-cols-2 gap-x-8 gap-y-1 text-[12px]">
        <div className="flex gap-2"><span className="font-bold">SITE / الموقع:</span><span>{mrf.site}</span></div>
        <div className="flex gap-2"><span className="font-bold">REQUESTED BY / مقدم الطلب:</span><span>{mrf.requestedBy}</span></div>
        <div className="flex gap-2"><span className="font-bold">DEPARTMENT / القسم:</span><span>{mrf.department}</span></div>
        <div className="flex gap-2"><span className="font-bold">EMPLOYEE / رقم الموظف:</span><span>{mrf.employeeNo || '—'}</span></div>
        <div className="flex gap-2"><span className="font-bold">FACILITY / المنشأة:</span><span>{mrf.facility}</span></div>
        <div className="flex gap-2"><span className="font-bold">DATE / التاريخ:</span><span>{fmtDate(mrf.date)}</span></div>
        <div className="flex gap-2"><span className="font-bold">REQUIRED DATE / التاريخ المطلوب:</span><span>{fmtDate(mrf.requiredDate)}</span></div>
        <div className="flex gap-2"><span className="font-bold">MRF NO / رقم الطلب:</span><span className="font-bold">{mrf.mrfNo}</span></div>
      </div>

      {/* الأولوية */}
      <div className="mt-2 flex items-center gap-6 text-[12px] font-bold">
        <span className="flex items-center gap-1">
          <span className={`inline-block h-3 w-4 border-2 border-black ${mrf.priority === 'normal' ? 'bg-black' : ''}`} /> NORMAL / عادي
        </span>
        <span className="flex items-center gap-1">
          <span className={`inline-block h-3 w-4 border-2 border-black ${mrf.priority === 'urgent' ? 'bg-black' : ''}`} /> URGENT / عاجل
        </span>
        <span className="flex items-center gap-1">
          <span className={`inline-block h-3 w-4 border-2 border-black ${mrf.priority === 'top' ? 'bg-red-600' : ''}`} /> TOP URGENT / عاجل جداً
        </span>
        <span className="ms-auto text-[11px] font-normal">
          {t('d.estTotal')} {fmtMoneyEn(mrfTotal(mrf))}
        </span>
      </div>

      {/* جدول البنود */}
      <table className="mt-2 w-full border-collapse text-[11px]">
        <thead>
          <tr className="bg-gray-200">
            {['S/N', 'PART NO', 'DESCRIPTION', 'QTY', 'UOM', 'ON HAND', 'EST. PRICE', 'REMARKS'].map((h) => (
              <th key={h} className="border border-black px-1 py-1 text-center font-bold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((i, idx) => (
            <tr key={i.id}>
              <td className="border border-black px-1 py-1 text-center">{idx + 1}</td>
              <td className="break-all border border-black px-1 py-1 text-center font-mono">{i.partNo}</td>
              <td className="break-words border border-black px-1 py-1">{i.description}</td>
              <td className="border border-black px-1 py-1 text-center">{i.qty}</td>
              <td className="border border-black px-1 py-1 text-center">{i.uom}</td>
              <td className="border border-black px-1 py-1 text-center">{i.onHand}</td>
              <td className={`border border-black px-1 py-1 text-center ${(i.estimatedPrice ?? 0) > QUOTATION_THRESHOLD ? 'font-bold text-red-700' : ''}`}>
                {i.estimatedPrice != null ? fmtMoneyEn(i.estimatedPrice) : ''}
              </td>
              <td className="break-words border border-black px-1 py-1">{i.remarks ?? ''}</td>
            </tr>
          ))}
          {(() => {
            const totalRows = Math.max(10, rows.length + 2)
            return rows.length < totalRows &&
              Array.from({ length: totalRows - rows.length }).map((_, k) => (
                <tr key={`blank-${k}`}>
                  {Array.from({ length: 8 }).map((_, c) => (
                    <td key={c} className="border border-black px-1 py-1">&nbsp;</td>
                  ))}
                </tr>
              ))
          })()}
        </tbody>
      </table>

      {/* ملاحظات عامة وأمر العمل */}
      <div className="mt-1 grid grid-cols-2 gap-x-8 text-[11px]">
        <div className="flex gap-2 border border-black px-2 py-1">
          <span className="font-bold">REMARKS / ملاحظات:</span>
          <span className="break-words">{mrf.remarks ?? ''}</span>
        </div>
        <div className="flex gap-2 border border-black px-2 py-1">
          <span className="font-bold">WORK ORDER / أمر العمل:</span>
          <span className="break-words">{mrf.workOrder ?? ''}</span>
        </div>
      </div>

      {/* عرض السعر إن وجد */}
      {mrf.quotation && (
        <div className="mt-1 border border-black px-2 py-1 text-[11px]">
          <span className="font-bold">QUOTATION / عرض السعر:</span> {mrf.quotation.name}
        </div>
      )}

      {/* خانات التوقيعات الأربع/خمس */}
      <div className="mt-6 grid grid-cols-2 gap-6 text-center text-[11px]">
        {mrf.approvals.map((a) => {
          const nxt = nextApproval(mrf)
          return (
            <div key={a.role} className="border-2 border-black p-3">
              <div className="font-black">{ROLES_EN[a.role]}</div>
              <div className="text-[9px] font-semibold">APPROVED / اعتماد</div>
              <div className="mx-auto mt-4 h-12 border-b border-black" />
              <div className="mt-1 text-[10px]">
                {a.status === 'approved' && (
                  <span className="font-bold text-green-700">
                    <span className="text-[8px]">✓</span> {t('pr.approved')} — {a.by} — {fmtDateTime(a.at)}
                  </span>
                )}
                {a.status === 'rejected' && (
                  <span className="font-bold text-red-700">
                    <span className="text-[8px]">✗</span> {t('pr.rejected')} — {a.by} — {a.note ?? ''}
                  </span>
                )}
                {a.status === 'pending' && (
                  <span className={nxt?.role === a.role ? 'font-bold text-amber-600' : 'text-gray-500'}>
                    {nxt?.role === a.role ? t('d.waitingSign') : t('pr.pending')}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* تذييل */}
      <div className="mt-4 flex justify-between text-[9px] text-gray-600">
        <span>{t('app.footer')}</span>
        <span>{mrf.mrfNo} — {fmtDateTime(new Date().toISOString())}</span>
      </div>
    </div>
  )
}
