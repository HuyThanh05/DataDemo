import { request } from '../../shared/api/http'
import type { SavedChart } from '../charts/types'
import type { ChartPreviewResult } from '../charts/types'

export type Dashboard = { id: number; name: string }
export type DashboardLayoutItem = { chartId: number; x: number; y: number; w: number; h: number }
export type DashboardFilter = { datasetId: number | null; column: string | null; value: string | null }
export const dashboardKeys = { list: ['dashboards'] as const, detail: (id: number | undefined) => ['dashboard', id] as const, charts: (id: number) => ['dashboard-charts',id] as const, layout: (id: number) => ['dashboard-layout',id] as const, filter: (id: number) => ['dashboard-filter',id] as const }
export const dashboardsApi = {
  list: (signal?: AbortSignal) => request<Dashboard[]>('/dashboards', { signal }),
  get: (id: number, signal?: AbortSignal) => request<Dashboard>(`/dashboards/${id}`, { signal }),
  save: (id: number | undefined, name: string) => request<Dashboard>(id ? `/dashboards/${id}` : '/dashboards', { method: id ? 'PATCH' : 'POST', body: { name } }),
  charts: (id: number, signal?: AbortSignal) => request<SavedChart[]>(`/dashboards/${id}/charts`, { signal }),
  addChart: (id: number, chartId: number) => request<SavedChart[]>(`/dashboards/${id}/charts`, { body: { chartId } }),
  removeChart: (id: number, chartId: number) => request<SavedChart[]>(`/dashboards/${id}/charts/${chartId}`, { method: 'DELETE' }),
  layout: (id: number, signal?: AbortSignal) => request<DashboardLayoutItem[]>(`/dashboards/${id}/layout`, { signal }),
  saveLayout: (id: number, items: DashboardLayoutItem[]) => request<DashboardLayoutItem[]>(`/dashboards/${id}/layout`, { method: 'PUT', body: { items } }),
  filter: (id: number, signal?: AbortSignal) => request<DashboardFilter>(`/dashboards/${id}/filter`, { signal }),
  saveFilter: (id: number, body: DashboardFilter) => request<DashboardFilter>(`/dashboards/${id}/filter`, { method: 'PUT', body }),
  filterValues: (id: number, datasetId: number, column: string, signal?: AbortSignal) => request<{ values: string[]; truncated: boolean }>(`/dashboards/${id}/filter-values?${new URLSearchParams({ datasetId:String(datasetId),column })}`, { signal }),
  previewChart: (id: number, chartId: number, signal?: AbortSignal) => request<ChartPreviewResult>(`/dashboards/${id}/charts/${chartId}/preview`, { signal }),
}
