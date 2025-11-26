import type React from 'react';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import './modal.css';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import { ToastProvider } from '@/components/ui/toast';
import AdminButton from '@/components/admin/AdminButton';
import AccessGate from '@/components/auth/AccessGate';
import AuthContentGate from '@/components/auth/AuthContentGate';

const inter = Inter({ subsets: ['latin', 'cyrillic'] });

export const metadata: Metadata = {
  title: 'TakeNap - Creative Library',
  description: 'Browse and analyze creative advertisements',
  generator: 'v0.app',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} overflow-auto`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          <ToastProvider>
            <AccessGate />
            {process.env.NEXT_PUBLIC_SHOW_ADMIN_BUTTON === 'true' ? <AdminButton /> : null}
            <AuthContentGate>{children}</AuthContentGate>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
