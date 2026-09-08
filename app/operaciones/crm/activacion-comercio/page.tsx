import { redirect } from 'next/navigation';

/**
 * Retirada. Repetía la cola de Onboarding —mismo endpoint, mismas columnas, misma acción de
 * fila «Activar comercio»— con un desplegable al lado para elegir el caso otra vez. Dos pantallas
 * para una cola era la duplicación de responsabilidades vista desde dentro del propio ERP.
 *
 * Se activa desde la fila del caso, en Onboarding, que es donde está el expediente. La ruta se
 * conserva sólo para no romper enlaces guardados.
 */
export default function ActivationPage() {
  redirect('/operaciones/crm/onboarding');
}
