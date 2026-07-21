import { useRegisterSW } from 'virtual:pwa-register/react'
import './ReloadPrompt.css'

const CHECK_MS = 5 * 60 * 1000

export function ReloadPrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return
      // Periodically look for a new deploy while the app stays open
      window.setInterval(() => {
        void registration.update()
      }, CHECK_MS)
    },
  })

  if (!needRefresh) return null

  return (
    <div className="pwa-toast" role="status" aria-live="polite">
      <div className="pwa-toast-body">
        <p className="pwa-toast-title">Update available</p>
        <p className="pwa-toast-copy">A newer Thinker is ready. Refresh to stay current.</p>
      </div>
      <div className="pwa-toast-actions">
        <button type="button" className="pwa-toast-dismiss" onClick={() => setNeedRefresh(false)}>
          Later
        </button>
        <button
          type="button"
          className="pwa-toast-update"
          onClick={() => void updateServiceWorker(true)}
        >
          Update
        </button>
      </div>
    </div>
  )
}
