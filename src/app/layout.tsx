import { Inter_Tight } from 'next/font/google';
import "./globals.css";
import { Providers } from "@/components/providers";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { DevInfo } from "@/components/dev/DevInfo/index";
import { initializeLLMSystem, ensureLLMSystemInitialized } from '@/lib/llm/init';

// Configure Inter Tight
const interTight = Inter_Tight({
  subsets: ['latin'],
  variable: '--font-inter-tight',
});

// Initialize the LLM system
// We use ensureLLMSystemInitialized instead of initializeLLMSystem to make sure we only initialize once
// but also ensure it's initialized when needed
ensureLLMSystemInitialized().catch(error => {
  console.error('Failed to initialize LLM system:', error);
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning className={`${interTight.variable} font-sans`}>
      <body suppressHydrationWarning>
        <ErrorBoundary>
          <Providers>
            <main className="min-h-screen">
              {children}
            </main>
            {/* <DevInfo /> */}
          </Providers>
        </ErrorBoundary>
      </body>
    </html>
  );
}
