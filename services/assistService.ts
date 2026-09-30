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

/** Una conversación de la lista del historial (Core devuelve las 30 más recientes, la última primero). */
export interface ResumenDeConversacion {
  conversationId: string;
  title: string | null;
  updatedAt: string;
  turnCount: number;
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
  /** Las conversaciones de esta persona. La superficie la fija la pasarela por el tipo de sesión. */
  async conversaciones(): Promise<ResumenDeConversacion[]> {
    const lista = await apiRequest<{ conversations?: ResumenDeConversacion[] } | null>('internal/assist/conversations');
    return lista?.conversations ?? [];
  },
  /** Una conversación con todos sus turnos, para abrirla y seguirla. */
  abrir(conversationId: string) {
    return apiRequest<ConversacionDelAsistente>(`internal/assist/conversations/${encodeURIComponent(conversationId)}`);
  },
  /** Borra una conversación del historial. */
  borrar(conversationId: string) {
    return apiRequest<{ deleted: number }>(`internal/assist/conversations/${encodeURIComponent(conversationId)}`, {
      method: 'DELETE',
    });
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
