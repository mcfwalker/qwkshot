import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { createRouteSupabaseClient } from '@/lib/supabase-route'

export async function POST(request: Request) {
  try {
    // Get the path to revalidate from the query string
    const { searchParams } = new URL(request.url)
    const path = searchParams.get('path')

    if (!path) {
      return NextResponse.json(
        { message: 'Path parameter is required' },
        { status: 400 }
      )
    }

    // Verify authentication
    const supabase = await createRouteSupabaseClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Revalidate the path
    revalidatePath(path)

    return NextResponse.json({
      revalidated: true,
      now: Date.now(),
      path
    })
  } catch (error) {
    console.error('Revalidation error:', error)
    return NextResponse.json(
      { message: 'Error revalidating' },
      { status: 500 }
    )
  }
} 