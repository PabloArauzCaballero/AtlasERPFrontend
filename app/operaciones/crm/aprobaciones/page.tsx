import { ApprovalsDirectory } from '@/components/screens/ApprovalsDirectory';

/**
 * Las excepciones comerciales son pantalla propia, con su entrada en el menú de CRM.
 *
 * Estuvieron un rato como última pestaña del pipeline, con el argumento de que una excepción de
 * MDR se pide desde una propuesta y bloquea su cierre. No se quedan ahí por decisión de producto:
 * quien autoriza no es quien negocia —entra a resolver su cola y se va—, y para eso no tiene por
 * qué pasar por el embudo. El pipeline conserva Oportunidades, Tablero y Propuestas.
 */
export default function ApprovalsPage() {
  return <ApprovalsDirectory />;
}
