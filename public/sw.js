// Service worker for the conductor dashboard. Android Chrome can only show
// notifications through a service worker, so fare alerts go through here.

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

// Tapping a fare notification brings the dashboard back to the front.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const dashboard = clients.find((c) => c.url.includes('/dashboard/'))
      if (dashboard) return dashboard.focus()
      return self.clients.openWindow(event.notification.data?.url ?? '/login')
    })
  )
})
