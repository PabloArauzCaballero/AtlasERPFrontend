'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/atlas/Icon';
import { cn } from '@/lib/cn';

export interface CollapsibleNavItem {
  label: string;
  href: string;
  icon: string;
}

interface CollapsibleNavGroupProps {
  label: string;
  icon: string;
  items: CollapsibleNavItem[];
  /** Colapsado por defecto salvo que la ruta activa esté dentro del grupo. */
  defaultOpen?: boolean;
}

/**
 * Sub-grupo colapsable dentro del sidebar (Tailwind puro, sin librería).
 * Se auto-expande si la ruta actual pertenece a alguno de sus ítems.
 */
export function CollapsibleNavGroup({ label, icon, items, defaultOpen = false }: CollapsibleNavGroupProps) {
  const pathname = usePathname();
  const containsActive = items.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
  const [open, setOpen] = useState(defaultOpen || containsActive);

  return (
    <div className="rounded-md">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className={cn(
          'flex w-full items-center gap-3 rounded-md px-3 py-2 text-xs font-semibold transition-colors',
          containsActive ? 'text-[#031636]' : 'text-slate-600 hover:bg-white hover:text-[#031636]',
        )}
      >
        <Icon name={icon} className={cn('text-[18px]', containsActive ? 'text-blue-500' : 'text-slate-400')} />
        <span className="flex-1 truncate text-left">{label}</span>
        <Icon name={open ? 'expand_less' : 'expand_more'} className="text-[18px] text-slate-400" />
      </button>
      {open ? (
        <div className="mt-0.5 space-y-0.5 border-l border-slate-200 pl-3">
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-xs font-semibold transition-colors',
                  active ? 'bg-[#1a2b4c] text-white shadow-sm' : 'text-slate-600 hover:bg-white hover:text-[#031636]',
                )}
              >
                <Icon name={item.icon} className={cn('text-[16px]', active ? 'text-blue-200' : 'text-slate-400')} />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
