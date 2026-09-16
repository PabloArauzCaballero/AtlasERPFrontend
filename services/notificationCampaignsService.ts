import { apiRequest } from '@/lib/apiClient';
import { newUuid } from '@/lib/uuid';

/**
 * Campañas de notificación a clientes de la app: alta, audiencia, programación y resultados.
 *
 * El ERP es la consola; la campaña se ejecuta en AtlasBackend, que es donde viven los clientes, sus
 * dispositivos con avisos (Firebase/APNs), sus correos verificados y su consentimiento. Estas rutas
 * pasan por la pasarela `admin/notification-campaigns` del backend del ERP con el token del actor.
 *
 * Las acciones que crean o programan llevan `x-idempotency-key`, generada UNA vez por acción de la
 * persona: un doble clic o un reintento de red devuelve la misma campaña en vez de crear dos.
 */

export type CampaignStatus = 'draft' | 'scheduled' | 'running' | 'paused' | 'completed' | 'cancelled' | 'failed';
export type CampaignChannel = 'in_app' | 'push' | 'email';
export type CampaignPurpose = 'marketing' | 'operational';

export type AudienceAttribute =
  | 'city'
  | 'department'
  | 'lifecycleStatus'
  | 'hasCreditLine'
  | 'hasActiveLoan'
  | 'hasOverdueInstallment'
  | 'daysSinceSignup'
  | 'hasPushDevice'
  | 'pushPlatform'
  | 'hasVerifiedEmail'
  | 'marketingOptIn';
export type AudienceOperator = 'eq' | 'neq' | 'in' | 'not_in' | 'gte' | 'lte' | 'is_true' | 'is_false';

export interface AudienceRule {
  attribute: AudienceAttribute;
  operator: AudienceOperator;
  value?: string | number | string[];
}

export interface AudienceDefinition {
  match: 'all' | 'any';
  rules: AudienceRule[];
}

export interface AudienceEstimate {
  total: number;
  withPushDevice: number;
  withVerifiedEmail: number;
  estimatedAt: string;
  requiresMarketingConsent?: boolean;
}

export interface ChannelMetrics {
  channel: string;
  total: number;
  pending: number;
  delivered: number;
  failed: number;
  cancelled: number;
  read: number;
}

export interface CampaignMetrics {
  totals: Omit<ChannelMetrics, 'channel'>;
  channels: ChannelMetrics[];
}

export interface Campaign {
  id: string;
  campaignUuid: string;
  name: string;
  purpose: CampaignPurpose;
  status: CampaignStatus;
  title: string;
  body: string;
  category: string;
  icon: string | null;
  deepLink: string | null;
  channels: CampaignChannel[];
  audienceSegmentId: string | null;
  audience: AudienceDefinition;
  audienceEstimate: AudienceEstimate | null;
  startsAt: string | null;
  endsAt: string | null;
  timezone: string;
  ratePerMinute: number;
  maxRecipients: number | null;
  targetedCount: number;
  createdCount: number;
  materializedAt: string | null;
  createdBy: string | null;
  scheduledBy: string | null;
  scheduledAt: string | null;
  startedAt: string | null;
  pausedAt: string | null;
  finishedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string | null;
  metrics?: CampaignMetrics;
}

export interface CampaignInput {
  name: string;
  purpose: CampaignPurpose;
  title: string;
  body: string;
  category?: string;
  icon?: string | null;
  deepLink?: string | null;
  channels: CampaignChannel[];
  audienceSegmentId?: string | null;
  audience?: AudienceDefinition;
  startsAt?: string | null;
  endsAt?: string | null;
  ratePerMinute?: number;
  maxRecipients?: number | null;
}

export interface AudienceSegment {
  id: string;
  name: string;
  description: string | null;
  definition: AudienceDefinition;
  lastEstimate: AudienceEstimate | null;
  lastEstimatedAt: string | null;
  status: 'active' | 'archived';
  createdAt: string;
}

export interface CampaignMessage {
  id: string;
  recipientId: string;
  channel: string;
  status: string;
  scheduledAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  failedAt: string | null;
}

export interface Paged<T> {
  data: T[];
  pagination?: { page: number; limit: number; total: number; totalPages: number };
}

export interface TestSendResult {
  customerId: string;
  results: Array<{ channel: string; status: string; messageId: string; errorCode: string | null; errorMessage: string | null }>;
}

export type CampaignAction = 'schedule' | 'unschedule' | 'pause' | 'resume' | 'duplicate';

const BASE = '/admin/notification-campaigns';

export function newIdempotencyKey(): string {
  return `erp-campaign-${newUuid()}`;
}

function campaignPath(id: string, suffix = ''): string {
  if (!/^[1-9][0-9]*$/.test(id)) throw new Error('Identificador de campaña inválido.');
  return `${BASE}/${id}${suffix}`;
}

export const notificationCampaignsService = {
  list(query: { page?: number; limit?: number; status?: string; search?: string } = {}) {
    return apiRequest<Paged<Campaign>>(BASE, {
      query: { page: query.page ?? 1, limit: query.limit ?? 20, status: query.status || undefined, search: query.search || undefined },
    });
  },
  get(id: string) {
    return apiRequest<Campaign>(campaignPath(id));
  },
  messages(id: string, query: { page?: number; limit?: number; status?: string; channel?: string } = {}) {
    return apiRequest<Paged<CampaignMessage>>(campaignPath(id, '/messages'), {
      query: { page: query.page ?? 1, limit: query.limit ?? 25, status: query.status || undefined, channel: query.channel || undefined },
    });
  },
  create(input: CampaignInput, idempotencyKey: string) {
    return apiRequest<Campaign>(BASE, { method: 'POST', body: input, headers: { 'x-idempotency-key': idempotencyKey } });
  },
  update(id: string, input: Partial<CampaignInput>) {
    return apiRequest<Campaign>(campaignPath(id), { method: 'PATCH', body: input });
  },
  action(id: string, action: CampaignAction, idempotencyKey: string) {
    return apiRequest<Campaign>(campaignPath(id, `/${action}`), {
      method: 'POST',
      body: {},
      headers: { 'x-idempotency-key': idempotencyKey },
    });
  },
  cancel(id: string, reason: string) {
    return apiRequest<Campaign>(campaignPath(id, '/cancel'), { method: 'POST', body: { reason } });
  },
  testSend(id: string, customerId: string) {
    return apiRequest<TestSendResult>(campaignPath(id, '/test-send'), { method: 'POST', body: { customerId } });
  },
  estimate(input: { purpose: CampaignPurpose; audience?: AudienceDefinition; audienceSegmentId?: string | null }) {
    return apiRequest<AudienceEstimate>(`${BASE}/audience/estimate`, { method: 'POST', body: input });
  },
  segments(status: 'active' | 'archived' = 'active') {
    return apiRequest<Paged<AudienceSegment>>(`${BASE}/segments`, { query: { status } });
  },
  createSegment(input: { name: string; description?: string | null; definition: AudienceDefinition }) {
    return apiRequest<AudienceSegment>(`${BASE}/segments`, { method: 'POST', body: input });
  },
  updateSegment(id: string, input: { name?: string; description?: string | null; definition?: AudienceDefinition; status?: 'active' | 'archived' }) {
    if (!/^[1-9][0-9]*$/.test(id)) throw new Error('Identificador de segmento inválido.');
    return apiRequest<AudienceSegment>(`${BASE}/segments/${id}`, { method: 'PATCH', body: input });
  },
};
