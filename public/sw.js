/* عامل خدمة تطبيق مستودع القيصومة — PWA
   HTML والأصول المُجزّأة (JS/CSS): الشبكة أولاً مع كاش احتياطي — لا شاشات بيضاء بعد النشر
   البيانات الحية (/api, /ws): تُتجاوز دائماً حتى لا تُحفظ بيانات قديمة */
const CACHE = 'wms-qaisumah-v3'
const PRECACHE = ['/', '/index.html', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  /* حذف كل الكاشات القديمة من الإصدارات السابقة */
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  const { request } = e
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== location.origin) return
  /* البيانات الحية والتصدير و WebSocket: الشبكة مباشرة */
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/ws')) return

  /* طلبات التنقل (HTML): الشبكة أولاً، وعند انقطاع الاتصال نعرض نسخة الكاش */
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put('/index.html', copy))
          return res
        })
        .catch(() => caches.match('/index.html')),
    )
    return
  }

  /* أصول البناء المُجزّأة (JS/CSS): الشبكة أولاً — تُحدَّث تلقائياً مع كل نشر
     والكاش احتياطي فقط عند انقطاع الاتصال (يمنع الشاشة البيضاء) */
  if (url.pathname.startsWith('/assets/')) {
    e.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(request, copy))
          }
          return res
        })
        .catch(() => caches.match(request)),
    )
    return
  }

  /* باقي الأصول الثابتة (الأيقونات): كاش أولاً ثم الشبكة */
  e.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ||
        fetch(request).then((res) => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(request, copy))
          }
          return res
        }),
    ),
  )
})
