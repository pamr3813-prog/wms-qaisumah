import { NavLink, Outlet, useNavigate } from 'react-router'
import {
  LayoutDashboard,
  Boxes,
  ArrowDownToLine,
  ArrowUpFromLine,
  Scale,
  ShoppingCart,
  FilePlus2,
  Banknote,
  SprayCan,
  PackageOpen,
  Languages,
  LogOut,
  Bell,
  Users,
  WifiOff,
  Menu,
  X,
  ArrowRight,
} from 'lucide-react'
import { useState } from 'react'
import { roleLabel, useStore } from '@/lib/db'
import { useLang } from '@/lib/i18n'
import { fmtDateTime } from '@/lib/format'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

const NAV = [
  { to: '/', key: 'nav.dashboard', icon: LayoutDashboard },
  { to: '/items', key: 'nav.items', icon: Boxes },
  { to: '/inbound', key: 'nav.inbound', icon: ArrowDownToLine },
  { to: '/outbound', key: 'nav.outbound', icon: ArrowUpFromLine },
  { to: '/inventory', key: 'nav.inventory', icon: Scale },
  { to: '/purchases', key: 'nav.purchases', icon: ShoppingCart },
  { to: '/purchases/new', key: 'nav.purchasesNew', icon: FilePlus2 },
  { to: '/petty-cash', key: 'nav.petty', icon: Banknote },
  { to: '/janitorial', key: 'nav.janitorial', icon: SprayCan },
  { to: '/consumables', key: 'nav.consumables', icon: PackageOpen },
] as const

/** المشرفون يرون طلبات المواد والموافقات فقط — إخفاء جداول المستودع والشيتات عنهم */
const SUPERVISOR_HIDDEN = ['/items', '/inbound', '/outbound', '/inventory', '/petty-cash', '/janitorial', '/consumables']

export default function Layout() {
  const { t, lang, setLang } = useLang()
  const { currentUser, logout, online, myUnread, db, send } = useStore()
  const navigate = useNavigate()
  const [notifOpen, setNotifOpen] = useState(false)
  const [navOpen, setNavOpen] = useState(false)

  const isAdmin = currentUser?.role === 'admin'
  const isSupervisor = currentUser?.role === 'siteSupervisor'
  const navItems = isSupervisor ? NAV.filter((n) => !SUPERVISOR_HIDDEN.includes(n.to)) : NAV

  function signOut() {
    logout()
    navigate('/login', { replace: true })
  }

  async function openNotifications() {
    setNotifOpen(true)
    if (myUnread > 0 && currentUser) {
      try {
        await send('markNotificationRead', {})
      } catch {
        /* تجاهل */
      }
    }
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* الشريط الجانبي — ثابت على الشاشات الكبيرة، درج منزلق على الجوال */}
      <aside
        className={`fixed inset-y-0 start-0 z-50 flex w-64 flex-col border-e bg-card transition-transform duration-200 print:hidden md:z-40 md:w-60 md:translate-x-0 ${
          navOpen ? 'translate-x-0' : 'ltr:-translate-x-full rtl:translate-x-full'
        }`}
      >
        <button
          onClick={() => setNavOpen(false)}
          className="absolute end-2 top-2 rounded-md p-1 text-muted-foreground hover:bg-muted md:hidden"
          aria-label="close"
        >
          <X className="size-4" />
        </button>
        <div className="border-b px-4 py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <img src="/logos/qaisumah-airport.png" alt="Qaisumah Airport" className="size-9 object-contain" />
              <div>
                <div className="text-xs font-bold leading-tight">{lang === 'ar' ? 'مطار القيصومة' : 'Qaisumah Airport'}</div>
                <div className="text-[10px] font-semibold text-muted-foreground">{t('app.title')}</div>
              </div>
            </div>
            <div className="text-center">
              <img src="/logos/al-majal.png" alt="MAG — Al Majal Al Arabi" className="mx-auto h-7 w-auto object-contain" />
              <div className="text-[10px] font-semibold text-muted-foreground">
                {lang === 'ar' ? 'المجال العربي' : 'Al Majal Al Arabi'}
              </div>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {navItems.map(({ to, key, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={() => setNavOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`
              }
            >
              <Icon className="size-4 shrink-0" />
              {t(key)}
            </NavLink>
          ))}
          {isAdmin && (
            <NavLink
              to="/admin"
              onClick={() => setNavOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`
              }
            >
              <Users className="size-4 shrink-0" />
              {t('ad.title')}
            </NavLink>
          )}
        </nav>

        <div className="border-t p-3 text-xs text-muted-foreground">{t('app.footer')}</div>
      </aside>

      {/* خلفية معتمة تغلق الدرج عند اللمس على الجوال */}
      {navOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => setNavOpen(false)} />
      )}

      {/* المحتوى */}
      <div className="flex min-h-screen flex-col ms-0 md:ms-60 print:ms-0">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-card/80 px-3 py-2.5 backdrop-blur md:px-6 md:py-3 print:hidden">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" className="md:hidden" onClick={() => setNavOpen(true)} aria-label="menu">
              <Menu className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate(-1)}
              aria-label={t('common.back')}
              title={t('common.back')}
            >
              <ArrowRight className="size-4 rtl:rotate-180" />
            </Button>
            {!online && (
              <Badge variant="destructive" className="gap-1">
                <WifiOff className="size-3" /> {t('auth.offline')}
              </Badge>
            )}
            <span className="hidden text-sm text-muted-foreground md:inline">{t('role.hint')}</span>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {/* الإشعارات */}
            <Popover open={notifOpen} onOpenChange={setNotifOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon" className="relative shrink-0" onClick={openNotifications}>
                  <Bell className="size-4" />
                  {myUnread > 0 && (
                    <span className="absolute -top-1 -end-1 flex size-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white">
                      {myUnread > 9 ? '9+' : myUnread}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 p-0">
                <div className="border-b px-4 py-2 text-sm font-bold">{t('nt.title')}</div>
                <div className="max-h-80 overflow-y-auto">
                  {db.notifications.length === 0 && (
                    <p className="p-4 text-sm text-muted-foreground">{t('nt.empty')}</p>
                  )}
                  {db.notifications
                    .filter((n) => !n.role || n.role === currentUser?.role)
                    .slice(0, 30)
                    .map((n) => (
                    <div key={n.id} className="border-b px-4 py-2 text-sm last:border-0">
                      <p>{n.text}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{fmtDateTime(n.at)}</p>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            {/* اللغة */}
            <button
              onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
              className="flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted"
            >
              <Languages className="size-4" />
              <span className="hidden sm:inline">{t('lang.switch')}</span>
            </button>

            {/* المستخدم الحالي — الاسم يظهر على الشاشات الأكبر، وزر الخروج دائماً ظاهر */}
            {currentUser && (
              <div className="hidden items-center gap-2 rounded-md border px-3 sm:flex">
                <div className="min-w-0 text-end leading-tight">
                  <div className="max-w-56 truncate text-sm font-semibold">{currentUser.name}</div>
                  <div className="truncate text-[11px] text-muted-foreground">{roleLabel(currentUser.role, lang)}</div>
                </div>
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={signOut}
              title={t('auth.logout')}
              aria-label={t('auth.logout')}
              className="shrink-0"
            >
              <LogOut className="size-4 text-destructive" />
            </Button>
          </div>
        </header>

        <main className="flex-1 p-3 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
