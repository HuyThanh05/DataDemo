import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { createQueryClient } from '../../../app/queryClient'
import DashboardPage from './DashboardPage'
import type { Dashboard } from '../api'

function mount(path: string) {
  return render(<QueryClientProvider client={createQueryClient()}><MemoryRouter initialEntries={[path]}><DashboardPage /></MemoryRouter></QueryClientProvider>)
}
describe('dashboard editor', () => {
  it('creates, reopens and renames a persisted dashboard', async () => {
    let stored: Dashboard | undefined
    const fetch = vi.fn(async (path: string, options?: RequestInit) => {
      if(path.endsWith('/filter')) return new Response(JSON.stringify({ datasetId:null,column:null,value:null }))
      if(path === '/api/datasets') return new Response('[]')
      if (path === '/api/charts' || path.endsWith('/charts') || path.endsWith('/layout')) return new Response('[]')
      if (options?.method === 'POST' || options?.method === 'PATCH') {
        stored = { id: 91, name: JSON.parse(String(options.body)).name.trim() }
        return new Response(JSON.stringify(stored),{ status: options.method === 'POST' ? 201 : 200 })
      }
      return new Response(JSON.stringify(path === '/api/dashboards' ? stored ? [stored] : [] : stored))
    })
    vi.stubGlobal('fetch',fetch)
    const first = mount('/dashboards')
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Tên dashboard'),'Điểm thi')
    await user.click(screen.getByRole('button',{ name: 'Lưu dashboard' }))
    expect(await screen.findByText('Dashboard đã được lưu.')).toBeTruthy()
    first.unmount()
    mount('/dashboards?dashboardId=91')
    expect(await screen.findByDisplayValue('Điểm thi')).toBeTruthy()
    await user.clear(screen.getByLabelText('Tên dashboard'))
    await user.type(screen.getByLabelText('Tên dashboard'),'Tên mới')
    await user.click(screen.getByRole('button',{ name: 'Lưu dashboard' }))
    expect(await screen.findByText('Dashboard đã được lưu.')).toBeTruthy()
    expect(fetch.mock.calls.some(([path,options]) => path === '/api/dashboards/91' && options?.method === 'PATCH')).toBe(true)
    expect(stored?.name).toBe('Tên mới')
  },15000)
  it('rejects an invalid route without fetching its detail', async () => {
    const fetch = vi.fn(async (path: string) => new Response(path === '/api/dashboards' ? '[]' : 'null'))
    vi.stubGlobal('fetch',fetch)
    mount('/dashboards?dashboardId=invalid')
    expect(screen.getByText('Mã dashboard không hợp lệ.')).toBeTruthy()
    expect(fetch.mock.calls.every(call => String(call[0]) === '/api/dashboards')).toBe(true)
  })
})
