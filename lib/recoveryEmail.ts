/**
 * El correo viaja entre el acceso y la recuperación por `sessionStorage`, nunca por la URL: un
 * correo en la query queda en el historial, en los registros del proxy y en el Referer.
 */
const KEY = 'atlas.erp.recovery-email';

export function rememberRecoveryEmail(email: string): void {
  try {
    if (email) window.sessionStorage.setItem(KEY, email);
    else window.sessionStorage.removeItem(KEY);
  } catch {
    /* almacenamiento bloqueado: sólo se pierde el autocompletado */
  }
}

export function takeRecoveryEmail(): string {
  try {
    const value = window.sessionStorage.getItem(KEY) ?? '';
    window.sessionStorage.removeItem(KEY);
    return value;
  } catch {
    return '';
  }
}
