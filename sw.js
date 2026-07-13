const CACHE = 'nexus-v1';
const STATIC_ASSETS = [
  'home.html', 'store.html', 'wallet.html', 'profile.html', 'index.html',
  'css/home.css', 'css/store.css', 'css/wallet.css', 'css/profile.css', 'css/index.css', 'css/light-mode.css', 'css/navigation.css',
  'js/home.js', 'js/store.js', 'js/wallet.js', 'js/profile.js', 'js/index.js', 'js/i18n.js', 'js/firebase-config.js',
  'components/menubar.html', 'components/navigation.html', 'components/notification.html',
  'components/header/header_home.html', 'components/header/header_store.html', 'components/header/header_wallet.html', 'components/header/header_profile.html', 'components/header/header_menubar.html'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      for (const url of STATIC_ASSETS) {
        try {
          const req = new Request(url, { cache: 'no-cache' });
          const res = await fetch(req);
          if (res.ok) cache.put(req, res);
        } catch (_) {}
      }
    })
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    })
  );
});

self.addEventListener('fetch', (e) => {
  const url = e.request.url;

  // Never cache Firebase
  if (url.includes('firebaseio.com') || url.includes('googleapis.com') || url.includes('firestore.googleapis.com')) {
    return;
  }

  // Third-party libs - cache with stale-while-revalidate
  if (url.includes('fonts.googleapis.com') || url.includes('fontawesome') || url.includes('cdn.tailwindcss.com') || url.includes('gstatic.com')) {
    e.respondWith(
      caches.match(e.request).then((cached) => {
        const fetchP = fetch(e.request).then((res) => {
          if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
          return res;
        }).catch(() => cached);
        return cached || fetchP;
      })
    );
    return;
  }

  // JS / CSS - cache first, update background
  if (url.match(/\.(js|css)$/)) {
    e.respondWith(
      caches.match(e.request).then((cached) => {
        const fetchP = fetch(e.request).then((res) => {
          if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
          return res;
        }).catch(() => cached);
        return cached || fetchP;
      })
    );
    return;
  }

  // HTML pages & components - stale-while-revalidate
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const fetchP = fetch(e.request).then((res) => {
        if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        return res;
      }).catch(() => cached);
      return cached || fetchP;
    })
  );
});
