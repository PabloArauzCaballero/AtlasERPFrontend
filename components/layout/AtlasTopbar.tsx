'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/atlas/Icon';
import { useAuth } from '@/lib/authContext';

function initialsFrom(name: string | undefined): string {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '??';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
}

interface TopbarProps {
  /** Abre el cajón de navegación. Sólo se ofrece por debajo de `lg`. */
  onOpenNav?: () => void;
}

export function AtlasTopbar({ onOpenNav }: TopbarProps) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [search, setSearch] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  // En móvil la búsqueda no cabe junto al resto: se despliega en su propia fila
  // bajo la barra, en lugar de desaparecer —que es lo que hacía antes, dejando
  // el buscador global inalcanzable en cualquier pantalla estrecha.
  const [searchOpen, setSearchOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);

  // Un menú que sólo se cierra volviendo a pulsar su botón se queda abierto
  // encima del contenido en cuanto el usuario mira a otro sitio.
  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (searchOpen) searchInput.current?.focus();
  }, [searchOpen]);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = search.trim();
    setSearchOpen(false);
    router.push(value ? `/operaciones/admin/busqueda-global?q=${encodeURIComponent(value)}` : '/operaciones/admin/busqueda-global');
  }

  async function handleLogout() {
    setMenuOpen(false);
    await logout();
    router.replace('/login');
  }

  return (
    <header className="fixed left-0 right-0 top-0 z-50 border-b border-slate-200/80 bg-white/85 backdrop-blur-xl">
      <div className="flex h-16 items-center justify-between gap-2 px-3 sm:px-4 md:px-6">
        <div className="flex min-w-0 items-center gap-2 md:gap-6">
          <button
            type="button"
            onClick={onOpenNav}
            className="-ml-1 grid h-11 w-11 shrink-0 place-items-center rounded-md text-slate-600 hover:bg-slate-100 lg:hidden"
            aria-label="Abrir navegación"
          >
            <Icon name="menu" className="text-[22px]" />
          </button>
          <Link href="/operaciones" className="shrink-0 text-base font-black tracking-tight text-[#006a61] sm:text-lg">ATLAS ERP</Link>
          <form onSubmit={submit} className="hidden h-9 w-56 items-center gap-2 rounded-md border border-slate-200 bg-slate-50/80 px-3 focus-within:border-[#006a61] focus-within:bg-white md:flex lg:w-72">
            <Icon name="search" className="text-[19px] text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} className="min-w-0 flex-1 bg-transparent text-xs outline-none" placeholder="Buscar pantalla u operación..." />
            <kbd className="hidden rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[9px] font-bold text-slate-400 lg:inline">↵</kbd>
          </form>
        </div>
        <div className="flex shrink-0 items-center gap-0.5 sm:gap-1.5">
          <button
            type="button"
            onClick={() => setSearchOpen((open) => !open)}
            className="grid h-11 w-11 place-items-center rounded-full text-slate-600 hover:bg-slate-100 md:hidden"
            aria-label="Buscar"
            aria-expanded={searchOpen}
          >
            <Icon name={searchOpen ? 'close' : 'search'} className="text-[20px]" />
          </button>
          <Link href="/operaciones/contabilidad/documentos" className="mr-2 hidden h-9 items-center gap-2 rounded-md bg-[#006a61] px-3 text-xs font-bold text-white shadow-sm hover:bg-[#00544d] xl:flex">
            <Icon name="add" className="text-[17px]" />Nueva transacción
          </Link>
          <Link href="/operaciones/contabilidad/documentos" className="grid h-11 w-11 place-items-center rounded-full text-slate-600 hover:bg-slate-100 xl:hidden" aria-label="Nueva transacción">
            <Icon name="add" className="text-[20px]" />
          </Link>
          <Link href="/operaciones/admin/notificaciones" className="hidden h-11 w-11 place-items-center rounded-full text-slate-600 hover:bg-slate-100 sm:grid" aria-label="Notificaciones">
            <Icon name="notifications" className="text-[20px]" />
          </Link>
          <Link href="/operaciones/admin/seguridad" className="hidden h-11 w-11 place-items-center rounded-full text-slate-600 hover:bg-slate-100 sm:grid" aria-label="Seguridad">
            <Icon name="settings" className="text-[20px]" />
          </Link>
          <div className="relative ml-0.5 sm:ml-1" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              className="grid h-9 w-9 place-items-center rounded-full bg-[#00544d] text-[10px] font-black text-white ring-2 ring-slate-100"
              aria-label="Perfil de usuario"
              aria-expanded={menuOpen}
            >
              {initialsFrom(user?.fullName)}
            </button>
            {menuOpen ? (
              <div className="absolute right-0 top-11 w-[min(16rem,calc(100vw-1.5rem))] rounded-md border border-slate-200 bg-white p-2 text-xs shadow-lg">
                <div className="px-2 py-1.5">
                  <p className="truncate font-bold text-slate-800">{user?.fullName ?? 'Usuario'}</p>
                  <p className="truncate text-slate-500">{user?.email ?? ''}</p>
                  {user?.roles.length ? <p className="mt-1 truncate text-[10px] font-bold uppercase tracking-wide text-blue-700">{user.roles.join(', ')}</p> : null}
                </div>
                {/* En móvil estos dos accesos no caben en la barra; aquí sí. */}
                <Link href="/operaciones/admin/notificaciones" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 rounded-md px-2 py-2 font-semibold text-slate-600 hover:bg-slate-50 sm:hidden">
                  <Icon name="notifications" className="text-[16px]" />Notificaciones
                </Link>
                <Link href="/operaciones/admin/seguridad" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 rounded-md px-2 py-2 font-semibold text-slate-600 hover:bg-slate-50 sm:hidden">
                  <Icon name="settings" className="text-[16px]" />Seguridad
                </Link>
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
      </div>
      {searchOpen ? (
        <form onSubmit={submit} className="flex h-14 items-center gap-2 border-t border-slate-200/80 px-3 md:hidden">
          <Icon name="search" className="text-[19px] text-slate-400" />
          <input
            ref={searchInput}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            placeholder="Buscar pantalla u operación..."
          />
          <button type="submit" className="rounded-md bg-[#006a61] px-3 py-2 text-xs font-bold text-white">Buscar</button>
        </form>
      ) : null}
    </header>
  );
}
