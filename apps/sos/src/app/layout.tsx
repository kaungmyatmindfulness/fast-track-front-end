import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { Toaster } from '@repo/ui/components/sonner';

import '@repo/ui/globals.css';
import Providers from '@/utils/providers';

const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-geist-sans',
});
const geistMono = localFont({
  src: './fonts/GeistMonoVF.woff',
  variable: '--font-geist-mono',
});

export const metadata: Metadata = {
  title: 'Origin Food House POS',
  description: 'A modern and efficient restaurant POS solution.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <Providers>{children}</Providers>
        <Toaster />
      </body>
    </html>
  );
}
