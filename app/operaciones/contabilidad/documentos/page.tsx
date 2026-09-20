'use client';

import { useCallback } from 'react';
import { CrudDirectory } from '@/components/screens/CrudDirectory';
import { accountingService } from '@/services/accountingService';

/**
 * Documentos contables: el listado es la pantalla.
 *
 * El alta era una pestaña «Crear documento» junto a «Documentos registrados»: un verbo en la barra
 * de secciones. Un asiento lleva líneas y columna de control, así que va a su propia página; el
 * botón está en la cabecera, y contabilizar o reversar siguen en la fila.
 */
export default function AccountingDocumentsPage() {
  const load = useCallback(() => accountingService.listDocuments(), []);

  return (
    <CrudDirectory
      moduleLabel="Contabilidad"
      title="Documentos contables"
      description="Todos los asientos registrados y su estado de contabilización. Un documento contabilizado no se edita ni se borra: se reversa."
      load={load}
      labelKey="documentNo"
      searchPlaceholder="Buscar por número, tipo o estado…"
      emptyHint="Usa el botón «Crear documento» para registrar el primer asiento."
      columns={[
        { key: 'documentNo', label: 'Documento', kind: 'mono' },
        { key: 'documentType', label: 'Tipo' },
        { key: 'documentDate', label: 'Fecha', kind: 'date' },
        { key: 'postingDate', label: 'Contabilización', kind: 'date' },
        { key: 'currencyCode', label: 'Moneda' },
        { key: 'status', label: 'Estado', kind: 'status' },
      ]}
      filters={[{ key: 'documentType', label: 'Tipo' }, { key: 'status', label: 'Estado' }]}
      notice={{
        tone: 'info',
        title: 'Sin lápiz ni papelera, y es a propósito',
        body: 'Un asiento contabilizado es inmutable: corregirlo o borrarlo rompería el cuadre del período y la trazabilidad. Lo que corresponde es contabilizar el borrador o reversarlo con un asiento contrario.',
      }}
      create={{ label: 'Crear documento', href: '/operaciones/contabilidad/documentos/crear' }}
      extraActions={[
        {
          /*
           * La reversión: el aviso de esta misma pantalla decía «lo que corresponde es
           * contabilizarlo o reversarlo» y sólo estaba lo primero. El endpoint y el
           * método del servicio existían; faltaba el botón, así que un asiento
           * contabilizado por error no tenía salida desde la consola.
           */
          key: 'reversar',
          label: 'Reversar',
          icon: 'undo',
          enabled: (row) => String(row.status ?? '').toUpperCase() === 'POSTED',
          form: {
            title: (row) => `Reversar ${String(row.documentNo ?? '')}`,
            description: 'Se crea un asiento CONTRARIO; el original no se toca. El número de la reversión y el período salen del sistema: el período es el que esté abierto para la fecha que pongas.',
            fields: [
              /*
               * Dos campos, no cuatro.
               *
               * El número lo asigna el backend (serie DOC-…) y el período lo dice la fecha de
               * reversión: pedirlo en un desplegable con TODOS los períodos dejaba reversar en
               * septiembre contra el período de julio, y era el usuario quien tenía que saber
               * cuál estaba abierto.
               */
              { name: 'reversalDate', label: 'Fecha de reversión', tooltip: 'Fecha con la que se contabiliza la reversión; tiene que caer en un período abierto.', type: 'date', required: true, span: 3 },
              { name: 'reason', label: 'Motivo', tooltip: 'Motivo breve del cambio; queda en la bitácora para que otro entienda por qué se hizo.', required: true, span: 3, placeholder: 'Documento cargado con la cuenta equivocada' },
            ],
            submit: (row, payload) => accountingService.reverseDocument(String(row.id ?? ''), payload),
            submitLabel: 'Reversar',
          },
        },
        {
          key: 'contabilizar',
          label: 'Contabilizar',
          icon: 'task_alt',
          run: (row) => accountingService.postDocument(String(row.id ?? '')),
          confirm: {
            title: 'Contabilizar el documento',
            message: 'El asiento pasa a firme y deja de poder editarse. Sólo podrá deshacerse con una reversión.',
            confirmLabel: 'Sí, contabilizar',
          },
        },
      ]}
    />
  );
}
