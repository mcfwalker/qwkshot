'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'

// Separate the main content into its own component
function SignInContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const redirectTo = searchParams.get('redirectTo') || '/viewer'

  // Listen for auth state changes
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        toast.success('Signed in successfully')
        router.push(redirectTo)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [redirectTo, router])

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isLoading) return

    try {
      setIsLoading(true)
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error
    } catch (error) {
      console.error('Sign in error:', error)
      toast.error('Failed to sign in. Please check your credentials.')
      setIsLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    if (isLoading) return

    try {
      setIsLoading(true)
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?redirectTo=${redirectTo}`,
        },
      })

      if (error) throw error
    } catch (error) {
      console.error('Google sign in error:', error)
      toast.error('Failed to sign in with Google')
      setIsLoading(false)
    }
  }

  return (
    // This div centers the form card vertically within the first column
    <div className="flex h-full w-full flex-col items-center justify-center py-6 md:py-10">
      {/* Form Card: Semi-transparent with backdrop blur, now 50% width of its parent column */}
      <div className="w-[50%] space-y-6 rounded-xl bg-black/60 p-8 shadow-2xl backdrop-blur-lg">
        <div className="space-y-4 text-center">
          <img
            src="/images/logo_pink.png"
            alt="Awk Shot Logo"
            className="mx-auto"
            style={{ width: '296px', height: 'auto' }}
          />
        </div>

        <form onSubmit={handleEmailSignIn} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-gray-200">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="m@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="rounded-md border-gray-500 bg-white/10 text-white placeholder-[rgba(254,227,229,0.64)] focus:border-[#FEE3E5] focus:ring-[#FEE3E5]/50"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-gray-200">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="rounded-md border-gray-500 bg-white/10 text-white placeholder-[rgba(254,227,229,0.64)] focus:border-[#FEE3E5] focus:ring-[#FEE3E5]/50"
            />
          </div>
          <Button 
            className="w-full bg-[#FEE3E5] text-black hover:bg-[#FEE3E5]/90 focus-visible:ring-[#FEE3E5] mt-6"
            type="submit" 
            disabled={isLoading}
          >
            {isLoading ? 'Signing in...' : 'Sign in with Email'}
          </Button>
        </form>

        {/* Hide "Or continue with" separator for now
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <Separator className="w-full border-gray-600" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-black/60 px-2 text-gray-300">
              Or continue with
            </span>
          </div>
        </div>
        */}

        {/* Hide Google Sign-In button for now
        <Button
          variant="outline"
          type="button"
          className="w-full rounded-md border-gray-500 bg-transparent text-gray-200 hover:bg-white/10 hover:text-white focus-visible:ring-[#FEE3E5]/70"
          disabled={isLoading}
          onClick={handleGoogleSignIn}
        >
          {isLoading ? 'Signing in...' : 'Sign in with Google'}
        </Button>
        */}
      </div>
    </div>
  )
}

// Main component with Suspense boundary
export default function SignInPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-black text-white">Loading...</div>}>
      <div className="flex min-h-screen w-full">
        {/* Column 1: Login Form with SVG background */}
        <div className="relative w-full overflow-hidden bg-black lg:w-1/3">
          <img
            src="/images/vert_logo.svg"
            alt="Background Design"
            className="absolute inset-0 h-full w-full object-contain object-center opacity-100"
          />
          {/* Container for SignInContent to be above SVG and allow for centering */}
          <div className="relative z-10 flex h-full items-center justify-center">
            <SignInContent />
          </div>
        </div>

        {/* Column 2: Background Video (takes up remaining 2/3 on large screens) */}
        <div className="relative hidden flex-1 overflow-hidden lg:block">
          <video
            autoPlay
            loop
            muted
            playsInline
            className="absolute left-0 top-0 h-full w-full object-cover"
          >
            <source src="/videos/Ricky-Bobby-Take3-202505221246.webm" type="video/webm" />
            Your browser does not support the video tag.
          </video>
        </div>
      </div>
    </Suspense>
  )
} 