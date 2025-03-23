'use client'

import { ThemeProvider } from "@/components/theme-provider"
import { AuthProvider } from '@/lib/auth-context'
import { Toaster } from "sonner"

export function Providers({ children }: { children: React.ReactNode }) {
  console.log('Providers component rendering')
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      <AuthProvider>
        {children}
        <Toaster richColors position="top-right" />
      </AuthProvider>
    </ThemeProvider>
  )
} 