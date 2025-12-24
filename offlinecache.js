// 缓存名称和版本
const CACHE_NAME = 'macau-photos-v1';
// 核心静态资源（页面、脚本、地图等）
const CORE_ASSETS = [
    '/',
    '/index.html',
    '/js/main.js',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

// 安装：缓存核心静态资源
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(CORE_ASSETS))
            .then(() => self.skipWaiting())
    );
});

// 激活：清理旧缓存
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.filter(name => name !== CACHE_NAME)
                    .map(name => caches.delete(name))
            );
        }).then(() => self.clients.claim())
    );
});

// 拦截请求：缓存照片并优先从缓存读取
self.addEventListener('fetch', (event) => {
    // 只缓存照片（jpg/png/jpeg）和核心资源
    if (event.request.url.match(/\.(jpg|png|jpeg)$/i) || CORE_ASSETS.includes(new URL(event.request.url).pathname)) {
        event.respondWith(
            caches.open(CACHE_NAME).then(cache => {
                return cache.match(event.request).then(response => {
                    // 同时发起网络请求更新缓存，实现缓存刷新
                    const fetchPromise = fetch(event.request).then(networkResponse => {
                        cache.put(event.request, networkResponse.clone());
                        return networkResponse;
                    }).catch(() => response); // 网络失败则用缓存
                    return response || fetchPromise;
                });
            })
        );
    }
});

// 接收消息：预缓存动态获取的照片列表
self.addEventListener('message', (event) => {
    if (event.data.type === 'PRECACHE_PHOTOS') {
        const photoUrls = event.data.photoUrls;
        if (photoUrls && photoUrls.length > 0) {
            caches.open(CACHE_NAME).then(cache => {
                cache.addAll(photoUrls); // 预缓存所有照片
                console.log('照片已加入离线缓存');
            });
        }
    }
});