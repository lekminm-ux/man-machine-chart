import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Man-Machine Chart | Standard Operation Layout',
  description: 'Industrial Man-Machine Chart builder for Blow Molding, Injection Molding, and Assembly processes. Create, manage and visualize standard operation layouts.',
  keywords: ['man-machine chart', 'standard operation', 'blow molding', 'industrial engineering', 'gantt chart'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans antialiased bg-slate-900 text-slate-100">
        {children}
      </body>
    </html>
  );
}
