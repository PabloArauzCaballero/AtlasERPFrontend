import { CrmPipelineScreen } from '@/components/screens/CrmPipelineScreen';

/**
 * Las propuestas son la última pestaña del pipeline, no una pantalla aparte.
 *
 * Se emiten contra una oportunidad y de la aceptada cuelga el contrato: mirar «qué le ofrecimos a
 * este comercio» obligaba a salir del embudo y volver por el menú lateral. La ruta se conserva —la
 * usan el panel de inicio, las guías por ruta y los recorridos guiados— y abre esa pestaña.
 */
export default function ProposalsPage() {
  return <CrmPipelineScreen initialTab="propuestas" />;
}
