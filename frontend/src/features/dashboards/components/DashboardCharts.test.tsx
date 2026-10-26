import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { createQueryClient } from '../../../app/queryClient'
import DashboardCharts from './DashboardCharts'
import type { SavedChart } from '../../charts/types'

vi.mock('echarts-for-react',() => ({ default: () => <div data-testid="dashboard-echarts" /> }))
const chart: SavedChart = { id: 17, name: 'Phổ điểm', configuration: { datasetId: 8, chartType: 'bar', dimension: 'score', metricColumn: 'score', aggregation: 'COUNT', sortDirection: 'ASC', filters: [] } }
function mount(id = 91) {
  return render(<QueryClientProvider client={createQueryClient()}><MemoryRouter><DashboardCharts dashboardId={id} /></MemoryRouter></QueryClientProvider>)
}
describe('dashboard chart membership',() => {
  it('adds, restores and removes a chart while leaving the saved chart available to add again',async () => {
    let linked: SavedChart[] = []
    const fetch = vi.fn(async (path: string,options?: RequestInit) => {
      if(path === '/api/charts') return new Response(JSON.stringify([chart]))
      if(path === '/api/dashboards/91/filter') return new Response(JSON.stringify({ datasetId:null,column:null,value:null }))
      if(path === '/api/datasets') return new Response(JSON.stringify([{ id:8,name:'Điểm thi' }]))
      if(path === '/api/dashboards/91/layout') return new Response(JSON.stringify(linked.map(item=>({ chartId:item.id,x:0,y:0,w:6,h:12 }))))
      if(path === '/api/dashboards/91/charts' && options?.method === 'POST') linked = [chart]
      if(path === '/api/dashboards/91/charts/17' && options?.method === 'DELETE') linked = []
      if(path==='/api/dashboards/91/charts' || path==='/api/dashboards/91/charts/17') return new Response(JSON.stringify(linked))
      if(path === '/api/datasets/8') return new Response(JSON.stringify({ id: 8, columns: [{ name: 'score',displayName: 'Điểm thi' }] }))
      if(path === '/api/dashboards/91/charts/17/preview') return new Response(JSON.stringify({ rows: [{ dimension: '5', value: '100' }],truncated: false,limit: 1000,durationMs: 1 }))
      throw new Error('Unexpected URL '+path)
    })
    vi.stubGlobal('fetch',fetch)
    const user = userEvent.setup()
    async function add() {
      const picker = screen.getByLabelText('Biểu đồ đã lưu')
      await user.click(picker)
      const popup = document.getElementById(picker.getAttribute('aria-controls')!)!.closest('.ant-select-dropdown') as HTMLElement
      await user.click(within(popup).getByText('Phổ điểm',{ selector: '.ant-select-item-option-content' }))
      await user.click(screen.getByRole('button',{ name: '+ Thêm biểu đồ' }))
    }
    const first = mount()
    await screen.findByText('Dashboard chưa có biểu đồ.')
    await add()
    expect(await screen.findByRole('region',{ name: 'Biểu đồ Phổ điểm' })).toBeTruthy()
    expect(await screen.findByTestId('dashboard-echarts')).toBeTruthy()
    expect(fetch.mock.calls.some(([path,options]) => path === '/api/dashboards/91/charts/17/preview' && options?.method === 'GET')).toBe(true)
    first.unmount()
    mount()
    expect(await screen.findByRole('region',{ name: 'Biểu đồ Phổ điểm' })).toBeTruthy()
    await user.click(screen.getByRole('button',{ name: 'Gỡ Phổ điểm khỏi dashboard' }))
    expect(await screen.findByText('Đã gỡ khỏi dashboard; biểu đồ gốc vẫn được giữ.')).toBeTruthy()
    expect(screen.queryByRole('region',{ name: 'Biểu đồ Phổ điểm' })).toBeNull()
    await add()
    expect(await screen.findByRole('region',{ name: 'Biểu đồ Phổ điểm' })).toBeTruthy()
    expect(fetch.mock.calls.some(([path,options]) => path === '/api/charts/17' && options?.method === 'DELETE')).toBe(false)
  },20000)
  it('keeps the dashboard unchanged when adding fails',async () => {
    vi.stubGlobal('fetch',vi.fn(async (path: string,options?: RequestInit) => new Response(JSON.stringify(options?.method === 'POST' ? { message: 'Không thể thêm biểu đồ' } : path.endsWith('/filter') ? { datasetId:null,column:null,value:null } : path === '/api/charts' ? [chart] : path === '/api/datasets/8' ? { id:8,columns:[] } : []),{ status: options?.method === 'POST' ? 503 : 200 })))
    mount()
    const user = userEvent.setup()
    await screen.findByText('Dashboard chưa có biểu đồ.')
    await user.click(screen.getByLabelText('Biểu đồ đã lưu'))
    await user.click(await screen.findByText('Phổ điểm',{ selector: '.ant-select-item-option-content' }))
    await user.click(screen.getByRole('button',{ name: '+ Thêm biểu đồ' }))
    expect(await screen.findByText('Không thể thêm biểu đồ')).toBeTruthy()
    expect(screen.queryByRole('region',{ name: 'Biểu đồ Phổ điểm' })).toBeNull()
  },15000)
})
