'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Icon } from '@/components/atlas/Icon';
import { useAuth } from '@/lib/authContext';

function initialsFrom(name: string | undefined): string {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '??';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
}

export function AtlasTopbar() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [search, setSearch] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = search.trim();
    router.push(value ? `/operaciones/admin/busqueda-global?q=${encodeURIComponent(value)}` : '/operaciones/admin/busqueda-global');
  }

  async function handleLogout() {
    setMenuOpen(false);
    await logout();
    router.replace('/login');
  }

  return (
    <header className="fixed left-0 right-0 top-0 z-50 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 md:px-6">
      <div className="flex min-w-0 items-center gap-6">
        <Link href="/operaciones" className="shrink-0 text-lg font-black tracking-tight text-[#006a61]">ATLAS ERP</Link>
        <form onSubmit={submit} className="hidden h-9 w-72 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 focus-within:border-[#006a61] focus-within:bg-white md:flex">
          <Icon name="search" className="text-[19px] text-slate-400" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} className="min-w-0 flex-1 bg-transparent text-xs outline-none" placeholder="Buscar pantalla u operación..." />
          <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[9px] font-bold text-slate-400">↵</kbd>
        </form>
      </div>
      <div className="flex items-center gap-1.5">
        <Link href="/operaciones/contabilidad/documentos" className="mr-2 hidden h-9 items-center gap-2 rounded-md bg-[#006a61] px-3 text-xs font-bold text-white shadow-sm hover:bg-[#00544d] sm:flex">
          <Icon name="add" className="text-[17px]" />Nueva transacción
        </Link>
        <Link href="/operaciones/admin/notificaciones" className="relative grid h-9 w-9 place-items-center rounded-full text-slate-600 hover:bg-slate-100" aria-label="Notificaciones">
          <Icon name="notifications" className="text-[20px]" />
        </Link>
        <Link href="/operaciones/admin/seguridad" className="grid h-9 w-9 place-items-center rounded-full text-slate-600 hover:bg-slate-100" aria-label="Seguridad">
          <Icon name="settings" className="text-[20px]" />
        </Link>
        <div className="relative ml-1">
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="grid h-8 w-8 place-items-center rounded-full bg-[#00544d] text-[10px] font-black text-white ring-2 ring-slate-100"
            aria-label="Perfil de usuario"
          >
            {initialsFrom(user?.fullName)}
          </button>
          {menuOpen ? (
            <div className="absolute right-0 top-10 w-56 rounded-md border border-slate-200 bg-white p-2 text-xs shadow-lg">
              <div className="px-2 py-1.5">
                <p className="truncate font-bold text-slate-800">{user?.fullName ?? 'Usuario'}</p>
                <p className="truncate text-slate-500">{user?.email ?? ''}</p>
                {user?.roles.length ? <p className="mt-1 truncate text-[10px] font-bold uppercase tracking-wide text-blue-700">{user.roles.join(', ')}</p> : null}
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="mt-1 flex w-full items-center gap-2 rounded-md px-2 py-2 text-left font-semibold text-red-600 hover:bg-red-50"
              >
                <Icon name="logout" className="text-[16px]" />Cerrar sesión
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
