import type { Metadata } from 'next';
import { FormulariosPapelScreen } from '@/components/screens/FormulariosPapelScreen';

export const metadata: Metadata = { title: 'Formularios en papel' };

export default function FormulariosPapelPage() {
  return <FormulariosPapelScreen lado="operaciones" />;
}
