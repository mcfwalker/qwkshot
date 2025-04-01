'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ViewIcon, FolderOpen, LogOut, Home, Settings } from 'lucide-react'
import { toast } from 'sonner'
import { getSupabaseClient } from '@/lib/supabase'

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
    <nav className="sticky top-0 z-50 w-full bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center px-4">
        <div className="mr-4 flex">
          <Button 
            variant="ghost" 
            size="sm"
            className="font-bold"
            onClick={() => handleNavigation('/viewer')}
          >
            <Home className="mr-2 h-4 w-4" />
            MiniMav
          </Button>
        </div>
        <div className="flex flex-1 items-center justify-end space-x-2">
          <Button 
            variant={pathname.startsWith('/library') ? "default" : "ghost"} 
            size="sm"
            className="mr-2"
            onClick={() => handleNavigation('/library')}
          >
            <FolderOpen className="mr-2 h-4 w-4" />
            Library
          </Button>
          <Button 
            variant={pathname.startsWith('/admin') ? "default" : "ghost"} 
            size="sm"
            className="mr-2"
            onClick={handleAdminNavigation}
          >
            <Settings className="mr-2 h-4 w-4" />
            Admin
          </Button>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={handleSignOut}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </div>
    </nav>
  )
} 