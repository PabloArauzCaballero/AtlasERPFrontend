interface PageTitleProps {
  eyebrow: string;
  title: string;
  description: string;
}

export function PageTitle({ description, eyebrow, title }: PageTitleProps) {
  return (
    <div>
      <p className="text-sm font-semibold uppercase tracking-wide text-outline">{eyebrow}</p>
      <h1 className="text-3xl font-black text-primary">{title}</h1>
      <p className="mt-2 max-w-3xl text-on-surface-variant">{description}</p>
    </div>
  );
}
