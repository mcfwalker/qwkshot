'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'

export function HealthCheck() {
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true)
      toast.success('Connection restored')
    }

    function handleOffline() {
      setIsOnline(false)
      toast.error('Connection lost')
    }

    // Check connection status immediately
    if (!navigator.onLine) {
      handleOffline()
    }

    // Listen for connection changes
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Periodic health check
    const interval = setInterval(() => {
      fetch('/api/health')
        .catch(() => {
          if (isOnline) handleOffline()
        })
    }, 30000) // Check every 30 seconds

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearInterval(interval)
    }
  }, [isOnline])

  // Only render in development
  if (process.env.NODE_ENV !== 'development') return null

  return null // No visual component needed
} 