import { request } from '../../shared/api/http'
import type { DatasetCreate, DatasetDetail, DatasetSource, DatasetSummary, TablePreview } from './types'

export const datasetKeys = {
  list: ['datasets'] as const,
  detail: (id: number | undefined) => ['dataset', id] as const,
  savedPreview: (id: number) => ['dataset-preview-saved', id] as const,
  preview: (connectionId: number | undefined, table: string | undefined) => ['dataset-preview', connectionId, table] as const,
}
export const datasetsApi = {
  list: (signal?: AbortSignal) => request<DatasetSummary[]>('/datasets', { signal }),
  get: (id: number, signal?: AbortSignal) => request<DatasetDetail>(`/datasets/${id}`, { signal }),
  remove: (id: number) => request<void>(`/datasets/${id}`, { method: 'DELETE' }),
  create: (input: DatasetCreate) => request<DatasetDetail>('/datasets', { body: input }),
  update: (id: number, body: { name: string; columnLabels: Record<string, string> }) => request<DatasetDetail>(`/datasets/${id}`, { method: 'PATCH', body }),
  previewSaved: (id: number, signal?: AbortSignal) => request<TablePreview>(`/datasets/${id}/preview`, { signal }),
  preview: (source: DatasetSource, signal?: AbortSignal) => request<TablePreview>('/datasets/preview', { body: source, signal }),
}
