import { apiRequest } from '@/lib/apiClient';
import { buildBackendQuery } from './query';
import type { PageQuery, PaginatedResult, ResourceRow } from './types';

const auditKeys = [
  'moduleCode',
  'businessProcess',
  'actionCode',
  'status',
  'aggregateType',
  'aggregateId',
  'actorUserId',
  'correlationId',
  'from',
  'to',
] as const;

export const auditService = {
  listBusinessActions(query: PageQuery) {
    return apiRequest<PaginatedResult<ResourceRow>>('/audit/business-actions', {
      query: buildBackendQuery(query, {
        pageSizeKey: 'pageSize',
        defaultPageSize: 25,
        allowedKeys: auditKeys,
      }),
    });
  },
};
