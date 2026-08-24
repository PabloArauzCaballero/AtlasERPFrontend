'use client';
import { MultiActionWorkspace } from '@/components/screens/MultiActionWorkspace';
import { accountingService } from '@/services/accountingService';
import { loadAccountingPeriods, loadLegalEntities } from '@/services/optionLoaders';
export default function PeriodClosingPage() {
  return <MultiActionWorkspace moduleLabel="Contabilidad" title="Cerrar período contable" description="Ejecute cierre o reapertura con control por entidad legal, período y tipo de cierre." actions={[
    { id: 'close', title: 'Acción de Cierre', description: 'Bloquea nuevas contabilizaciones en el período.', icon: 'lock', submitLabel: 'Cerrar período', submitIcon: 'lock_person', onSubmit: accountingService.closePeriod, fields: [
      { name: 'legalEntityId', label: 'Entidad legal', type: 'select', required: true, span: 2, optionsLoader: loadLegalEntities }, { name: 'periodId', label: 'Período contable', type: 'select', required: true, span: 2, optionsLoader: loadAccountingPeriods },
      { name: 'closeType', label: 'Tipo de cierre', type: 'select', required: true, options: [{ label: 'Mensual', value: 'MONTHLY' }, { label: 'Anual', value: 'ANNUAL' }], span: 2 },
    ] },
    { id: 'reopen', title: 'Reapertura Controlada', description: 'Rehabilita temporalmente un período cerrado.', icon: 'lock_open', submitLabel: 'Reabrir período', onSubmit: accountingService.reopenPeriod, fields: [
      { name: 'legalEntityId', label: 'Entidad legal', type: 'select', required: true, span: 2, optionsLoader: loadLegalEntities }, { name: 'periodId', label: 'Período contable', type: 'select', required: true, span: 2, optionsLoader: loadAccountingPeriods },
      { name: 'reason', label: 'Motivo documentado', type: 'textarea', required: true, span: 2 },
    ] },
  ]} sideTitle="Pre-cierre" sideItems={[{ label: 'Cuadre de submayores', detail: 'AR, AP, bancos y activos deben estar conciliados.', icon: 'balance' }, { label: 'Documentos pendientes', detail: 'No deben existir borradores críticos.', icon: 'pending_actions' }, { label: 'Aprobación', detail: 'La reapertura exige motivo y trazabilidad.', icon: 'approval' }]} />;
}
