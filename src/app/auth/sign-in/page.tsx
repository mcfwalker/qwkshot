'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

// Separate the main content into its own component
function SignInContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isMagicLinkLoading, setIsMagicLinkLoading] = useState(false)
  const redirectTo = searchParams.get('redirectTo') || '/viewer'

  // Listen for auth state changes
  useEffect(() => {
    console.log('Setting up onAuthStateChange listener...');
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('onAuthStateChange event:', event, session);
      if (event === 'SIGNED_IN' && session) {
        toast.success('Signed in successfully');
        console.log('Redirecting to:', redirectTo);
        router.push(redirectTo);
      } else if (event === 'TOKEN_REFRESHED') {
        console.log('Token refreshed, session:', session);
      } else if (event === 'SIGNED_OUT') {
        console.log('User signed out');
      }
    });

    // Check if the session is already available from the URL hash when the component mounts
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        console.log('Session found on mount (from URL hash processing by Supabase client):', session);
      } else {
        console.log('No session found on mount from URL hash.');
      }
    });

    return () => {
      console.log('Unsubscribing from onAuthStateChange listener.');
      subscription.unsubscribe();
    };
  }, [redirectTo, router]);

  const handleMagicLinkSignIn = async () => {
    if (!email) {
      toast.error('Please enter your email address to receive a magic link.');
      return;
    }
    if (isMagicLinkLoading || isLoading) return;

    try {
      setIsMagicLinkLoading(true);
      const { error } = await supabase.auth.signInWithOtp({
        email: email,
        options: {
          emailRedirectTo: `https://www.qwkshot.com/auth/sign-in?redirectTo=${encodeURIComponent(redirectTo)}`,
        },
      });

      if (error) throw error;
      toast.success('Check your email for the magic link!');
    } catch (error) {
      console.error('Magic link sign in error:', error);
      toast.error('Failed to send magic link. Please try again.');
    } finally {
      setIsMagicLinkLoading(false);
    }
  };

  return (
    <div className="flex h-full w-full items-start justify-start">
      <div className="w-full max-w-xs space-y-6 sm:max-w-sm"> 
        <div className="space-y-4 text-left mb-10">
          <Link href="/" className="block">
            <div className="use-mamoth-font text-[2rem] leading-[2.5rem] sm:text-[2.5rem] sm:leading-[3rem] md:text-[3rem] md:leading-[3.5rem] text-[#FDE1E4] text-left">
              QWK SHOT
            </div>
          </Link>
        </div>

        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleMagicLinkSignIn(); }}>
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
              className="h-16 rounded-md border-[#383838] bg-black text-white placeholder-[rgba(254,227,229,0.64)] focus:border-[#FEE3E5] focus:ring-[#FEE3E5]/50"
          />
        </div>
          
          <Button
            onClick={handleMagicLinkSignIn}
            disabled={isMagicLinkLoading || isLoading || !email}
            className="w-full h-14 px-6 flex items-center justify-center gap-[10px] rounded-md border border-[#121212] bg-[#FEE3E5] text-black hover:bg-[#FEE3E5]/90 focus-visible:ring-[#FEE3E5] disabled:opacity-100" 
          >
            {isMagicLinkLoading ? 'Sending link...' : 'Sign in with Magic Link'}
        </Button>
      </form>
      </div>
    </div>
  )
}

// Main component with Suspense boundary
export default function SignInPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-black text-white">Loading...</div>}>
      <div className="flex min-h-screen w-full">
        {/* Column 1: Login Form with Graphic as column background, offset to extend below bottom (30%), sized to 75% height */}
        <div className="relative flex w-full flex-col overflow-hidden bg-black bg-[url('/images/side_bar_graphic.svg')] bg-no-repeat bg-[length:auto_75%] bg-[center_130%] lg:w-1/3">
          {/* Top Container: Form Area - 50% height, padding, aligns SignInContent to the top. */}
          <div className="relative z-10 flex h-1/2 items-start p-6 sm:p-8 lg:p-12">
      <SignInContent />
          </div>
          {/* Bottom Container: This area is now part of the column background. */}
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