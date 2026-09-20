import { CrmPipelineScreen } from '@/components/screens/CrmPipelineScreen';

/**
 * El embudo comercial: oportunidades, su tablero y las excepciones que hay que autorizar.
 *
 * La pantalla vive en un componente porque `/operaciones/crm/aprobaciones` pinta exactamente la
 * misma, abriendo por su pestaña. Las propuestas NO están aquí: son pantalla propia.
 */
export default function OpportunitiesPage() {
  return <CrmPipelineScreen />;
}
