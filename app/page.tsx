import { redirect } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import App from '@/components/App';

// Reads the auth cookie, so it must render per-request.
export const dynamic = 'force-dynamic';

export default async function Home() {
  // Real auth check (proxy.ts only does an optimistic cookie-presence check).
  if (!(await isAuthenticated())) redirect('/login');
  return <App />;
}
