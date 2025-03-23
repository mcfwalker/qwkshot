'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ViewIcon, FolderOpen, LogOut, Home } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export function Navigation() {
  const pathname = usePathname()
  const router = useRouter()

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

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="mr-4 flex">
          <Button 
            variant="ghost" 
            size="sm"
            className="font-bold"
            onClick={() => handleNavigation('/')}
          >
            <Home className="mr-2 h-4 w-4" />
            3D Viewer
          </Button>
        </div>
        <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
          <div className="flex items-center">
            <Button 
              variant={pathname === '/viewer' ? "default" : "ghost"} 
              size="sm" 
              className="mr-2"
              onClick={() => handleNavigation('/viewer')}
            >
              <ViewIcon className="mr-2 h-4 w-4" />
              Scene
            </Button>
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
              variant="ghost" 
              size="sm"
              onClick={handleSignOut}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    </nav>
  )
} 