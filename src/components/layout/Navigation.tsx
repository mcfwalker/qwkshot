'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ViewIcon, FolderOpen, LogOut } from 'lucide-react'
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

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="mr-4 flex">
          <Link href="/" className="flex items-center space-x-2">
            <span className="font-bold">3D Viewer</span>
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
          <div className="flex items-center">
            <Link href="/viewer">
              <Button 
                variant={pathname === '/viewer' ? "default" : "ghost"} 
                size="sm" 
                className="mr-2"
              >
                <ViewIcon className="mr-2 h-4 w-4" />
                Scene
              </Button>
            </Link>
            <Link href="/library">
              <Button 
                variant={pathname.startsWith('/library') ? "default" : "ghost"} 
                size="sm"
                className="mr-2"
              >
                <FolderOpen className="mr-2 h-4 w-4" />
                Library
              </Button>
            </Link>
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