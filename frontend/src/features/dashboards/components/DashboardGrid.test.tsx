import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import userEvent from '@testing-library/user-event'
import { QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import type { Layout } from 'react-grid-layout'
import { createQueryClient } from '../../../app/queryClient'
import DashboardGrid from './DashboardGrid'
import type { SavedChart } from '../../charts/types'
import type { DashboardLayoutItem } from '../api'

const viewport=vi.hoisted(()=>({ width:1000 }))
vi.mock('react-grid-layout',()=>({
  noCompactor:{},useContainerWidth:()=>({ width:viewport.width,containerRef:{ current:null } }),
  default:({ layout,onDragStop,onResizeStop,children }:{ layout:Layout;onDragStop:(layout:Layout)=>void;onResizeStop:(layout:Layout)=>void;children:ReactNode })=><div>
    <output data-testid="layout">{JSON.stringify(layout)}</output>
    <button onClick={()=>onDragStop(layout.map(item=>({ ...item,x:2,y:3 })))}>Giả lập kéo</button>
    <button onClick={()=>onResizeStop(layout.map(item=>({ ...item,w:8,h:14 })))}>Giả lập đổi kích thước</button>{children}
  </div>,
}))
const chart:SavedChart={ id:17,name:'Biểu đồ mẫu',configuration:{ datasetId:8,chartType:'bar',dimension:'score',metricColumn:'score',aggregation:'COUNT',sortDirection:'ASC',filters:[] } }
function mount() { return render(<QueryClientProvider client={createQueryClient()}><DashboardGrid dashboardId={91} charts={[chart]} busy={false} onEditing={()=>{}}>{item=><p>{item.name}</p>}</DashboardGrid></QueryClientProvider>) }
describe('dashboard layout persistence',()=>{
  it('keeps a failed draft, retries saving and restores the saved position and size',async()=>{
    viewport.width=1000
    let stored:DashboardLayoutItem[]=[{ chartId:17,x:0,y:0,w:6,h:12 }],fail=true
    vi.stubGlobal('fetch',vi.fn(async(path:string,options?:RequestInit)=>{
      if(path!=='/api/dashboards/91/layout') throw new Error('Unexpected URL '+path)
      if(options?.method==='PUT') {
        if(fail) { fail=false;return new Response(JSON.stringify({ message:'Lưu bố cục thất bại' }),{ status:503 }) }
        stored=JSON.parse(String(options.body)).items
      }
      return new Response(JSON.stringify(stored))
    }))
    const first=mount(),user=userEvent.setup()
    await screen.findByText('Biểu đồ mẫu')
    await user.click(screen.getByRole('button',{ name:'Giả lập kéo' }))
    await user.click(screen.getByRole('button',{ name:'Giả lập đổi kích thước' }))
    await user.click(screen.getByRole('button',{ name:'Lưu bố cục' }))
    expect(await screen.findByText('Lưu bố cục thất bại')).toBeTruthy()
    expect(JSON.parse(screen.getByTestId('layout').textContent!)[0]).toMatchObject({ x:2,y:3,w:8,h:14 })
    await user.click(screen.getByRole('button',{ name:'Lưu bố cục' }))
    expect(await screen.findByText('Đã lưu bố cục dashboard.')).toBeTruthy()
    expect(stored).toEqual([{ chartId:17,x:2,y:3,w:8,h:14 }])
    first.unmount();mount()
    await screen.findByText('Biểu đồ mẫu')
    expect(JSON.parse(screen.getByTestId('layout').textContent!)[0]).toMatchObject({ x:2,y:3,w:8,h:14 })
  })
  it('uses a static small-screen view without writing a desktop layout',async()=>{
    viewport.width=390
    const fetch=vi.fn(async(path:string)=>new Response(JSON.stringify(path.endsWith('/layout')?[{ chartId:17,x:2,y:3,w:8,h:14 }]:[])))
    vi.stubGlobal('fetch',fetch)
    mount()
    expect(await screen.findByText(/Màn hình nhỏ hiển thị một cột/)).toBeTruthy()
    expect(screen.queryByRole('button',{ name:'Giả lập kéo' })).toBeNull()
    expect(fetch.mock.calls).toHaveLength(1)
  })
})
