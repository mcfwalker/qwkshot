'use client'

import { ThemeProvider } from "./theme-provider"
import { Toaster } from "sonner"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      {children}
      <Toaster 
        richColors
        position="top-center" 
        toastOptions={{
          classNames: {
            toast:
              'group toast !bg-[#1D1D1D] !border-[#1D1D1D] !text-white !shadow-lg !rounded-lg !h-16 !px-6 !flex !items-center !gap-4',
            description:
              'text-sm text-foreground/80',
            actionButton:
              'bg-primary text-primary-foreground',
            cancelButton:
              'bg-muted text-muted-foreground',
            icon:
              'w-5 h-5 flex-shrink-0',
            success:
              '[&_svg]:text-[#C2F751]! important',
            error:
              '[&_svg]:text-[#F76451]! important',
            warning:
              '[&_svg]:text-[#F7B751]! important',
            info:
              '[&_svg]:text-[#51C2F7]! important',
          },
        }} 
      />
    </ThemeProvider>
  )
} 