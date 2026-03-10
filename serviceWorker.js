const CACHE_NAME = "study-game-v1"

const FILES_TO_CACHE = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./manifest.json",
  "./icon.png",
  "./sounds/interface.mp3",
  "./sounds/lvlup.mp3",
  "./sounds/taskComplete.mp3",
  "./sounds/progressBar.mp3",
  "./sounds/error.mp3",
  "./sounds/acceptBoss.mp3"
]

// INSTALL
self.addEventListener("install", event => {

  self.skipWaiting()

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(FILES_TO_CACHE))
  )

})

// ACTIVATE
self.addEventListener("activate", event => {

  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key)
          }
        })
      )
    }).then(() => self.clients.claim())
  )

})

// FETCH
self.addEventListener("fetch", event => {

  event.respondWith(

    caches.match(event.request).then(cached => {

      if (cached) {
        return cached
      }

      return fetch(event.request).catch(() => {

        if (event.request.mode === "navigate") {
          return caches.match("./index.html")
        }

      })

    })

  )

})
