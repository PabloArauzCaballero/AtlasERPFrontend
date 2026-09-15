import { ProposalManagerScreen } from '@/components/screens/ProposalManagerScreen';

/**
 * El constructor de propuestas, en su propia página.
 *
 * Vivía en una pestaña «Nueva propuesta» al lado de la cartera: un verbo en la barra de secciones.
 * Tiene líneas dinámicas y columna lateral, así que no cabe en un modal; la cartera lo abre con su
 * botón «Nueva propuesta» y las migas de pan llevan de vuelta.
 */
export default function NewProposalPage() {
  return <ProposalManagerScreen />;
}
