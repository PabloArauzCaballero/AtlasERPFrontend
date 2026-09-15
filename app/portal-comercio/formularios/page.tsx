import type { Metadata } from 'next';
import { FormulariosPapelScreen } from '@/components/screens/FormulariosPapelScreen';
import { CATALOGO_PORTAL } from '@/lib/formulariosPapel/catalogo';

export const metadata: Metadata = { title: 'Formularios en papel' };

export default function MerchantFormulariosPapelPage() {
  return <FormulariosPapelScreen lado="portal" catalogo={CATALOGO_PORTAL} />;
}
