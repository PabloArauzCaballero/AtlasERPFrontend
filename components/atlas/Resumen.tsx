import { cn } from '@/lib/cn';

export interface DatoDeResumen {
  label: string;
  value: React.ReactNode;
  /** Pinta el valor en ámbar cuando hay algo que atender (mora, saldo vencido). */
  alerta?: boolean | undefined;
}

/**
 * Los números de una pantalla, en UNA línea.
 *
 * Sustituye a la rejilla de `MetricCard`. Aquella pintaba cada dato como una tarjeta de 112 px de
 * alto con icono, degradado, sombra y halo al pasar el ratón: cuatro datos ocupaban media pantalla
 * y empujaban fuera de la vista la tabla, que es a lo que de verdad se viene. Peor aún, la tarjeta
 * daba el mismo peso visual a un dato que importa («Bs 12.400 vencidos») y a uno que no («Comercio
 * —», «Quién fija las cuotas: el motor»), así que el ruido parecía información.
 *
 * Aquí un dato es una etiqueta y un número, separados por una línea fina. Se lee de corrido, cabe
 * en una fila y no compite con el contenido. Sin iconos a propósito: un icono por dato es una
 * decisión de diseño por dato, y ninguno de ellos aportaba significado que la etiqueta no diera ya.
 *
 * Cuando un dato NO aporta —repite el título de la pantalla, o es una constante— no va aquí: se
 * quita. Esta pieza es para números, no para frases.
 */
export function Resumen({ datos, className }: Readonly<{ datos: DatoDeResumen[]; className?: string }>) {
  if (!datos.length) return null;
  return (
    <dl
      data-tutorial-id="resumen"
      className={cn(
        'flex flex-wrap items-stretch gap-x-6 gap-y-3 rounded-lg border border-slate-200 bg-white px-4 py-3',
        className,
      )}
    >
      {datos.map((dato) => (
        <div
          key={dato.label}
          /*
           * La línea divisoria sólo desde `sm`. En una columna —a 320 px la tira dobla y cada dato
           * ocupa su fila— el `first:` sólo alcanza al PRIMERO de todos, así que los demás
           * conservaban su borde y su sangría y se leían como una lista anidada bajo el primero.
           * Apilados no hace falta separador: el hueco ya separa.
           */
          className="min-w-0 flex-1 basis-36 sm:border-l sm:border-slate-100 sm:pl-3 sm:first:border-l-0 sm:first:pl-0"
        >
          <dt className="truncate text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{dato.label}</dt>
          <dd className={cn('mt-0.5 truncate text-lg font-bold tabular-nums tracking-tight', dato.alerta ? 'text-amber-700' : 'text-slate-900')}>
            {dato.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
