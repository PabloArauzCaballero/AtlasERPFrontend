import { newUuid } from './uuid';

/**
 * Un identificador por operación, para que lo que hace este portal se pueda seguir en el backend.
 *
 * ## Qué resuelve
 *
 * AtlasBackend guarda `x-correlation-id` en `system_action_logs` y expone
 * `GET systems/action-logs/request/:requestId`. El portal interno lo genera desde la fase 3; este
 * portal y la app no, así que sus peticiones eran las únicas del ecosistema que no se podían atar a
 * nada: ante un fallo reportado por un comercio, no había forma de encontrar la fila.
 *
 * ## Por qué este formato
 *
 * El backend sólo acepta el valor entrante si cumple `/^[A-Za-z0-9_-]{1,64}$/`; lo que no encaje se
 * descarta y se genera otro del lado del servidor, con lo que la correlación se pierde en silencio.
 * Un UUID v4 encaja, y `newUuid` lo da también sin origen seguro.
 */
export function newCorrelationId(): string {
  return newUuid();
}
