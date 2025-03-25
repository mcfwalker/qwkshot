import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase-server'

export default async function HomePage() {
  const supabase = await createServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  
  if (session) {
    redirect('/viewer')
  } else {
    redirect('/auth/sign-in')
  }
}
