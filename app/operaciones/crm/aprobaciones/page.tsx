import { CrmPipelineScreen } from '@/components/screens/CrmPipelineScreen';

/**
 * Las excepciones comerciales ya no son una pantalla: son la última pestaña del pipeline.
 *
 * La ruta se conserva y abre esa pestaña, igual que hace `/propuestas`: los enlaces guardados, el
 * recorrido guiado y las guías por ruta siguen llevando a donde decían.
 */
export default function ApprovalsPage() {
  return <CrmPipelineScreen initialTab="aprobaciones" />;
}
