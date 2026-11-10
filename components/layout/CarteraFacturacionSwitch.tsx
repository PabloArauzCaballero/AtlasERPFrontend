import Link from 'next/link';
import { cn } from '@/lib/cn';

const SECCIONES = [
  { href: '/portal-comercio/cartera', label: 'Mi cartera' },
  { href: '/portal-comercio/facturacion', label: 'Consumo y facturación' },
] as const;

/** Las dos mitades de «Cartera y facturación»: una entrada del menú, dos vistas hermanas. */
export function CarteraFacturacionSwitch({ actual }: Readonly<{ actual: (typeof SECCIONES)[number]['href'] }>) {
  return (
    <div role="tablist" aria-label="Cartera y facturación" className="mb-4 inline-flex rounded-md bg-surface-sunken p-1">
      {SECCIONES.map((s) => (
        <Link
          key={s.href}
          href={s.href}
          role="tab"
          aria-selected={s.href === actual}
          className={cn('rounded px-4 py-2 text-xs font-semibold transition-colors', s.href === actual ? 'bg-white text-primary' : 'text-slate-600 hover:text-slate-900')}
        >
          {s.label}
        </Link>
      ))}
    </div>
  );
}
