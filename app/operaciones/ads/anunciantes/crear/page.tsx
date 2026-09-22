'use client';
import { StructuredActionForm } from '@/components/screens/StructuredActionForm';
import { avisoAltaAnunciante, seccionesAltaAnunciante } from '@/components/screens/altas/anunciante';
import { adsService } from '@/services/adsService';

/** Los campos viven en `altas/anunciante.ts`: el listado los reusa para su carga masiva. */
export default function CreateAdvertiserPage() {
  return (
    <StructuredActionForm
      moduleLabel="Ads"
      title="Nuevo anunciante"
      description="Registre identidad fiscal, contacto, modalidad de facturación y límite de crédito del anunciante."
      submitLabel="Crear anunciante"
      submitIcon="add_business"
      onSubmit={adsService.createAdvertiser}
      sections={seccionesAltaAnunciante}
      warning={avisoAltaAnunciante}
    />
  );
}
