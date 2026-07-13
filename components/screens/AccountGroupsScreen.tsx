'use client';

import { useCallback, useState } from 'react';
import { accountingService } from '@/services/accountingService';
import { useAsyncResource } from '@/hooks/useAsyncResource';
import { useAtlasMutation } from '@/hooks/useAtlasMutation';
import { AtlasButton } from '@/components/atlas/AtlasButton';
import { FormField } from '@/components/atlas/FormField';
import { Icon } from '@/components/atlas/Icon';
import { InlineNotice } from '@/components/atlas/InlineNotice';
import { Panel } from '@/components/atlas/Panel';
import { StatusPill } from '@/components/atlas/StatusPill';
import { WorkspaceHeader } from '@/components/atlas/WorkspaceHeader';
import { useOptions } from '@/hooks/useOptions';
import { loadAccountGroups, loadChartsOfAccounts, withEmpty } from '@/services/optionLoaders';
import { accountClassificationOptions, statementTypeOptions } from '@/lib/catalogs';
import type { JsonObject } from '@/services/types';

interface GroupNode {
  id: string;
  code: string;
  name: string;
  statementType: string;
  classification: string;
  subClassification: string | null;
  status: string;
  children?: GroupNode[];
}

const emptyForm = {
  coaId: '',
  parentGroupId: '',
  code: '',
  name: '',
  statementType: 'BALANCE_SHEET',
  classification: 'ASSET',
  subClassification: '',
  sortOrder: '0',
};

const classificationTone: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  ASSET: 'success',
  LIABILITY: 'warning',
  EQUITY: 'neutral',
  REVENUE: 'success',
  EXPENSE: 'danger',
};

export function AccountGroupsScreen() {
  const coaOptions = useOptions(loadChartsOfAccounts);
  const groupOptions = useOptions(loadAccountGroups);
  const [coaFilter, setCoaFilter] = useState('');
  const load = useCallback(() => accountingService.accountGroupTree(coaFilter.trim() || undefined), [coaFilter]);
  const resource = useAsyncResource(load);
  const tree = (resource.data ?? []) as unknown as GroupNode[];

  const [form, setForm] = useState({ ...emptyForm });
  const mutation = useAtlasMutation((body: JsonObject) => accountingService.createAccountGroup(body));

  const setField = (key: keyof typeof emptyForm) => (value: string) => setForm((current) => ({ ...current, [key]: value }));

  async function handleCreate() {
    const body: JsonObject = {
      coaId: form.coaId.trim(),
      code: form.code.trim(),
      name: form.name.trim(),
      statementType: form.statementType,
      classification: form.classification,
      sortOrder: Number(form.sortOrder) || 0,
      ...(form.parentGroupId.trim() ? { parentGroupId: form.parentGroupId.trim() } : {}),
      ...(form.subClassification.trim() ? { subClassification: form.subClassification.trim() } : {}),
    };
    try {
      await mutation.execute(body);
      setForm((current) => ({ ...emptyForm, coaId: current.coaId, statementType: current.statementType, classification: current.classification }));
      await resource.reload();
    } catch {
      /* mutation.error expone el mensaje */
    }
  }

  const canCreate = form.coaId.trim() && form.code.trim() && form.name.trim();

  return (
    <div className="space-y-5">
      <WorkspaceHeader
        breadcrumbs={[{ label: 'Contabilidad' }, { label: 'Grupos de cuenta' }]}
        title="Grupos de cuenta (árbol contable)"
        description="Taxonomía de reporte para estados financieros: Balance General, Activo, Corriente y subgrupos. Independiente de la jerarquía cuenta-a-cuenta."
        actions={<AtlasButton variant="secondary" icon="refresh" loading={resource.status === 'loading'} onClick={resource.reload}>Actualizar</AtlasButton>}
      />

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,.8fr)]">
        <Panel title="Estructura jerárquica" description="Árbol de grupos ordenado por statement / clasificación." icon="account_tree">
          <div className="mb-3 flex items-center gap-2">
            <FormField kind="select" label="Filtrar por plan de cuentas (COA)" name="coaFilter" value={coaFilter} onChange={(e) => setCoaFilter(e.target.value)} options={[{ label: 'Todos los COA', value: '' }, ...coaOptions]} className="flex-1" />
          </div>
          {resource.error ? <InlineNotice tone="danger" title="No se pudo cargar el árbol">{resource.error}</InlineNotice> : null}
          {!resource.error && tree.length === 0 && resource.status !== 'loading' ? (
            <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center">
              <Icon name="account_tree" className="text-[34px] text-slate-300" />
              <p className="mt-2 text-xs font-bold text-slate-700">Aún no hay grupos de cuenta</p>
              <p className="mt-1 text-[11px] text-slate-500">Cree el primer grupo raíz (p. ej. «Balance General») con el panel de la derecha.</p>
            </div>
          ) : (
            <ul className="space-y-1">
              {tree.map((node) => <GroupBranch key={node.id} node={node} depth={0} />)}
            </ul>
          )}
        </Panel>

        <Panel title="Nuevo grupo" description="Cree un grupo raíz o hijo (indicando el grupo padre)." icon="add_circle">
          {mutation.status === 'success' ? <InlineNotice tone="success" title="Grupo creado">El grupo se agregó al árbol.</InlineNotice> : null}
          {mutation.error ? <InlineNotice tone="danger" title="No se pudo crear">{mutation.error}</InlineNotice> : null}
          <div className="space-y-3">
            <FormField kind="select" label="Plan de cuentas (COA)" name="coaId" required value={form.coaId} onChange={(e) => setField('coaId')(e.target.value)} options={[{ label: '— Seleccione un COA —', value: '' }, ...coaOptions]} />
            <FormField kind="select" label="Grupo padre" name="parentGroupId" value={form.parentGroupId} onChange={(e) => setField('parentGroupId')(e.target.value)} options={withEmpty(groupOptions, '— Grupo raíz —')} hint="Vacío = grupo raíz" />
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Código" name="code" required value={form.code} onChange={(e) => setField('code')(e.target.value)} placeholder="BG-ACT-CORR" />
              <FormField label="Orden" name="sortOrder" type="number" value={form.sortOrder} onChange={(e) => setField('sortOrder')(e.target.value)} />
            </div>
            <FormField label="Nombre" name="name" required value={form.name} onChange={(e) => setField('name')(e.target.value)} placeholder="Activo Corriente" />
            <FormField kind="select" label="Estado financiero" name="statementType" value={form.statementType} onChange={(e) => setField('statementType')(e.target.value)} options={statementTypeOptions} />
            <FormField kind="select" label="Clasificación" name="classification" value={form.classification} onChange={(e) => setField('classification')(e.target.value)} options={accountClassificationOptions} />
            <FormField label="Subclasificación (opcional)" name="subClassification" value={form.subClassification} onChange={(e) => setField('subClassification')(e.target.value)} placeholder="CURRENT / NON_CURRENT..." />
            <AtlasButton icon="save" loading={mutation.isLoading} disabled={!canCreate} onClick={handleCreate}>Crear grupo</AtlasButton>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function GroupBranch({ node, depth }: { node: GroupNode; depth: number }) {
  const tone = classificationTone[node.classification] ?? 'neutral';
  return (
    <li>
      <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2" style={{ marginLeft: depth * 18 }}>
        <Icon name={node.children?.length ? 'folder' : 'description'} className="text-[18px] text-slate-400" />
        <span className="font-mono text-[11px] text-slate-500">{node.code}</span>
        <span className="flex-1 truncate text-xs font-semibold text-slate-800">{node.name}</span>
        <StatusPill tone={tone} dot={false}>{node.classification}</StatusPill>
        <span className="hidden text-[10px] font-bold uppercase tracking-wide text-slate-400 sm:inline">{node.statementType.replaceAll('_', ' ')}</span>
      </div>
      {node.children?.length ? (
        <ul className="mt-1 space-y-1">
          {node.children.map((child) => <GroupBranch key={child.id} node={child} depth={depth + 1} />)}
        </ul>
      ) : null}
    </li>
  );
}
