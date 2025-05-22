import { Inter_Tight } from 'next/font/google';
import "./globals.css";
import { Providers } from "@/components/providers";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { DevInfo } from "@/components/dev/DevInfo/index";
import { initializeLLMSystem, ensureLLMSystemInitialized } from '@/lib/llm/init';
import type { Metadata } from 'next';

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

export const metadata: Metadata = {
  title: 'Modern 3D Viewer', // You might want to customize this
  description: 'An LLM-powered 3D model viewer and cameraman.', // Customize this too
  icons: {
    icon: '/images/favicon.svg',
  },
  openGraph: {
    title: 'Modern 3D Viewer', // Customize
    description: 'An LLM-powered 3D model viewer and cameraman.', // Customize
    images: [
      {
        url: '/images/og_image.png',
        width: 1200, // Assuming a common OG image width, adjust if needed
        height: 630, // Assuming a common OG image height, adjust if needed
        alt: 'Modern 3D Viewer Open Graph Image', // Customize
      },
    ],
    type: 'website',
  },
};

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
