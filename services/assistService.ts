import { apiRequest } from '@/lib/apiClient';
import { conReintentoEnCurso } from '@/lib/asistente';

/**
 * El asistente, visto desde el ERP.
 *
 * Va por el backend del ERP como todo lo demás (`/internal/assist/*`): el navegador nunca habla
 * con AtlasBackend. Esa pasarela reenvía con el token de la sesión y fija la superficie —comercio o
 * personal— por el tipo de sesión; por eso aquí no viaja ninguna.
 */
export interface RespuestaDelAsistente {
  reply: string;
  suggestHandoff: boolean;
  conversationId: string;
  turnId: string;
  /** `sin-ia`: el texto sale de la guía, sin modelo de lenguaje. */
  mode?: 'sin-ia';
}

export interface TurnoDelAsistente {
  turnId: string;
  prompt: string;
  reply: string;
  suggestHandoff: boolean;
  createdAt: string;
  mode?: 'sin-ia';
}

export interface ConversacionDelAsistente {
  conversationId: string | null;
  turns: TurnoDelAsistente[];
}

export interface PreguntaAlAsistente {
  prompt: string;
  /** UUID v4. La MISMA en cada reintento: es lo que evita generar dos respuestas. */
  clientMessageId: string;
  conversationId?: string;
  screen?: string;
}

/** Detrás hay un modelo de lenguaje: una respuesta lenta no es una caída. */
const PLAZO_DE_RESPUESTA_MS = 45_000;

export const assistService = {
  conversacion() {
    return apiRequest<ConversacionDelAsistente | null>('internal/assist/conversation');
  },
  preguntar(pregunta: PreguntaAlAsistente, opciones: { dormir?: (ms: number) => Promise<void> } = {}) {
    return conReintentoEnCurso(
      () =>
        apiRequest<RespuestaDelAsistente>('internal/assist/chat', {
          method: 'POST',
          body: pregunta,
          timeoutMs: PLAZO_DE_RESPUESTA_MS,
          // La llave es el `clientMessageId`: Core reconoce la repetición y devuelve la respuesta
          // guardada, así que el cliente puede repetirla si el backend no estaba (ver `reintentos.ts`).
          headers: { 'x-idempotency-key': pregunta.clientMessageId },
        }),
      opciones,
    );
  },
};
