import { NextResponse } from 'next/server'
import { execSync } from 'child_process'
import { readFileSync } from 'fs'
import { join } from 'path'
import { createRouteSupabaseClient } from '@/lib/supabase-route'

export async function GET() {
  try {
    // Get version from package.json
    const packageJson = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8'))
    const version = packageJson.version

    // Get current branch
    const branch = execSync('git branch --show-current').toString().trim()

    // Get environment
    const environment = process.env.NODE_ENV || 'development'

    // Get last build time (from .next/BUILD_ID)
    let lastBuild = 'unknown'
    try {
      const buildId = readFileSync(join(process.cwd(), '.next/BUILD_ID'), 'utf-8').trim()
      lastBuild = new Date(parseInt(buildId)).toLocaleTimeString()
    } catch (e) {
      // If BUILD_ID doesn't exist, use current time
      lastBuild = new Date().toLocaleTimeString()
    }

    // Check various health aspects
    const healthChecks = {
      supabase: false,
      environment: false,
      build: false
    }

    // Check Supabase connection
    try {
      const supabase = await createRouteSupabaseClient()
      const { data, error } = await supabase.from('models').select('count').limit(1)
      healthChecks.supabase = !error
    } catch (e) {
      healthChecks.supabase = false
    }

    // Check environment variables
    healthChecks.environment = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && 
                                 process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

    // Check if build is recent (within last 30 minutes in development)
    try {
      const buildId = readFileSync(join(process.cwd(), '.next/BUILD_ID'), 'utf-8').trim()
      const buildTime = parseInt(buildId)
      const thirtyMinutesAgo = Date.now() - (30 * 60 * 1000)
      healthChecks.build = buildTime > thirtyMinutesAgo
    } catch (e) {
      healthChecks.build = false
    }

    // Determine overall health (only consider critical services)
    const health = healthChecks.supabase && healthChecks.environment ? 'ok' : 'error'

    return NextResponse.json({
      version,
      branch,
      environment,
      lastBuild,
      health,
      healthChecks
    })
  } catch (error) {
    console.error('Error getting dev info:', error)
    return NextResponse.json({
      version: 'unknown',
      branch: 'unknown',
      environment: process.env.NODE_ENV || 'development',
      lastBuild: new Date().toLocaleTimeString(),
      health: 'error',
      healthChecks: {
        supabase: false,
        environment: false,
        build: false
      }
    })
  }
} 