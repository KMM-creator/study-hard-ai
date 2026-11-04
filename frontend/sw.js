self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  // Пока просто пропускаем все запросы (без офлайн-кэша, чтобы не усложнять)
});