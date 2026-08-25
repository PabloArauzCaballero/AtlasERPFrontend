'use client';
import { LiveDirectoryScreen } from '@/components/screens/LiveDirectoryScreen';
import { MultiActionWorkspace } from '@/components/screens/MultiActionWorkspace';
import { adsService } from '@/services/adsService';
import type { JsonObject } from '@/services/types';
import { loadAdvertisers } from '@/services/optionLoaders';

/**
 * Segmentos de audiencia publicitaria.
 *
 * Pantalla nueva sobre una tabla que llevaba tiempo existiendo y vacía: `ad_target_segments` no
 * tenía endpoint que la escribiera ni consulta que la leyera al entregar, así que un conjunto de
 * anuncios "segmentado" se servía exactamente igual que uno abierto.
 *
 * El formulario compone UNA regla, que es lo que cubre la mayoría de los casos reales (un rubro,
 * una ciudad, una banda). Definiciones de varias reglas se dan de alta por API: meter aquí un
 * constructor de reglas encadenadas antes de saber qué combinaciones se usan de verdad sería
 * diseñar la pantalla contra una suposición.
 */
export default function AdSegmentsPage() {
  async function createSegment(payload: JsonObject) {
    const { attribute, operator, value, ...rest } = payload;
    // Los operadores de lista esperan un arreglo; el campo llega como texto separado por comas.
    const listOperators = ['IN', 'NOT_IN', 'BETWEEN'];
    const rawValue = String(value ?? '');
    const ruleValue = listOperators.includes(String(operator))
      ? rawValue
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
      : rawValue;

    return adsService.createSegment({
      ...rest,
      definition: {
        match: 'ALL',
        rules: [
          {
            attribute,
            operator,
            ...(String(operator) === 'EXISTS' ? {} : { value: ruleValue }),
          },
        ],
      },
    });
  }

  return (
    <div className="space-y-6">
      <LiveDirectoryScreen
        moduleLabel="Ads"
        title="Segmentos de audiencia"
        description="A quién alcanza cada conjunto de anuncios. Un conjunto sin segmento entrega a toda la audiencia."
        load={adsService.listSegments}
        statusOptions={[
          { label: 'Activo', value: 'ACTIVE' },
          { label: 'Inactivo', value: 'INACTIVE' },
        ]}
        columns={[
          { key: 'name', label: 'Segmento' },
          { key: 'segmentType', label: 'Tipo', kind: 'status' },
          { key: 'privacyLevel', label: 'Privacidad', kind: 'status' },
          { key: 'advertiserId', label: 'Anunciante', kind: 'mono' },
          { key: 'status', label: 'Estado', kind: 'status' },
        ]}
        metrics={[
          {
            label: 'Segmentos',
            value: (_rows, total) => total,
            detail: 'Catálogo de audiencias',
            icon: 'groups',
          },
          {
            label: 'Activos',
            value: (rows) => rows.filter((row) => row.status === 'ACTIVE').length,
            detail: 'Aplicables en entrega',
            icon: 'check_circle',
            tone: 'teal',
          },
          {
            label: 'Con lista de clientes',
            value: (rows) => rows.filter((row) => row.privacyLevel === 'HASHED_ALLOWLIST').length,
            detail: 'Privacidad reforzada',
            icon: 'lock',
            tone: 'amber',
          },
        ]}
      />

      <MultiActionWorkspace
        moduleLabel="Ads"
        title="Crear segmento"
        description="El tipo limita qué atributos puede mirar el segmento, y el nivel de privacidad se deriva de la regla."
        actions={[
          {
            id: 'create-segment',
            title: 'Nuevo segmento',
            icon: 'group_add',
            description:
              'Una regla. Para IN, NOT_IN o BETWEEN, escribe los valores separados por coma; EXISTS no lleva valor.',
            submitLabel: 'Crear segmento',
            onSubmit: createSegment,
            fields: [
              { name: 'name', label: 'Nombre del segmento', required: true, span: 2 },
              {
                name: 'segmentType',
                label: 'Tipo',
                type: 'select',
                required: true,
                options: [
                  { label: 'Rubro del comercio', value: 'MERCHANT_CATEGORY' },
                  { label: 'Geografía', value: 'GEO' },
                  { label: 'Perfil corporativo', value: 'CORPORATE_CONTEXTUAL' },
                  { label: 'Lista de clientes (hash)', value: 'CUSTOM_ALLOWLIST' },
                  { label: 'Lista estática', value: 'LOOKUP_STATIC' },
                ],
              },
              { name: 'advertiserId', label: 'Anunciante', type: 'select',
                optional: true,
                hint: 'Vacío = segmento de plataforma, disponible para todos.',
               optionsLoader: loadAdvertisers },
              {
                name: 'attribute',
                label: 'Atributo',
                type: 'select',
                required: true,
                options: [
                  { label: 'Rubro del comercio', value: 'merchantCategory' },
                  { label: 'Ciudad', value: 'city' },
                  { label: 'Región', value: 'region' },
                  { label: 'País', value: 'country' },
                  { label: 'Segmento de riesgo', value: 'riskSegment' },
                  { label: 'Banda de volumen mensual', value: 'monthlyVolumeBand' },
                  { label: 'Banda de tamaño', value: 'merchantSizeBand' },
                  { label: 'Superficie', value: 'surface' },
                  { label: 'Antigüedad (meses)', value: 'tenureMonths' },
                  { label: 'Huella del cliente', value: 'corporateClientHash' },
                ],
              },
              {
                name: 'operator',
                label: 'Operador',
                type: 'select',
                required: true,
                options: ['EQUALS', 'NOT_EQUALS', 'IN', 'NOT_IN', 'BETWEEN', 'EXISTS'].map(
                  (value) => ({ label: value, value }),
                ),
              },
              {
                name: 'value',
                label: 'Valor',
                optional: true,
                span: 2,
                placeholder: 'FARMACIA, MERCADO',
                hint: 'BETWEEN espera dos números: 12, 36.',
              },
            ],
          },
        ]}
      />
    </div>
  );
}
