import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './index.css'
import App from './App.tsx'

/* تسجيل عامل الخدمة — يجعل التطبيق قابلاً للتثبيت كأيقونة (PWA)
   وعند تفعيل عامل خدمة جديد نعيد التحميل تلقائياً ليحصل المستخدم على آخر إصدار فوراً */
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  let refreshing = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return
    refreshing = true
    window.location.reload()
  })
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* التسجيل فشل — التطبيق يعمل طبيعياً بدونه */
    })
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
