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
