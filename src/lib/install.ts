/* التقاط حدث beforeinstallprompt لتقديم زر تثبيت داخل التطبيق */
let deferredPrompt: { prompt: () => void; userChoice: Promise<{ outcome: string }> } | null = null

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  deferredPrompt = e as unknown as typeof deferredPrompt
})

/** هل يمكن عرض نافذة التثبيت مباشرة؟ (كروم/إيدج/أندرويد) */
export function canInstall(): boolean {
  return deferredPrompt !== null
}

/** فتح نافذة التثبيت — تعيد true إذا قبل المستخدم */
export async function installApp(): Promise<boolean> {
  if (!deferredPrompt) return false
  deferredPrompt.prompt()
  const { outcome } = await deferredPrompt.userChoice
  if (outcome === 'accepted') deferredPrompt = null
  return outcome === 'accepted'
}

/** هل التطبيق مثبت حالياً كأيقونة؟ */
export function isInstalled(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  )
}
