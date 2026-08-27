'use client';

import { useCallback, useState } from 'react';
import { CrudDirectory } from '@/components/screens/CrudDirectory';
import { b2bService } from '@/services/b2bService';

const siNo = [{ label: 'Activo', value: 'true' }, { label: 'Inactivo', value: 'false' }];

export default function AccountTagsPage() {
  const [version, setVersion] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(() => b2bService.listAccountTags(), [version]);

  return (
    <CrudDirectory
      moduleLabel="CRM"
      title="Tags de clasificación"
      description="El catálogo con el que se clasifican las cuentas B2B y se filtra el directorio. Aquí se ve entero, se corrige y se limpia."
      load={load}
      labelKey="name"
      searchPlaceholder="Buscar por nombre o descripción…"
      emptyHint="Crea el primer tag para poder clasificar cuentas con él."
      columns={[
        { key: 'name', label: 'Tag' },
        { key: 'description', label: 'Para qué se usa' },
        { key: 'accountCount', label: 'Cuentas', align: 'right' },
        { key: 'isActive', label: 'Activo', kind: 'bool' },
        { key: 'createdAt', label: 'Creado', kind: 'date' },
      ]}
      filters={[{ key: 'isActive', label: 'Estado', options: siNo }]}
      notice={{
        tone: 'info',
        title: 'De dónde salen estos tags',
        body: 'Se escriben como texto libre al crear una cuenta B2B, y hasta ahora sólo se podían crear así: por eso conviven variantes del mismo tag («mayorista» y «mayoristas») que parten en dos el filtro del directorio. Renombrar uno aquí lo corrige en todas las cuentas que lo llevan.',
      }}
      create={{
        label: 'Crear tag',
        title: 'Nuevo tag de clasificación',
        description: 'El nombre se guarda en minúsculas, igual que cuando se teclea desde el alta de una cuenta.',
        fields: [
          { name: 'name', label: 'Nombre', required: true, placeholder: 'mayorista', span: 2 },
          { name: 'description', label: 'Para qué se usa', optional: true, placeholder: 'Comercios que venden al por mayor', span: 2 },
          { name: 'isActive', label: 'Activo', type: 'select', valueKind: 'boolean', defaultValue: 'true', options: siNo },
        ],
        submit: async (payload) => { const created = await b2bService.createAccountTag(payload); setVersion((value) => value + 1); return created; },
      }}
      edit={{
        description: 'Renombrar el tag lo cambia en todas las cuentas que ya lo llevan: no hay que reclasificarlas una a una.',
        fields: [
          { name: 'name', label: 'Nombre', required: true, span: 2 },
          { name: 'description', label: 'Para qué se usa', optional: true, span: 2 },
          { name: 'isActive', label: 'Activo', type: 'select', valueKind: 'boolean', options: siNo },
        ],
        submit: (id, payload) => b2bService.updateAccountTag(id, payload),
      }}
      remove={{
        // `force` porque el diálogo ya avisa de que se quita de las cuentas que lo llevaban.
        submit: (id) => b2bService.deleteAccountTag(id, true),
        warning: 'El tag se quita también de todas las cuentas que lo llevaban; esas cuentas no se borran ni cambian en nada más. Si sólo quieres dejar de ofrecerlo, márcalo como inactivo en vez de borrarlo.',
      }}
    />
  );
}
