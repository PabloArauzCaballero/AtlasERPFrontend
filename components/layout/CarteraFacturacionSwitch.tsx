import Link from 'next/link';
import { cn } from '@/lib/cn';

const SECCIONES = [
  { href: '/portal-comercio/cartera', label: 'Mi cartera' },
  { href: '/portal-comercio/facturacion', label: 'Consumo y facturación' },
] as const;

/** Las dos mitades de «Cartera y facturación»: una entrada del menú, dos vistas hermanas. */
export function CarteraFacturacionSwitch({ actual }: Readonly<{ actual: (typeof SECCIONES)[number]['href'] }>) {
  return (
    <div role="tablist" aria-label="Cartera y facturación" className="mb-4 inline-flex rounded-lg bg-slate-100 p-1">
      {SECCIONES.map((s) => (
        <Link
          key={s.href}
          href={s.href}
          role="tab"
          aria-selected={s.href === actual}
          className={cn('rounded-md px-4 py-2 text-xs font-semibold transition', s.href === actual ? 'bg-white text-[#006a61] shadow-sm' : 'text-slate-600 hover:text-[#006a61]')}
        >
          {s.label}
        </Link>
      ))}
    </div>
  );
}
