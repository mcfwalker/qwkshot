'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Images, User, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { getSupabaseClient } from '@/lib/supabase'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu'

export function Navigation() {
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

  return (
    <nav className="sticky top-0 z-[999] w-full h-14 bg-transparent">
      <div className="flex h-full items-center justify-between px-4">
        <Link href="/viewer" className="flex items-center gap-2 group">
          <div className="h-[40px] w-auto rounded-[6px] bg-[#1e1e1e] flex items-center justify-center p-2 group-hover:opacity-90 transition-opacity">
            <img 
              src="/images/logo.svg" 
              alt="Qwk Shot Logo" 
              className="h-6 w-auto filter brightness-[.886]"
            />
          </div>
        </Link>
        <div className="flex items-center space-x-4">
          {/* Library Button - Icon Only */}
          <Button 
            variant="primary" 
            size="default" 
            onClick={() => router.push('/library')}
            className="font-normal"
          >
            <Images className="h-6 w-6" />
          </Button>
          
          {/* User Dropdown Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="flex items-center justify-center w-[92px] h-[40px] py-2 px-4 gap-6 shrink-0 rounded-md bg-[#2E2E2E] hover:bg-[#343434]">
                <User className="h-6 w-6 text-[#E2E2E5]" />
                <ChevronDown className="h-4 w-4 text-[#E2E2E5]" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent 
              className="w-48 bg-[#1E1E1E] border-[#1E1E1E] text-[#E2E2E5] flex flex-col items-start gap-4 p-2" 
              sideOffset={8}
              align="end"
            >
              <DropdownMenuItem 
                onSelect={() => router.push('/account')}
                className="focus:bg-[#343434] focus:text-white cursor-pointer w-full justify-start"
              >
                <span>Manage Account</span>
              </DropdownMenuItem>
              <DropdownMenuItem 
                onSelect={handleSignOut} 
                className="focus:bg-[#343434] focus:text-white cursor-pointer w-full justify-start"
              >
                <span>Sign Out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

        </div>
      </div>
    </nav>
  )
} 