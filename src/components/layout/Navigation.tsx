'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ViewIcon, FolderOpen, LogOut, Home, Settings } from 'lucide-react'
import { toast } from 'sonner'
import { getSupabaseClient } from '@/lib/supabase'
import { cn } from "@/lib/utils"

export function Navigation() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = getSupabaseClient()

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut()
      toast.success('Signed out successfully')
      router.push('/auth/sign-in')
    } catch (error) {
      console.error('Error signing out:', error)
      toast.error('Failed to sign out')
    }
  }

  const handleNavigation = (path: string) => {
    try {
      router.push(path)
    } catch (error) {
      console.error('Navigation error:', error)
      toast.error('Failed to navigate. Please try again.')
    }
  }

  const handleAdminNavigation = () => {
    // Open admin in same window to maintain session state
    router.push('/admin')
  }

  return (
    <nav className="sticky top-0 z-50 w-full h-14 bg-[#121212]">
      <div className="flex h-full items-center justify-between px-4">
        <Link href="/viewer" className="flex items-center gap-2 group">
          <img 
            src="/images/logo.svg" 
            alt="Qwk Shot Logo" 
            className="h-5 w-auto group-hover:opacity-90 transition-opacity"
          />
        </Link>
        <div className="flex items-center space-x-4">
          <Link href="/library" className={cn(
              "text-sm font-normal transition-colors",
              pathname.startsWith('/library') ? "text-white" : "text-[#CFD0D0] hover:text-white"
          )}>
            Library
          </Link>
          <button 
            onClick={handleSignOut}
            className="text-sm font-normal text-[#CFD0D0] hover:text-white transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    </nav>
  )
} 