import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { createQueryClient } from '../../../app/queryClient'
import DashboardCharts from './DashboardCharts'
import type { DashboardFilter } from '../api'
import type { SavedChart } from '../../charts/types'

vi.mock('echarts-for-react',()=>({ default:({ option }:{ option:unknown })=><output data-testid="filtered-chart">{JSON.stringify(option)}</output> }))
const config={ chartType:'bar' as const,dimension:'score',metricColumn:'score',aggregation:'COUNT' as const,sortDirection:'ASC' as const,filters:[] }
const charts:SavedChart[]=[{ id:17,name:'Phổ điểm',configuration:{ ...config,datasetId:8,filters:[{ id:1,column:'subject',operator:'EQ',value:'Ngữ văn' }] } },{ id:18,name:'Khoảng điểm',configuration:{ ...config,datasetId:8 } },{ id:19,name:'Doanh thu',configuration:{ ...config,datasetId:9 } }]
function mount() { return render(<QueryClientProvider client={createQueryClient()}><MemoryRouter><DashboardCharts dashboardId={91} /></MemoryRouter></QueryClientProvider>) }
describe('common dashboard filter',()=>{
  it('updates matching charts only, preserves AND, restores All and keeps the saved choice after remount',async()=>{
    let filter:DashboardFilter={ datasetId:null,column:null,value:null },fail=false
    const counts:Record<number,number>={ 17:0,18:0,19:0 }
    const fetch=vi.fn(async(path:string,options?:RequestInit)=>{
      if(path==='/api/charts' || path==='/api/dashboards/91/charts') return new Response(JSON.stringify(charts))
      if(path==='/api/dashboards/91/filter') {
        if(options?.method==='PUT') { if(fail) { fail=false;return new Response(JSON.stringify({ message:'Không lưu được bộ lọc' }),{ status:503 }) } filter=JSON.parse(String(options.body)) }
        return new Response(JSON.stringify(filter))
      }
      if(path==='/api/dashboards/91/layout') return new Response(JSON.stringify(charts.map((c,i)=>({ chartId:c.id,x:(i%2)*6,y:Math.floor(i/2)*12,w:6,h:12 }))))
      if(path==='/api/datasets') return new Response(JSON.stringify([{ id:8,name:'Điểm thi' },{ id:9,name:'Bán hàng' }]))
      if(path.startsWith('/api/datasets/')) return new Response(JSON.stringify({ columns:[{ name:'subject',displayName:'Môn học',canFilter:true },{ name:'score',displayName:'Điểm thi',canFilter:true }] }))
      if(path.includes('/filter-values?')) return new Response(JSON.stringify({ values:['Toán','Ngữ văn'],truncated:false }))
      const match=path.match(/\/charts\/(17|18|19)\/preview$/)
      if(match) {
        const id=Number(match[1]);counts[id]++
        const rows=id===17 && filter.value==='Toán'?[]:[{ dimension:'5',value:id===19?'99':filter.value==='Toán'?'100':'200' }]
        return new Response(JSON.stringify({ rows,limit:1000,truncated:false,durationMs:1 }))
      }
      throw new Error('Unexpected URL '+path)
    })
    vi.stubGlobal('fetch',fetch)
    const first=mount(),user=userEvent.setup()
    await waitFor(()=>expect(counts[19]).toBe(1))
    async function choose(label:string,option:string) {
      const input=screen.getByRole('combobox',{ name:label });await user.click(input)
      const popup=document.getElementById(input.getAttribute('aria-controls')!)!.closest('.ant-select-dropdown') as HTMLElement
      await user.click(within(popup).getByText(option,{ selector:'.ant-select-item-option-content' }))
    }
    await choose('Dataset áp dụng bộ lọc','Điểm thi')
    await choose('Cột môn học','Môn học')
    await waitFor(()=>expect(screen.getByRole('combobox',{ name:'Môn học' })).toBeTruthy())
    await choose('Môn học','Toán')
    await user.click(screen.getByRole('button',{ name:'Áp dụng bộ lọc' }))
    await waitFor(()=>expect(counts[18]).toBe(2))
    expect(counts[19]).toBe(1)
    expect(await within(screen.getByRole('region',{ name:'Biểu đồ Phổ điểm' })).findByText('Không có dữ liệu phù hợp với bộ lọc.')).toBeTruthy()
    expect(charts[0].configuration.filters[0].value).toBe('Ngữ văn')
    await choose('Môn học','Tất cả')
    await user.click(screen.getByRole('button',{ name:'Áp dụng bộ lọc' }))
    await waitFor(()=>expect(counts[18]).toBe(3))
    expect(filter).toEqual({ datasetId:8,column:'subject',value:null });expect(counts[19]).toBe(1)
    fail=true;await choose('Môn học','Toán')
    await user.click(screen.getByRole('button',{ name:'Áp dụng bộ lọc' }))
    expect(await screen.findByText('Không lưu được bộ lọc')).toBeTruthy();expect(counts[18]).toBe(3)
    await user.click(screen.getByRole('button',{ name:'Áp dụng bộ lọc' }))
    await waitFor(()=>expect(counts[18]).toBe(4));expect(counts[19]).toBe(1)
    first.unmount();mount()
    expect(await screen.findByTitle('Toán')).toBeTruthy()
    expect(filter.value).toBe('Toán')
  },30000)
})
