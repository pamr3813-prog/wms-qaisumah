import { Routes, Route, Navigate } from 'react-router'
import type { ReactNode } from 'react'
import { Toaster } from '@/components/ui/sonner'
import Layout from '@/components/Layout'
import Dashboard from '@/pages/Dashboard'
import ItemsPage from '@/pages/ItemsPage'
import MovementsPage from '@/pages/MovementsPage'
import InventoryPage from '@/pages/InventoryPage'
import PurchasesPage from '@/pages/PurchasesPage'
import MrfNewPage from '@/pages/MrfNewPage'
import MrfDetailPage from '@/pages/MrfDetailPage'
import MrfPrintPage from '@/pages/MrfPrintPage'
import PettyCashPage from '@/pages/PettyCashPage'
import StockModulePage from '@/pages/StockModulePage'
import LoginPage from '@/pages/LoginPage'
import AdminPage from '@/pages/AdminPage'
import { StoreProvider, useStore } from '@/lib/db'
import { LanguageProvider } from '@/lib/i18n'

function RequireAuth({ children, admin }: { children: ReactNode; admin?: boolean }) {
  const { currentUser, ready } = useStore()
  if (!ready) return null
  if (!currentUser) return <Navigate to="/login" replace />
  if (admin && currentUser.role !== 'admin') return <Navigate to="/" replace />
  return <>{children}</>
}

/** المشرفون لا يرون إلا طلبات المواد والموافقات — أي مسار آخر يعيدهم للوحة التحكم */
function NotForSupervisor({ children }: { children: ReactNode }) {
  const { currentUser, ready } = useStore()
  if (!ready) return null
  if (currentUser?.role === 'siteSupervisor') return <Navigate to="/" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <LanguageProvider>
      <StoreProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/print/mrf/:id" element={<MrfPrintPage />} />
          <Route
            element={
              <RequireAuth>
                <Layout />
              </RequireAuth>
            }
          >
            <Route path="/" element={<Dashboard />} />
            <Route path="/items" element={<NotForSupervisor><ItemsPage /></NotForSupervisor>} />
            <Route path="/inbound" element={<NotForSupervisor><MovementsPage type="in" /></NotForSupervisor>} />
            <Route path="/outbound" element={<NotForSupervisor><MovementsPage type="out" /></NotForSupervisor>} />
            <Route path="/inventory" element={<NotForSupervisor><InventoryPage /></NotForSupervisor>} />
            <Route path="/purchases" element={<PurchasesPage />} />
            <Route path="/purchases/new" element={<MrfNewPage />} />
            <Route path="/purchases/:id" element={<MrfDetailPage />} />
            <Route path="/petty-cash" element={<NotForSupervisor><PettyCashPage /></NotForSupervisor>} />
            <Route path="/janitorial" element={<NotForSupervisor><StockModulePage kind="janitorial" /></NotForSupervisor>} />
            <Route path="/consumables" element={<NotForSupervisor><StockModulePage kind="consumable" /></NotForSupervisor>} />
            <Route
              path="/admin"
              element={
                <RequireAuth admin>
                  <AdminPage />
                </RequireAuth>
              }
            />
          </Route>
        </Routes>
        <Toaster position="top-left" richColors />
      </StoreProvider>
    </LanguageProvider>
  )
}
