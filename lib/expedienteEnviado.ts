/**
 * ¿El expediente del comercio ya salió de la mano del comercio?
 *
 * `under_review` (enviado, esperando a un analista) y `approved` (firmado) no admiten reenvío: el
 * backend responde 422 `PARTNER_NOT_EDITABLE_IN_STATUS`. Ofrecer el botón igualmente invitaba a
 * pulsarlo para recibir un error. Se espeja aquí sólo lo evidente; los demás estados (borrador,
 * contacto verificado, documentos enviados, rechazado) los sigue decidiendo el backend.
 */
export function expedienteYaEnviado(estado: string | null | undefined): boolean {
  return estado === 'under_review' || estado === 'approved';
}
