import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Presales Tracker',
  description: 'Track presales requests, assessments, and JD files.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
