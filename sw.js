const CACHE_CONFIG = {
  CACHE_NAME: "root-nav-cache-v2",
  // 打包后需确保所有资源路径正确，若本地打包则替换为相对路径
  PRE_CACHE_ASSETS: [
    "/",
    "/index.html",
    "/jam.js",
    "/script.js",
    "/manifest.json",
    "https://25eqsg3f08-stack.github.io/favicon.ico"
  ],
  // 缓存所有同源子项目页面，支持离线访问已打开的子项目
  CACHEABLE_ORIGINS: [self.location.origin]
};

// 安装：预缓存核心资源，跳过等待立即激活
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_CONFIG.CACHE_NAME)
      .then(cache => cache.addAll(CACHE_CONFIG.PRE_CACHE_ASSETS))
      .catch(err => console.error("预缓存失败:", err))
  );
});

// 激活：清理旧缓存，接管所有客户端
self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.filter(name => name !== CACHE_CONFIG.CACHE_NAME)
            .map(name => caches.delete(name))
        );
      }),
      self.clients.claim()
    ])
  );
});

// 拦截请求：缓存优先，支持子项目离线访问
self.addEventListener("fetch", (event) => {
  // 跳过非同源资源（如第三方CDN）
  if (!CACHE_CONFIG.CACHEABLE_ORIGINS.some(origin => event.request.url.startsWith(origin))) {
    return event.respondWith(fetch(event.request));
  }

  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // 缓存存在则返回，后台更新
        if (cachedResponse) {
          fetch(event.request).then(netRes => {
            caches.open(CACHE_CONFIG.CACHE_NAME)
              .then(cache => cache.put(event.request, netRes.clone()));
          }).catch(() => {});
          return cachedResponse;
        }

        // 无缓存时请求网络，成功后存入缓存
        return fetch(event.request).then(netRes => {
          const resClone = netRes.clone();
          caches.open(CACHE_CONFIG.CACHE_NAME)
            .then(cache => cache.put(event.request, resClone));
          return netRes;
        }).catch(() => {
          // 完全断网且无缓存时，返回导航页兜底
          if (event.request.mode === "navigate") {
            return caches.match("/index.html");
          }
          throw new Error("离线无缓存资源");
        });
      })
  );
});