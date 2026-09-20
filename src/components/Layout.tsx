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
      {/* الشريط الجانبي */}
      <aside className="fixed inset-y-0 start-0 z-40 flex w-60 flex-col border-e bg-card print:hidden">
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

      {/* المحتوى */}
      <div className="ms-60 flex min-h-screen flex-col print:ms-0">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-card/80 px-6 py-3 backdrop-blur print:hidden">
          <div className="flex items-center gap-3">
            {!online && (
              <Badge variant="destructive" className="gap-1">
                <WifiOff className="size-3" /> {t('auth.offline')}
              </Badge>
            )}
            <span className="text-sm text-muted-foreground">{t('role.hint')}</span>
          </div>

          <div className="flex items-center gap-2">
            {/* الإشعارات */}
            <Popover open={notifOpen} onOpenChange={setNotifOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon" className="relative" onClick={openNotifications}>
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
                  {db.notifications.slice(0, 30).map((n) => (
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
              className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted"
            >
              <Languages className="size-4" />
              {t('lang.switch')}
            </button>

            {/* المستخدم الحالي */}
            {currentUser && (
              <div className="flex items-center gap-2 rounded-md border px-3 py-1.5">
                <div className="text-end leading-tight">
                  <div className="text-sm font-semibold">{currentUser.name}</div>
                  <div className="text-[11px] text-muted-foreground">{roleLabel(currentUser.role, lang)}</div>
                </div>
                <Button variant="ghost" size="icon" onClick={signOut} title={t('auth.logout')}>
                  <LogOut className="size-4 text-destructive" />
                </Button>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
