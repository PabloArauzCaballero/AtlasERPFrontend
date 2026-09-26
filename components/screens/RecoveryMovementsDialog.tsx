'use client';

import { useCallback, useState } from 'react';
import { Modal } from '@/components/atlas/Modal';
import { conMensajesDeCobertura, importeLegible } from '@/lib/coberturaBnpl';
import { b2bService } from '@/services/b2bService';
import type { JsonObject, ResourceRow } from '@/services/types';
import { CrudDirectory } from './CrudDirectory';

const TIPO: Record<string, string> = { PAYMENT: 'Cobro', REVERSAL: 'Reverso' };

/**
 * Los cobros de una recuperación, y el reverso de uno.
 *
 * Un cobro aplicado no se edita ni se borra: si fue un error (se cargó a otro cliente, el banco lo
 * devolvió), se revierte con un movimiento que lo compensa y lo recuperado baja en la misma cifra.
 * Aquí se ven los dos, en el orden en que se registraron, y cada cobro todavía vigente ofrece
 * «Revertir» con su referencia y su motivo.
 */
export function RecoveryMovementsDialog({
  recovery,
  onClose,
  onChanged,
}: Readonly<{ recovery: ResourceRow; onClose: () => void; onChanged: () => void }>) {
  const recoveryId = String(recovery.id ?? '');
  const [version, setVersion] = useState(0);
  const cargar = useCallback(async () => {
    const filas = await b2bService.listRecoveryMovements(recoveryId);
    const revertidos = new Set(filas.map((fila) => String(fila.reversesMovementId ?? '')).filter(Boolean));
    return filas.map((fila) => ({
      ...fila,
      tipo: TIPO[String(fila.movementType ?? '')] ?? String(fila.movementType ?? ''),
      revertido: revertidos.has(String(fila.id ?? '')),
      situacion: fila.movementType === 'REVERSAL' ? 'Compensa un cobro anterior' : revertidos.has(String(fila.id ?? '')) ? 'Revertido' : 'Vigente',
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recoveryId, version]);

  async function revertir(fila: ResourceRow, payload: JsonObject) {
    const resultado = await conMensajesDeCobertura(() =>
      b2bService.reverseRecoveryMovement(recoveryId, String(fila.id ?? ''), {
        reversalReference: String(payload.reversalReference ?? '').trim(),
        reason: String(payload.reason ?? '').trim(),
      }),
    );
    setVersion((valor) => valor + 1);
    onChanged();
    return resultado;
  }

  return (
    <Modal
      open
      title="Cobros de la recuperación"
      description={`Cubierto por Atlas ${importeLegible(recovery.amountCoveredByAtlas, recovery.currency)} · recuperado ${importeLegible(recovery.amountRecovered ?? '0', recovery.currency)}`}
      icon="receipt_long"
      width="lg"
      onClose={onClose}
    >
      <CrudDirectory
        embedded
        moduleLabel="CRM"
        title="Movimientos"
        description="Cada cobro del cliente y cada reverso, en el orden en que se registraron."
        load={cargar}
        labelKey="paymentReference"
        searchPlaceholder="Buscar por referencia…"
        emptyHint="Todavía no se aplicó ningún cobro a esta recuperación."
        columns={[
          { key: 'tipo', label: 'Movimiento' },
          { key: 'paymentReference', label: 'Referencia' },
          { key: 'amount', label: 'Importe', kind: 'money', align: 'right' },
          { key: 'receivedAt', label: 'Fecha', kind: 'date' },
          { key: 'situacion', label: 'Situación' },
          { key: 'reason', label: 'Motivo' },
        ]}
        extraActions={[
          {
            key: 'revertir',
            label: 'Revertir cobro',
            icon: 'undo',
            tone: 'danger',
            /* Sólo un cobro que sigue vigente: un reverso no se revierte y un cobro se revierte una vez. */
            enabled: (fila) => fila.movementType === 'PAYMENT' && !fila.revertido,
            form: {
              title: (fila) => `Revertir el cobro ${String(fila.paymentReference ?? '')}`,
              description:
                'El cobro no se borra: se registra un movimiento que lo compensa y lo recuperado baja en el mismo importe. Úselo si el cobro se cargó por error o el banco lo devolvió.',
              submitLabel: 'Revertir cobro',
              fields: (fila) => [
                { name: 'reversalReference', label: 'Referencia del reverso', tooltip: 'Identifica este reverso; no puede repetir la de otro cobro. Sugerimos la del cobro con «REV-» delante.', required: true, span: 2, defaultValue: `REV-${String(fila.paymentReference ?? '')}`.slice(0, 120) },
                { name: 'reason', label: 'Motivo', tooltip: 'Por qué se revierte (p. ej. el banco devolvió la transferencia). Queda en el historial. Mínimo 3 caracteres.', type: 'textarea', required: true, span: 2 },
              ],
              submit: revertir,
            },
          },
        ]}
      />
    </Modal>
  );
}
