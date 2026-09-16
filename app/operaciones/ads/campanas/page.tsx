'use client';

import { LiveDirectoryScreen } from '@/components/screens/LiveDirectoryScreen';
import { adsService } from '@/services/adsService';
import type { JsonObject, PageQuery, ResourceRow } from '@/services/types';
import { formatMicrosAsBob } from '@/lib/formatters';
import { toast } from '@/lib/toast';
import { loadAdvertisers, loadPlacements, loadSegments } from '@/services/optionLoaders';

/**
 * Campañas publicitarias: portafolio, alta de la cadena completa y flujo de estado.
 *
 * El alta faltaba entera. La pantalla sabía listar campañas y cambiarles el estado porque el
 * backend tampoco ofrecía más: no existía `POST /admin/ads/campaigns` ni de ninguna de las piezas
 * que cuelgan de ella, así que la única forma de que existiera una campaña era sembrarla por SQL.
 *
 * La CAMPAÑA, que es lo que lista la tabla, se crea en el modal de «Nueva campaña». Lo que cuelga
 * de ella —conjunto, creatividad, anuncio— se añade desde SU fila: eran tres pestañas «1 · Conjunto»,
 * «2 · Creatividad», «3 · Anuncio» (verbos en la barra de secciones) que volvían a pedir en un
 * desplegable la campaña que ya se estaba mirando, y ofrecían conjuntos y creatividades de todas
 * las campañas. Desde la fila, la campaña va fijada y los desplegables sólo ofrecen lo suyo.
 */
export default function CampaignsPage() {
  /* La tabla se recarga sola tras crear o cambiar el estado: ambas cosas pasan dentro de ella. */
  function cambiarEstado(row: ResourceRow, payload: JsonObject) {
    return adsService.updateCampaignStatus(String(row.id ?? ''), payload);
  }

  function createCampaign(payload: JsonObject) {
    return adsService.createCampaign(payload);
  }

  /** Conjuntos de UNA campaña: el backend filtra por `campaignId`. */
  async function conjuntosDe(campaignId: string) {
    const filas = await adsService.listAdSets(campaignId);
    if (!filas.length) return [{ label: '— Esta campaña no tiene conjuntos: añade uno primero —', value: '' }];
    return filas.map((fila) => ({ value: String(fila.id ?? ''), label: `${String(fila.name ?? '')} — ${String(fila.buyingModel ?? '')}` }));
  }

  /** Creatividades del anunciante de la campaña: un anuncio no puede mezclar anunciantes. */
  async function creatividadesDe(advertiserId: string) {
    const filas = await adsService.listCreatives(advertiserId);
    if (!filas.length) return [{ label: '— Este anunciante no tiene creatividades: añade una primero —', value: '' }];
    return filas.map((fila) => ({ value: String(fila.id ?? ''), label: `${String(fila.name ?? '')} — ${String(fila.creativeType ?? '')}` }));
  }

  function crearAnuncio(_row: ResourceRow, payload: JsonObject) {
    const { adSetId, ...body } = payload;
    return adsService.createAd(String(adSetId ?? ''), body);
  }

  /**
   * El resultado se dice en el aviso porque no hay fila que actualizar: la consulta no escribe, y
   * abrir una pantalla entera para tres cifras sería más ruido que respuesta.
   */
  async function verRendimiento(row: ResourceRow, payload: JsonObject) {
    const result = (await adsService.getCampaignPerformance(String(row.id ?? ''), payload as PageQuery)) as Record<string, unknown>;
    const totales = (result.totals ?? result) as Record<string, unknown>;
    const num = (value: unknown) => Number(value ?? 0).toLocaleString('es-BO');
    toast.success(
      `Rendimiento de ${String(row.name ?? '')}`,
      `${num(totales.impressions)} impresiones · ${num(totales.clicks)} clics · ${formatMicrosAsBob(Number(totales.spendMicros ?? 0))} consumido`,
    );
    return result;
  }

  return (
    <LiveDirectoryScreen
      moduleLabel="Ads"
      title="Gestión de campañas"
      description="Portafolio de campañas con su presupuesto, aprobación y estado. Conjuntos, creatividades y anuncios se añaden desde la fila de su campaña."
      load={adsService.listCampaigns}
      createLabel="Nueva campaña"
      create={{
        icon: 'campaign',
        title: 'Crear campaña',
        description: 'Nace en DRAFT / NOT_SUBMITTED. El presupuesto va en micros: 1 BOB = 1.000.000.',
        submit: createCampaign,
        fields: [
          { name: 'advertiserId', label: 'Anunciante', tooltip: 'Anunciante dueño de la campaña; su crédito y su facturación son los que se consumen.', type: 'select', required: true, span: 2, optionsLoader: loadAdvertisers },
          { name: 'name', label: 'Nombre de la campaña', tooltip: 'Nombre interno de la campaña; el anunciante lo ve en su portal. Ej.: Lanzamiento primavera.', required: true, span: 2 },
          // Objetivo y moneda salen de su dominio y del catálogo ISO, no de listas copiadas ni de texto libre.
          { name: 'objective', label: 'Objetivo', tooltip: 'Qué busca la campaña (alcance, clics, conversiones); decide cómo se optimiza la entrega.', required: true, optionsSource: 'domain:ads.campaignObjective' },
          { name: 'currency', label: 'Moneda', tooltip: 'Moneda en la que se factura y se consume el crédito (ISO 4217). Ej.: BOB.', required: true, defaultValue: 'BOB', optionsSource: 'catalog:currency' },
          { name: 'budgetTotalMicros', label: 'Presupuesto total (micros)', tooltip: 'Presupuesto total en micros (1 Bs = 1 000 000). Ej.: 500000000 = Bs 500. Al agotarse, la campaña se detiene.', required: true, valueKind: 'number' },
          { name: 'budgetDailyMicros', label: 'Tope diario (micros)', tooltip: 'Tope diario en micros; reparte el presupuesto en el tiempo. No puede superar al total.', valueKind: 'number', optional: true, hint: 'No puede superar al total.' },
          { name: 'startsAt', label: 'Inicio', tooltip: 'Fecha y hora en que empieza la entrega; antes no se muestra nada.', type: 'datetime', required: true },
          { name: 'endsAt', label: 'Fin', tooltip: 'Fecha y hora en que termina la entrega; vacío = hasta agotar presupuesto.', type: 'datetime', optional: true },
        ],
      }}
      rowActions={(row) => [
        {
          /*
           * El rendimiento de una campaña: `GET /admin/ads/campaigns/:id/performance`
           * existía con su método en el servicio y ninguna pantalla lo pedía, así que
           * «cómo va mi campaña» no se podía responder desde la consola aunque el dato
           * estuviera calculado.
           */
          key: 'rendimiento',
          label: 'Ver rendimiento',
          icon: 'query_stats',
          form: {
            icon: 'query_stats',
            title: () => `Rendimiento de «${String(row.name ?? '')}»`,
            description: 'Impresiones, clics y consumo del rango. No modifica nada: el rango es lo que hay que elegir para leerlo.',
            submitLabel: 'Consultar',
            submit: verRendimiento,
            fields: [
              { name: 'from', label: 'Desde', tooltip: 'Inicio del rango de fechas que se consulta.', type: 'date', optional: true },
              { name: 'to', label: 'Hasta', tooltip: 'Fin del rango de fechas que se consulta, inclusive.', type: 'date', optional: true },
              /*
               * El backend agrupa por CAMPAIGN, AD_SET, AD o DAY (`ads.performanceGrouping`). La lista
               * copiada mandaba day/week/month, que su validación rechaza con 400: la consulta sólo
               * funcionaba dejando el campo vacío. Semana y mes desaparecen porque nunca existieron.
               */
              { name: 'groupBy', label: 'Agrupar por', tooltip: 'Cómo se agrupan las cifras del informe: por día, por campaña o por espacio.', optional: true, optionsSource: 'domain:ads.performanceGrouping' },
            ],
          },
        },
        {
          key: 'conjunto',
          label: 'Añadir conjunto de anuncios',
          icon: 'ad_units',
          form: {
            icon: 'ad_units',
            title: () => `Nuevo conjunto en «${String(row.name ?? '')}»`,
            description: 'Aquí se aplica la segmentación y el tope de frecuencia. Sin espacio publicitario, el conjunto nunca entra en una subasta.',
            submitLabel: 'Crear conjunto',
            submit: (fila, payload) => adsService.createAdSet(String(fila.id ?? ''), payload),
            fields: [
              { name: 'name', label: 'Nombre del conjunto', tooltip: 'Nombre interno de la campaña; el anunciante lo ve en su portal. Ej.: Lanzamiento primavera.', required: true, span: 2 },
              { name: 'buyingModel', label: 'Modelo de compra', tooltip: 'Cómo se paga la entrega: por mil impresiones (CPM) o por clic (CPC).', required: true, optionsSource: 'domain:ads.buyingModel' },
              { name: 'bidAmountMicros', label: 'Puja (micros)', tooltip: 'Puja en micros por impresión o clic según el modelo. Ej.: 2500000 = Bs 2,50.', required: true, valueKind: 'number' },
              { name: 'targetSegmentId', label: 'Segmento de audiencia', tooltip: 'Segmento de audiencia al que se entrega; sin segmento llega a toda la audiencia.', type: 'select', optional: true, span: 2, optionsLoader: async () => [{ label: '— Toda la audiencia —', value: '' }, ...(await loadSegments())], hint: 'Sin segmento, el conjunto entrega a toda la audiencia.' },
              { name: 'placementIds', label: 'Espacio publicitario', tooltip: 'Espacios publicitarios donde puede aparecer el anuncio; al menos uno.', type: 'select', required: true, span: 2, optionsLoader: loadPlacements, valueKind: 'stringList' },
              { name: 'frequencyCapCount', label: 'Tope de frecuencia', tooltip: 'Cuántas veces como máximo ve una persona el anuncio en la ventana indicada.', optional: true, valueKind: 'number', hint: 'Exige también la ventana.' },
              { name: 'frequencyCapWindowHours', label: 'Ventana del tope (horas)', tooltip: 'Horas que dura la ventana del tope de frecuencia. Ej.: 24.', optional: true, valueKind: 'number' },
            ],
          },
        },
        {
          key: 'creatividad',
          label: 'Añadir creatividad',
          icon: 'image',
          form: {
            icon: 'image',
            title: () => `Nueva creatividad para el anunciante de «${String(row.name ?? '')}»`,
            description: 'Queda a nombre del anunciante de esta campaña y pasa por revisión de políticas antes de servirse. El destino debe ser http(s).',
            submitLabel: 'Crear creatividad',
            submit: (fila, payload) => adsService.createCreative({ ...payload, advertiserId: String(fila.advertiserId ?? '') }),
            fields: [
              { name: 'name', label: 'Nombre', tooltip: 'Nombre interno de la campaña; el anunciante lo ve en su portal. Ej.: Lanzamiento primavera.', required: true, span: 2 },
              { name: 'creativeType', label: 'Tipo', tooltip: 'Formato de la creatividad (imagen, texto, vídeo); decide qué campos y tamaños se piden.', required: true, optionsSource: 'domain:ads.creativeType' },
              { name: 'headline', label: 'Titular', tooltip: 'Titular corto que se muestra en el anuncio; hasta unas 40 letras.', optional: true },
              { name: 'ctaText', label: 'Texto del botón', tooltip: 'Texto del botón de acción. Ej.: «Ver oferta».', optional: true },
              { name: 'destinationUrl', label: 'URL de destino', tooltip: 'Página a la que lleva el clic, con https://. Se verifica antes de aprobar.', required: true, span: 2 },
              { name: 'bodyText', label: 'Cuerpo', tooltip: 'Texto de apoyo del anuncio; una o dos frases.', type: 'textarea', optional: true, span: 2 },
            ],
          },
        },
        {
          key: 'anuncio',
          label: 'Añadir anuncio',
          icon: 'ads_click',
          form: {
            icon: 'ads_click',
            title: () => `Nuevo anuncio en «${String(row.name ?? '')}»`,
            description: 'Une un conjunto de esta campaña con una creatividad de su anunciante: los desplegables sólo ofrecen esos. Si alguno sale vacío, añádelo antes con las acciones de la fila.',
            submitLabel: 'Crear anuncio',
            submit: crearAnuncio,
            fields: [
              { name: 'adSetId', label: 'Conjunto de anuncios', tooltip: 'Conjunto de anuncios al que pertenece; hereda su audiencia, puja y espacios.', type: 'select', required: true, span: 2, optionsLoader: () => conjuntosDe(String(row.id ?? '')) },
              { name: 'creativeId', label: 'Creatividad', tooltip: 'Creatividad que se muestra; tiene que estar aprobada por moderación.', type: 'select', required: true, span: 2, optionsLoader: () => creatividadesDe(String(row.advertiserId ?? '')) },
              { name: 'name', label: 'Nombre del anuncio', tooltip: 'Nombre interno de la campaña; el anunciante lo ve en su portal. Ej.: Lanzamiento primavera.', required: true, span: 2 },
              { name: 'weight', label: 'Peso', tooltip: 'Peso relativo frente a los demás anuncios del conjunto; a más peso, más veces se muestra.', optional: true, valueKind: 'number', defaultValue: '1', hint: 'Pondera el reparto entre anuncios del mismo conjunto.' },
            ],
          },
        },
        {
          key: 'estado',
          label: 'Cambiar estado',
          icon: 'published_with_changes',
          form: {
            icon: 'published_with_changes',
            title: () => `Actualizar el estado de «${String(row.name ?? '')}»`,
            description: 'Aplica un cambio de estado permitido, con una razón que queda auditada.',
            submitLabel: 'Actualizar estado',
            submit: cambiarEstado,
            fields: [
              { name: 'status', label: 'Nuevo estado', tooltip: 'Nuevo estado de la campaña; pausar detiene la entrega y activar la reanuda.', required: true, span: 2, defaultValue: String(row.status ?? 'DRAFT'), optionsSource: 'domain:ads.campaignStatus' },
              { name: 'reason', label: 'Razón', tooltip: 'Por qué cambia el estado de la campaña; el anunciante lo ve en su portal.', required: true, span: 2, placeholder: 'Mínimo 8 caracteres' },
            ],
          },
        },
      ]}
      statusOptions={[
        { label: 'Borrador', value: 'DRAFT' },
        { label: 'Activa', value: 'ACTIVE' },
        { label: 'Pausada', value: 'PAUSED' },
        { label: 'Finalizada', value: 'ENDED' },
      ]}
      columns={[
        { key: 'name', label: 'Campaña' },
        { key: 'advertiserId', label: 'Anunciante', kind: 'mono' },
        { key: 'budgetTotalMicros', label: 'Presupuesto', kind: 'money', align: 'right' },
        { key: 'startsAt', label: 'Inicio', kind: 'date' },
        { key: 'endsAt', label: 'Fin', kind: 'date' },
        { key: 'approvalStatus', label: 'Aprobación', kind: 'status' },
        { key: 'status', label: 'Estado', kind: 'status' },
      ]}
      metrics={[
        { label: 'Campañas', value: (_rows, total) => total, detail: 'Portafolio administrado', icon: 'campaign' },
        { label: 'Activas', value: (rows) => rows.filter((row) => row.status === 'ACTIVE').length, detail: 'En delivery', icon: 'play_circle', tone: 'teal' },
        { label: 'En aprobación', value: (rows) => rows.filter((row) => String(row.approvalStatus).includes('PENDING')).length, detail: 'Requieren decisión', icon: 'approval', tone: 'amber' },
        { label: 'Pausadas', value: (rows) => rows.filter((row) => row.status === 'PAUSED').length, detail: 'Intervención operativa', icon: 'pause_circle', tone: 'red' },
      ]}
    />
  );
}
