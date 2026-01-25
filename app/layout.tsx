import type React from 'react';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import './modal.css';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import { ToastProvider } from '@/components/ui/toast';
import AccessGate from '@/components/auth/AccessGate';
import AuthContentGate from '@/components/auth/AuthContentGate';
import AdminProvider from '@/components/admin/AdminProvider';
import NoScrollDuringLoad from '@/components/NoScrollDuringLoad';
import Script from 'next/dist/client/script';

const inter = Inter({ subsets: ['latin', 'cyrillic'] });

export const metadata: Metadata = {
  title: 'TakeNap - Creative Library',
  description: 'Browse and analyze creative advertisements',
  generator: 'v0.app',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} overflow-auto no-scroll`}>
        {/* Ensure no-scroll is applied as early as possible before hydration */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{document.documentElement.classList.add('no-scroll');document.body.classList.add('no-scroll')}catch(e){} })();",
          }}
        />
        <Script
          id="marker-io"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              window.markerConfig = {
                project: '${
                  process.env.NEXT_PUBLIC_MARKER_IO_PROJECT_ID || '6785ee3db0ca3c28a63f32c2'
                }',
                source: 'snippet'
              };
              !function(e,r,a){if(!e.__Marker){e.__Marker={};var t=[],n={__cs:t};["show","hide","isVisible","capture","cancelCapture","unload","reload","isExtensionInstalled","setReporter","setCustomData","on","off"].forEach(function(e){n[e]=function(){var r=Array.prototype.slice.call(arguments);r.unshift(e),t.push(r)}}),e.Marker=n;var s=r.createElement("script");s.async=1,s.src="https://edge.marker.io/latest/shim.js";var i=r.getElementsByTagName("script")[0];i.parentNode.insertBefore(s,i)}}(window,document);
            `,
          }}
        />
        <NoScrollDuringLoad />
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          <ToastProvider>
            <AdminProvider>
              <AccessGate />
              <AuthContentGate>{children}</AuthContentGate>
            </AdminProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
