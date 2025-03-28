import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  // Check if essential environment variables are defined
  const envCheck = {
    supabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    openAiKey: !!process.env.OPENAI_API_KEY,
    geminiKey: !!process.env.GEMINI_API_KEY
  }

  // Simple health check response
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    envVarsPresent: envCheck
  })
} 