// import { JetBrains_Mono } from 'next/font/google';
import "./globals.css";
import { Providers } from "@/components/providers";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { Navigation } from "@/components/layout/Navigation";
import { DevInfo } from "@/components/dev/DevInfo";

// const jetbrainsMono = JetBrains_Mono({
//   subsets: ['latin'],
//   variable: '--font-jetbrains',
// });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ErrorBoundary>
          <Providers>
            {children}
            <DevInfo />
          </Providers>
        </ErrorBoundary>
      </body>
    </html>
  );
}
