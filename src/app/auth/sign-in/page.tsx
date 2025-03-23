'use client'

import { createClient } from '@supabase/supabase-js'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

// Direct client initialization without custom options
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

export default function SignIn() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Log for debug
      console.log('Signing in with:', { email })
      
      // Direct API call
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        console.error('Sign-in error:', error)
        setError(error.message)
        toast.error(error.message)
      } else if (data.user) {
        console.log('Sign-in successful')
        toast.success('Signed in successfully')
        router.push('/library')
      }
    } catch (err) {
      console.error('Unexpected error:', err)
      setError('An unexpected error occurred')
      toast.error('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center py-2 bg-background">
      <div className="w-full max-w-md space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-foreground">
            Sign in to your account
          </h2>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Or create a new account if you don't have one
          </p>
        </div>
        
        {/* Custom sign-in form */}
        <form onSubmit={handleSignIn} className="mt-8 space-y-6">
          <div className="space-y-4 rounded-md shadow-sm">
            <div>
              <label htmlFor="email" className="sr-only">Email address</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="relative block w-full rounded-md border-0 py-2 px-3 bg-transparent border-gray-700 ring-1 ring-inset ring-gray-700 focus:ring-2 focus:ring-inset focus:ring-blue-600 transition-all text-white"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="relative block w-full rounded-md border-0 py-2 px-3 bg-transparent border-gray-700 ring-1 ring-inset ring-gray-700 focus:ring-2 focus:ring-inset focus:ring-blue-600 transition-all text-white"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="text-red-500 text-sm text-center">{error}</div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 transition-all"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>
        </form>
        
        <div className="text-center">
          <a href="#" className="text-sm text-gray-400 hover:text-gray-300 transition-all">
            Forgot your password?
          </a>
        </div>
        
        <div className="text-center">
          <a href="#" className="text-sm text-gray-400 hover:text-gray-300 transition-all">
            Don't have an account? Sign up
          </a>
        </div>

        <div className="text-center text-xs text-gray-500 mt-8">
          API URL: {process.env.NEXT_PUBLIC_SUPABASE_URL}
          <br />
          API Key: {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.substring(0, 10)}...
        </div>
      </div>
    </div>
  )
} 