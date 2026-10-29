import { request } from '../../shared/api/http'
import type { ColumnInfo, ConnectionInput, ConnectionView, TestResult } from './types'

export const connectionKeys = {
  list: ['connections'] as const,
  tables: (id: number | undefined) => ['connection', id, 'tables'] as const,
  columns: (id: number | undefined, table: string) => ['connection', id, 'columns', table] as const,
}

export const connectionsApi = {
  list: (signal?: AbortSignal) => request<ConnectionView[]>('/connections', { signal }),
  remove: (id: number) => request<void>(`/connections/${id}`, { method: 'DELETE' }),
  tables: (id: number, signal?: AbortSignal) => request<string[]>(`/connections/${id}/tables`, { signal }),
  columns: (id: number, table: string, signal?: AbortSignal) =>
    request<ColumnInfo[]>(`/connections/${id}/columns?table=${encodeURIComponent(table)}`, { signal }),
  // Password-bearing inputs use direct calls, not query/mutation caches.
  test: (input: ConnectionInput) => request<TestResult>('/connections/test', { body: input }),
  update: (id: number, input: ConnectionInput) => request<ConnectionView>(`/connections/${id}`, { method: 'PUT', body: input }),
  save: (input: ConnectionInput) => request<ConnectionView>('/connections', { body: input }),
  retest: (id: number) => request<TestResult>(`/connections/${id}/test`, { body: {} }),
}
