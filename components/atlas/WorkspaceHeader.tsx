import Link from 'next/link';
import { Icon } from './Icon';

interface WorkspaceHeaderProps {
  eyebrow?: string;
  title: string;
  description: string;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  actions?: React.ReactNode;
}

export function WorkspaceHeader({ eyebrow, title, description, breadcrumbs = [], actions }: WorkspaceHeaderProps) {
  return (
    <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div className="min-w-0">
        {breadcrumbs.length ? (
          <nav aria-label="Migas de pan" className="mb-2 flex flex-wrap items-center gap-1.5 text-xs font-semibold text-slate-500">
            {breadcrumbs.map((item, index) => (
              <span key={`${item.label}-${index}`} className="flex items-center gap-1.5">
                {index ? <Icon name="chevron_right" className="text-[14px]" /> : null}
                {item.href ? <Link href={item.href} className="hover:text-slate-900">{item.label}</Link> : <span className="text-slate-800">{item.label}</span>}
              </span>
            ))}
          </nav>
        ) : null}
        {eyebrow ? <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">{eyebrow}</p> : null}
        <h1 className="text-2xl font-bold tracking-tight text-[#031636] md:text-[30px] md:leading-[38px]">{title}</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">{description}</p>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
