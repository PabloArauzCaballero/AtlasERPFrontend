'use client';

import { Icon } from '@/components/atlas/Icon';
import { StatusPill } from '@/components/atlas/StatusPill';
import {
  REQUIREMENT_LABELS,
  type PartnerQrCode,
  type SubmissionGap,
} from '@/services/partnerOnboardingService';

/**
 * Las piezas de lectura del expediente: lo que falta y los QR registrados.
 *
 * Los terminales ya no se pintan aquí. Vivían en una tabla propia —serial, alias, sucursal— y esa
 * columna «sucursal» era la señal de que estaban en el sitio equivocado: un terminal no se entiende
 * suelto, se entiende dentro del local donde está enchufado. Ahora cuelgan de su sucursal, en
 * `PartnerDossierScreen`.
 *
 * Viven aparte de la pantalla porque son lo que se MIRA, no lo que se opera, y separarlas deja la
 * pantalla con una sola responsabilidad: los formularios y su estado.
 */

/** El estado de un QR o de un terminal, en el tono que le corresponde. */
function toneForStatus(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'active') return 'success';
  if (status === 'pending_review' || status === 'registered') return 'warning';
  if (status === 'rejected' || status === 'suspended') return 'danger';
  return 'neutral';
}

/**
 * Lo que le falta al expediente.
 *
 * Se enseña SIEMPRE mientras se completa el trámite y no sólo al intentar enviarlo: descubrir los
 * requisitos de uno en uno, a base de envíos rechazados, es lo que convierte un trámite en una
 * pelea. Va en ámbar y no en rojo — no ha fallado nada, falta terminar.
 */
export function SubmissionGaps({ gaps, ready }: Readonly<{ gaps: SubmissionGap[]; ready: boolean }>) {
  if (ready) {
    return (
      <div
        data-testid="expediente-listo"
        className="flex items-start gap-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800"
      >
        <Icon name="task_alt" className="text-[18px]" />
        <p>El expediente reúne todo lo necesario. Al enviarlo queda en revisión: la aprobación la firma una persona.</p>
      </div>
    );
  }

  return (
    <div data-testid="expediente-pendientes" className="rounded-md border border-amber-200 bg-amber-50 p-3">
      <p className="flex items-center gap-2 text-xs font-bold text-amber-900">
        <Icon name="checklist" className="text-[18px]" />
        Falta {gaps.length} {gaps.length === 1 ? 'requisito' : 'requisitos'} para enviar a revisión
      </p>
      <ul className="mt-2 space-y-1">
        {gaps.map((gap) => (
          <li key={gap.requirement} className="text-xs text-amber-800" data-requirement={gap.requirement}>
            · <strong>{REQUIREMENT_LABELS[gap.requirement] ?? gap.requirement}</strong> — {gap.detail}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Los QR del comercio, con su historial.
 *
 * Se listan también los REEMPLAZADOS, y no es ruido: si un cobro salió mal hay que poder
 * reconstruir contra qué QR se cobró ese día. La huella es el prefijo del hash del archivo, que
 * identifica la evidencia sin publicarla.
 */
export function QrList({ codes }: Readonly<{ codes: PartnerQrCode[] }>) {
  if (codes.length === 0) {
    return <p className="text-xs text-slate-500">Todavía no se subió ningún QR.</p>;
  }

  return (
    <table className="w-full text-left text-xs" data-testid="tabla-qr">
      <thead className="text-[10px] uppercase tracking-wide text-slate-500">
        <tr>
          <th className="py-1">Tipo</th>
          <th className="py-1">Entidad</th>
          <th className="py-1">Cuenta</th>
          <th className="py-1">Huella</th>
          <th className="py-1">Estado</th>
        </tr>
      </thead>
      <tbody>
        {codes.map((qr) => (
          <tr key={qr.qrId} className="border-t border-slate-100" data-qr-kind={qr.qrKind}>
            <td className="py-1.5 font-semibold">{qr.qrKind === 'bank' ? 'Bancario' : 'Del negocio'}</td>
            <td className="py-1.5">{qr.bankInstitutionCode ?? '—'}</td>
            <td className="py-1.5 font-mono">{qr.accountNumberMasked ?? '—'}</td>
            <td className="py-1.5 font-mono text-slate-500">{qr.fingerprint}</td>
            <td className="py-1.5">
              <StatusPill tone={toneForStatus(qr.status)}>{qr.status}</StatusPill>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
