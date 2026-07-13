'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';

export function RequireAuth({ children }: Readonly<{ children: React.ReactNode }>) {
  const { status } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [status, router, pathname]);

  if (status !== 'authenticated') {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f8fafc]">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-[#031636]" />
      </div>
    );
  }

  return <>{children}</>;
}
