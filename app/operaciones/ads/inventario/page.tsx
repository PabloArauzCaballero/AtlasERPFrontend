'use client';

import { useState } from 'react';
import { TabbedPanels } from '@/components/atlas/TabbedPanels';
import { WorkspaceHeader } from '@/components/atlas/WorkspaceHeader';
import { LiveDirectoryScreen } from '@/components/screens/LiveDirectoryScreen';
import { adsService } from '@/services/adsService';

/**
 * Espacios publicitarios, políticas de contenido y auditoría del módulo.
 *
 * Los seis endpoints —listar y crear espacios, listar y crear políticas, y la auditoría— existían
 * con sus métodos en el servicio del frontend y no los llamaba ninguna pantalla. Las consecuencias
 * eran concretas, no teóricas:
 *
 * - **Sin espacios no se entrega nada.** `placementCode` es lo primero que mira la petición de
 *   entrega; los dos espacios que hay salieron de una semilla y no había forma de añadir un tercero
 *   sin tocar la base.
 * - **Las políticas deciden qué se rechaza o va a revisión manual** en moderación, y sólo existían
 *   las dos sembradas.
 * - **La auditoría es la respuesta a «quién aprobó esto»**, y estaba escrita sin poder leerse.
 */
export default function AdsInventoryPage() {
  const [tab, setTab] = useState('espacios');

  return (
    <div className="space-y-5">
      <WorkspaceHeader
        breadcrumbs={[{ label: 'Ads' }, { label: 'Inventario y políticas' }]}
        title="Inventario, políticas y auditoría"
        description="Dónde se puede servir un anuncio, qué contenido se rechaza y qué hizo cada quien en el módulo."
      />
      <TabbedPanels
        activeId={tab}
        onChange={setTab}
        keepMounted
        tabs={[
          {
            id: 'espacios',
            label: 'Espacios',
            icon: 'space_dashboard',
            content: (
              <LiveDirectoryScreen
                embedded
                moduleLabel="Ads"
                title="Espacios publicitarios"
                description="Cada espacio es un sitio donde se puede servir un anuncio. El código es lo que manda el ad server al pedirlo."
                load={adsService.listInventory}
                createLabel="Nuevo espacio"
                create={{
                  title: 'Nuevo espacio publicitario',
                  description: 'El precio suelo es el mínimo por millar; la tarifa contratada del comercio puede quedar por encima, nunca la sustituye en silencio.',
                  icon: 'add_box',
                  fields: [
                    { name: 'placementCode', label: 'Código', required: true, span: 2, placeholder: 'MERCHANT_DASHBOARD_TOP_BANNER' },
                    { name: 'surface', label: 'Superficie', required: true, placeholder: 'MERCHANT_PORTAL' },
                    { name: 'allowedFormats', label: 'Formatos admitidos', type: 'chips', required: true, span: 2, hint: 'IMAGE_BANNER, TEXT_CARD, VIDEO…' },
                    {
                      name: 'billingModel',
                      label: 'Modelo de cobro',
                      type: 'select',
                      required: true,
                      options: ['CPM', 'CPC', 'CPA', 'FIXED'].map((value) => ({ label: value, value })),
                    },
                    { name: 'floorPriceMicros', label: 'Precio suelo (micros)', type: 'number', optional: true, hint: '2500000 = Bs 2,50 el millar.' },
                    { name: 'widthPx', label: 'Ancho (px)', type: 'number', optional: true },
                    { name: 'heightPx', label: 'Alto (px)', type: 'number', optional: true },
                    {
                      name: 'status',
                      label: 'Estado',
                      type: 'select',
                      optional: true,
                      options: [{ label: 'Activo', value: 'ACTIVE' }, { label: 'Inactivo', value: 'INACTIVE' }],
                    },
                  ],
                  submit: (payload) => adsService.createInventory(payload),
                }}
                statusOptions={[{ label: 'Activo', value: 'ACTIVE' }, { label: 'Inactivo', value: 'INACTIVE' }]}
                columns={[
                  { key: 'placementCode', label: 'Código', kind: 'mono' },
                  { key: 'surface', label: 'Superficie' },
                  { key: 'billingModel', label: 'Cobro', kind: 'status' },
                  { key: 'allowedFormats', label: 'Formatos', kind: 'list' },
                  { key: 'floorPriceMicros', label: 'Precio suelo', align: 'right' },
                  { key: 'status', label: 'Estado', kind: 'status' },
                ]}
                metrics={[
                  { label: 'Espacios', value: (_rows, total) => total, detail: 'Sitios donde se puede servir', icon: 'space_dashboard' },
                  { label: 'Activos', value: (rows) => rows.filter((row) => row.status === 'ACTIVE').length, detail: 'Elegibles en la entrega', icon: 'check_circle', tone: 'teal' },
                  { label: 'Por clic', value: (rows) => rows.filter((row) => row.billingModel === 'CPC').length, detail: 'El resto cobra por alcance', icon: 'ads_click', tone: 'purple' },
                ]}
              />
            ),
          },
          {
            id: 'politicas',
            label: 'Políticas',
            icon: 'policy',
            content: (
              <LiveDirectoryScreen
                embedded
                moduleLabel="Ads"
                title="Políticas de contenido"
                description="Qué se rechaza solo, qué obliga a revisión manual y qué corta la entrega."
                load={adsService.listPolicies}
                createLabel="Nueva política"
                create={{
                  title: 'Nueva política de contenido',
                  description: 'El tipo decide el efecto: rechazo automático, revisión manual, aviso o corte de entrega.',
                  icon: 'gavel',
                  fields: [
                    { name: 'policyCode', label: 'Código', required: true, span: 2, placeholder: 'NO_UNVERIFIED_FINANCIAL_CLAIMS' },
                    { name: 'category', label: 'Categoría', required: true, placeholder: 'FINANCIAL_CLAIMS' },
                    {
                      name: 'ruleType',
                      label: 'Tipo de regla',
                      type: 'select',
                      required: true,
                      options: [
                        { label: 'Rechazo automático', value: 'AUTO_REJECT' },
                        { label: 'Revisión manual', value: 'MANUAL_REVIEW_REQUIRED' },
                        { label: 'Aviso', value: 'WARNING' },
                        { label: 'Cortar entrega', value: 'BLOCK_DELIVERY' },
                      ],
                    },
                    {
                      name: 'severity',
                      label: 'Severidad',
                      type: 'select',
                      optional: true,
                      options: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((value) => ({ label: value, value })),
                    },
                    { name: 'description', label: 'Qué prohíbe', type: 'textarea', optional: true, span: 3 },
                  ],
                  submit: (payload) => adsService.createPolicy(payload),
                }}
                columns={[
                  { key: 'policyCode', label: 'Política', kind: 'mono' },
                  { key: 'category', label: 'Categoría' },
                  { key: 'ruleType', label: 'Efecto', kind: 'status' },
                  { key: 'severity', label: 'Severidad', kind: 'status' },
                  { key: 'description', label: 'Qué prohíbe' },
                  { key: 'isActive', label: 'Activa', kind: 'status' },
                ]}
                metrics={[
                  { label: 'Políticas', value: (_rows, total) => total, detail: 'Reglas del catálogo', icon: 'policy' },
                  { label: 'Rechazo automático', value: (rows) => rows.filter((row) => row.ruleType === 'AUTO_REJECT').length, detail: 'No pasan por revisión', icon: 'block', tone: 'red' },
                  { label: 'Revisión manual', value: (rows) => rows.filter((row) => row.ruleType === 'MANUAL_REVIEW_REQUIRED').length, detail: 'Alimentan la cola de moderación', icon: 'rate_review', tone: 'amber' },
                ]}
              />
            ),
          },
          {
            id: 'auditoria',
            label: 'Auditoría',
            icon: 'history',
            content: (
              <LiveDirectoryScreen
                embedded
                moduleLabel="Ads"
                title="Auditoría del módulo"
                description="Quién hizo qué: aprobaciones, cambios de estado, decisiones de moderación y cierres."
                load={adsService.listAudit}
                columns={[
                  /* `created_at` y `actorUserId` tal y como los sirve el backend: con `createdAt`
                   * o `actorId` la columna sale vacía y la tabla parece rota teniendo datos. */
                  { key: 'created_at', label: 'Cuándo', kind: 'date' },
                  { key: 'action', label: 'Acción' },
                  { key: 'entityType', label: 'Entidad' },
                  { key: 'entityId', label: 'Registro', kind: 'mono' },
                  { key: 'severity', label: 'Severidad', kind: 'status' },
                  { key: 'reason', label: 'Motivo' },
                  { key: 'actorUserId', label: 'Actor', kind: 'mono' },
                ]}
                metrics={[
                  { label: 'Eventos', value: (_rows, total) => total, detail: 'Rastro del módulo', icon: 'history' },
                  { label: 'Críticos', value: (rows) => rows.filter((row) => row.severity === 'CRITICAL').length, detail: 'Página actual', icon: 'priority_high', tone: 'red' },
                ]}
              />
            ),
          },
        ]}
      />
    </div>
  );
}
