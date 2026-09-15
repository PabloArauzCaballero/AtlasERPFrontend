import type { Metadata } from 'next';
import { FormulariosPapelScreen } from '@/components/screens/FormulariosPapelScreen';
import { CATALOGO_OPERACIONES } from '@/lib/formulariosPapel/catalogo';

export const metadata: Metadata = { title: 'Formularios en papel' };

export default function FormulariosPapelPage() {
  return <FormulariosPapelScreen lado="operaciones" catalogo={CATALOGO_OPERACIONES} />;
}
