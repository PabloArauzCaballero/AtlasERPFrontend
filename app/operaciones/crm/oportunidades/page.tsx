import { CrmPipelineScreen } from '@/components/screens/CrmPipelineScreen';

/**
 * El embudo comercial: oportunidades, tablero y propuestas en la misma barra de pestañas.
 *
 * La pantalla vive en un componente porque `/operaciones/crm/propuestas` pinta exactamente la
 * misma, abriendo por su pestaña.
 */
export default function OpportunitiesPage() {
  return <CrmPipelineScreen />;
}
