const CACHE_NAME = "study-game-v1"

const FILES_TO_CACHE = [
  "index.html",
  "style.css",
  "script.js",
  "manifest.json",
  "icon.png",
  "sounds/interface.mp3",
  "sounds/lvlup.mp3",
  "sounds/taskComplete.mp3",
  "sounds/progressBar.mp3",
  "sounds/error.mp3",
  "sounds/acceptBoss.mp3"
]

self.addEventListener("install", event => {
  console.log("[ServiceWorker] Install")
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log("[ServiceWorker] Caching app files")
        return cache.addAll(FILES_TO_CACHE)
      })
      .then(() => {
        console.log("[ServiceWorker] Skip waiting on install")
        return self.skipWaiting()
      })
  )
})


self.addEventListener("activate", event => {
  console.log("[ServiceWorker] Activate")
  
  event.waitUntil(
    caches.keys().then(keyList => {
      return Promise.all(keyList.map(key => {
        if (key !== CACHE_NAME) {
          console.log("[ServiceWorker] Removing old cache", key)
          return caches.delete(key)
        }
      }))
    })
  )
  
  
  return self.clients.claim()
})


self.addEventListener("fetch", event => {

  if (event.request.url.includes('localhost') || event.request.mode === 'navigate') {
   
    event.respondWith(
      caches.match('index.html').then(response => {
        return response || fetch(event.request)
      })
    )
  } else {
   
    event.respondWith(
      caches.match(event.request).then(response => {
        return response || fetch(event.request).catch(() => {
          
          if (event.request.url.match(/\.(jpg|jpeg|png|gif|mp3|wav)$/)) {
            return new Response('', { status: 404 })
          }
        })
      })
    )
  }
})