'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

interface HealthChecks {
  supabase: boolean
  environment: boolean
  build: boolean
}

interface DevInfo {
  version: string
  branch: string
  environment: string
  lastBuild: string
  health: 'ok' | 'error'
  healthChecks: HealthChecks
}

export function DevInfo() {
  const [info, setInfo] = useState<DevInfo | null>(null)
  const pathname = usePathname()

  useEffect(() => {
    // Only fetch in development
    if (process.env.NODE_ENV === 'development') {
      fetch('/api/dev-info')
        .then(res => res.json())
        .then(data => setInfo(data))
        .catch(() => setInfo(null))
    }
  }, [pathname])

  // Only render in development
  if (process.env.NODE_ENV !== 'development' || !info) return null

  return (
    <div className="fixed bottom-4 left-4 z-50 bg-black/80 text-white p-2 rounded-lg text-xs font-mono">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-green-400">●</span>
          <span>v{info.version}</span>
        </div>
        <div className="text-gray-400">{info.branch}</div>
        <div className="text-gray-400">{info.environment}</div>
        <div className="text-gray-400">Build: {info.lastBuild}</div>
        
        {/* Critical Services Health */}
        <div className="flex items-center gap-2">
          <span className={info.health === 'ok' ? 'text-green-400' : 'text-red-400'}>●</span>
          <span>{info.health === 'ok' ? 'Services OK' : 'Service Issues'}</span>
        </div>

        {/* Detailed Status */}
        <div className="text-gray-400 mt-1 border-t border-gray-700 pt-1">
          {/* Critical Services */}
          <div className="flex items-center gap-2">
            <span className={info.healthChecks.supabase ? 'text-green-400' : 'text-red-400'}>●</span>
            <span>DB</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={info.healthChecks.environment ? 'text-green-400' : 'text-red-400'}>●</span>
            <span>ENV</span>
          </div>
          
          {/* Non-Critical Status */}
          <div className="flex items-center gap-2 text-gray-500">
            <span className={info.healthChecks.build ? 'text-green-400' : 'text-yellow-400'}>●</span>
            <span>Build</span>
          </div>
        </div>
      </div>
    </div>
  )
} 