'use client'

import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'

export function BackToLibrary() {
  const router = useRouter()
  
  return (
    <Button variant="secondary" onClick={() => router.push('/library')}>
      <ArrowLeft className="mr-2 h-4 w-4" />
      Back to Library
    </Button>
  )
} 