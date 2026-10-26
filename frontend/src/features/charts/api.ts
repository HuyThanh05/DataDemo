import { request } from '../../shared/api/http'
import type { ChartConfiguration, ChartPreviewResult, SavedChart } from './types'

export const chartsApi = {
  list: (signal?: AbortSignal) => request<SavedChart[]>('/charts', { signal }),
  get: (id: number, signal?: AbortSignal) => request<SavedChart>(`/charts/${id}`, { signal }),
  save: (id: number | undefined, name: string, configuration: ChartConfiguration) => request<SavedChart>(id ? `/charts/${id}` : '/charts', { method: id ? 'PATCH' : 'POST', body: { name, configuration: { ...configuration, filters: configuration.filters.map(({ column, operator, value }) => ({ column, operator, value })) } } }),
  preview: (configuration: ChartConfiguration, signal?: AbortSignal) => request<ChartPreviewResult>('/charts/preview', {
    signal,
    body: { ...configuration, filters: configuration.filters.map(({ column, operator, value }) => ({ column, operator, value })) },
  }),
}
