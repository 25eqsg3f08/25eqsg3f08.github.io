const CACHE_CONFIG = {
    CACHE_NAME: "root-nav-cache-v3",
    PRE_CACHE_ASSETS: [
        "/",
        "/index.html",
        "/jam.js",
        "/script.js",
        "/manifest.json",
        "https://25eqsg3f08-stack.github.io/favicon.ico"
    ],
    CACHEABLE_ORIGINS: [self.location.origin],
    API_CACHE_KEY: "repo-api-response" // 标记API请求的缓存键
};

// 安装：预缓存核心资源
self.addEventListener("install", (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_CONFIG.CACHE_NAME)
            .then(cache => cache.addAll(CACHE_CONFIG.PRE_CACHE_ASSETS))
            .catch(err => console.error("预缓存失败:", err))
    );
});

// 激活：清理旧缓存
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

// 拦截请求：自动缓存API响应，离线返回缓存
self.addEventListener("fetch", (event) => {
    const request = event.request;

    // 1. 处理GitHub API类请求（特征：包含github.com/repos/且是GET请求）
    if (request.method === "GET" && request.url.includes("github.com/repos/") && request.url.includes("/contents/")) {
        event.respondWith(
            caches.open(CACHE_CONFIG.CACHE_NAME).then(cache => {
                // 先请求网络，成功后缓存响应
                return fetch(request).then(netRes => {
                    // 仅缓存成功的响应
                    if (netRes.ok) {
                        cache.put(request, netRes.clone());
                    }
                    return netRes;
                }).catch(() => {
                    // 离线时返回缓存的API响应
                    return cache.match(request).then(cachedRes => {
                        // 无缓存时返回空数组，避免script.js抛错
                        if (!cachedRes) {
                            return new Response(JSON.stringify([]), {
                                headers: { "Content-Type": "application/json" }
                            });
                        }
                        return cachedRes;
                    });
                });
            })
        );
        return;
    }

    // 2. 处理其他同源资源的缓存逻辑
    if (!CACHE_CONFIG.CACHEABLE_ORIGINS.some(origin => request.url.startsWith(origin))) {
        return event.respondWith(fetch(request));
    }

    event.respondWith(
        caches.match(request)
            .then(cachedResponse => {
                if (cachedResponse) {
                    // 后台更新缓存
                    fetch(request).then(netRes => {
                        if (netRes.ok) {
                            caches.open(CACHE_CONFIG.CACHE_NAME)
                                .then(cache => cache.put(request, netRes.clone()));
                        }
                    }).catch(() => {});
                    return cachedResponse;
                }

                return fetch(request).then(netRes => {
                    const resClone = netRes.clone();
                    if (netRes.ok) {
                        caches.open(CACHE_CONFIG.CACHE_NAME)
                            .then(cache => cache.put(request, resClone));
                    }
                    return netRes;
                }).catch(() => {
                    if (request.mode === "navigate") {
                        return caches.match("/index.html");
                    }
                    throw new Error("离线无缓存资源");
                });
            })
    );
});