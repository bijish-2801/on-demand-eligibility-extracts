import init from '@/lib/db/init';
import type { Metadata } from 'next'
//import { Inter } from 'next/font/google';
import './globals.css'

/*
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600', '700']
});
*/
export const metadata: Metadata = {
  title: 'On-Demand Eligibility Reports',
  description: 'Application for creating and managing eligibility reports',
}

// Initialize the database pool when the app starts
init().catch(console.error);

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
//    <html lang="en" className={inter.className}>
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}