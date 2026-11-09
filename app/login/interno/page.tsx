import { Suspense } from 'react';
import { LoginScreen } from '@/components/auth/LoginScreen';

/** El acceso del personal de Atlas (con segundo factor). */
export default function LoginInternoPage() {
  return (
    <Suspense>
      <LoginScreen audience="internal" />
    </Suspense>
  );
}
