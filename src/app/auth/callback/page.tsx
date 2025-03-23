'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthCallback() {
  const router = useRouter()

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Auth callback error:', error)
          router.push('/auth/sign-in')
          return
        }

        if (session) {
          router.push('/library')
        } else {
          router.push('/auth/sign-in')
        }
      } catch (error) {
        console.error('Auth callback error:', error)
        router.push('/auth/sign-in')
      }
    }

    handleAuthCallback()
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h2 className="text-lg font-semibold">Authenticating...</h2>
        <p className="text-sm text-muted-foreground">Please wait while we complete the authentication process.</p>
      </div>
    </div>
  )
} 