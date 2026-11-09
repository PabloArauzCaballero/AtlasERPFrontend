import { Suspense } from 'react';
import { LoginScreen } from '@/components/auth/LoginScreen';

/** El acceso del comercio afiliado. */
export default function LoginComerciosPage() {
  return (
    <Suspense>
      <LoginScreen audience="merchant" />
    </Suspense>
  );
}
