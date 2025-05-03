import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase-route'
import { headers } from 'next/headers'

// Handle CORS preflight requests
export async function OPTIONS() {
  const headersList = await headers()
  const origin = headersList.get('origin') || ''

  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400'
    }
  })
}

export async function POST(request: Request) {
  const headersList = await headers()
  const origin = headersList.get('origin') || ''

  try {
    // Get the path to revalidate from the query string
    const { searchParams } = new URL(request.url)
    const path = searchParams.get('path')

    if (!path) {
      return NextResponse.json(
        { message: 'Path parameter is required' },
        { 
          status: 400,
          headers: {
            'Access-Control-Allow-Origin': origin,
            'Access-Control-Allow-Credentials': 'true'
          }
        }
      )
    }

    // Verify authentication
    const supabase = await getSupabaseClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { 
          status: 401,
          headers: {
            'Access-Control-Allow-Origin': origin,
            'Access-Control-Allow-Credentials': 'true'
          }
        }
      )
    }

    // Revalidate the path
    revalidatePath(path)

    return NextResponse.json(
      {
        revalidated: true,
        now: Date.now(),
        path
      },
      {
        headers: {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Credentials': 'true'
        }
      }
    )
  } catch (error) {
    return NextResponse.json(
      { 
        message: 'Error revalidating',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { 
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Credentials': 'true'
        }
      }
    )
  }
} 