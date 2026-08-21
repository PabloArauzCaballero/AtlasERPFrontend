interface PageTitleProps {
  eyebrow: string;
  title: string;
  description: string;
}

export function PageTitle({ description, eyebrow, title }: PageTitleProps) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-outline sm:text-sm">{eyebrow}</p>
      {/* La escala se recompone en móvil en vez de encogerse: 30 px de título en 360 px de ancho
          parte en tres líneas y empuja el contenido fuera de la primera pantalla. */}
      <h1 className="text-pretty text-2xl font-black leading-tight text-primary sm:text-3xl">{title}</h1>
      <p className="mt-2 max-w-3xl text-sm text-on-surface-variant sm:text-base">{description}</p>
    </div>
  );
}
