/**
 * Service Worker для ARC
 * Обеспечивает офлайн-работу и кеширование ресурсов
 */

const CACHE_VERSION = 'arc-v1.0.0';
const CACHE_NAME_STATIC = `${CACHE_VERSION}-static`;
const CACHE_NAME_DYNAMIC = `${CACHE_VERSION}-dynamic`;

// Список статичных ресурсов для кеширования при установке
const STATIC_RESOURCES = [
  '/',
  '/index.html',
  '/manifest.json',
  // CSS и шрифты будут добавлены автоматически при сборке
];

/**
 * Событие установки Service Worker
 * Кеширует статичные ресурсы
 */
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker...', event);
  
  event.waitUntil(
    caches.open(CACHE_NAME_STATIC)
      .then((cache) => {
        console.log('[SW] Precaching static resources');
        return cache.addAll(STATIC_RESOURCES);
      })
      .then(() => {
        // Активируем новый Service Worker сразу
        return self.skipWaiting();
      })
  );
});

/**
 * Событие активации Service Worker
 * Очищает старые кеши
 */
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker...', event);
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // Удаляем старые версии кеша
            if (cacheName !== CACHE_NAME_STATIC && cacheName !== CACHE_NAME_DYNAMIC) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        // Берем управление всеми страницами
        return self.clients.claim();
      })
  );
});

/**
 * Событие fetch - перехват сетевых запросов
 * Стратегия: Cache First для статики, Network First для данных
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Пропускаем запросы к chrome-extension и другим протоколам
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Пропускаем File System Access API запросы
  if (url.pathname.includes('blob:') || url.pathname.includes('filesystem:')) {
    return;
  }

  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        // Если ресурс в кеше - возвращаем его
        if (cachedResponse) {
          return cachedResponse;
        }

        // Иначе делаем сетевой запрос
        return fetch(request)
          .then((response) => {
            // Проверяем валидность ответа
            if (!response || response.status !== 200 || response.type === 'error') {
              return response;
            }

            // Клонируем ответ (т.к. response можно использовать только один раз)
            const responseToCache = response.clone();

            // Кешируем динамические ресурсы
            caches.open(CACHE_NAME_DYNAMIC)
              .then((cache) => {
                cache.put(request, responseToCache);
              });

            return response;
          })
          .catch((error) => {
            console.log('[SW] Fetch failed:', error);
            
            // Можно вернуть офлайн-страницу или fallback
            // Пока просто пробрасываем ошибку
            throw error;
          });
      })
  );
});

/**
 * Событие message - обработка сообщений от клиента
 */
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);

  // Команда обновления Service Worker
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  // Команда очистки кеша
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys()
        .then((cacheNames) => {
          return Promise.all(
            cacheNames.map((cacheName) => caches.delete(cacheName))
          );
        })
        .then(() => {
          // Отправляем сообщение обратно клиенту
          event.ports[0].postMessage({ success: true });
        })
    );
  }
});

