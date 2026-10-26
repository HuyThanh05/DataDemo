import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Alert, Button } from 'antd'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import GridLayout, { noCompactor, useContainerWidth } from 'react-grid-layout'
import type { Layout } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import { dashboardKeys, dashboardsApi } from '../api'
import type { DashboardLayoutItem } from '../api'
import type { SavedChart } from '../../charts/types'

export default function DashboardGrid({ dashboardId, charts, busy, onEditing, children }: { dashboardId: number; charts: SavedChart[]; busy: boolean; onEditing: (editing: boolean) => void; children: (chart: SavedChart) => ReactNode }) {
  const client = useQueryClient()
  const query = useQuery({ queryKey: dashboardKeys.layout(dashboardId), queryFn: ({ signal }) => dashboardsApi.layout(dashboardId,signal) })
  const matches = query.data?.length === charts.length && charts.every(chart => query.data?.some(item => item.chartId === chart.id))
  if(query.error) return <Alert type="error" showIcon title={query.error.message} action={<Button onClick={() => { void query.refetch() }}>Tải lại bố cục</Button>} />
  if(query.isPending || (!matches && query.isFetching)) return <p>Đang tải bố cục…</p>
  if(!matches) return <Alert type="warning" title="Danh sách biểu đồ đã thay đổi. Hãy tải lại dashboard." action={<Button onClick={() => { void Promise.all([query.refetch(),client.invalidateQueries({ queryKey:dashboardKeys.charts(dashboardId) })]) }}>Tải lại dashboard</Button>} />
  return <GridEditor key={charts.map(chart => chart.id).join(',')} dashboardId={dashboardId} charts={charts} initial={query.data!} busy={busy} onEditing={onEditing}>{children}</GridEditor>
}

function GridEditor({ dashboardId, charts, initial, busy, onEditing, children }: { dashboardId: number; charts: SavedChart[]; initial: DashboardLayoutItem[]; busy: boolean; onEditing: (editing: boolean) => void; children: (chart: SavedChart) => ReactNode }) {
  const client = useQueryClient()
  const { width, containerRef } = useContainerWidth({ initialWidth: 1000 })
  const [draft, setDraft] = useState<DashboardLayoutItem[] | null>(null)
  const [saving, setSaving] = useState(false)
  const pending = useRef(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const items = draft ?? initial
  const narrow = width < 700
  function changed(layout: Layout) {
    const next = layout.map(item => ({ chartId: Number(item.i),x: item.x,y: item.y,w: item.w,h: item.h }))
    setDraft(next);setNotice('');setError('');onEditing(true)
  }
  async function save() {
    if(pending.current || !draft) return
    pending.current = true;setSaving(true);setError('')
    try {
      const result = await dashboardsApi.saveLayout(dashboardId,draft)
      client.setQueryData(dashboardKeys.layout(dashboardId),result)
      setDraft(null);onEditing(false);setNotice('Đã lưu bố cục dashboard.')
    } catch(failure) { setError((failure as Error).message) }
    finally { pending.current = false;setSaving(false) }
  }
  const layouts = items.map(item => ({ i: String(item.chartId),x:item.x,y:item.y,w:item.w,h:item.h,minW:4,minH:8,maxW:12,maxH:40 }))
  const ordered = [...charts].sort((a,b) => { const left=items.find(item=>item.chartId===a.id)!,right=items.find(item=>item.chartId===b.id)!;return left.y-right.y || left.x-right.x })
  return <div ref={containerRef} className="dashboard-grid-area">
    <div className="section-heading"><p className="footnote">Kéo tiêu đề để di chuyển, kéo góc dưới bên phải để đổi kích thước. Bấm Lưu bố cục để giữ thay đổi.</p><div className="form-actions">
      <Button disabled={!draft || saving || busy} onClick={() => { setDraft(null);setError('');setNotice('');onEditing(false) }}>Hủy thay đổi bố cục</Button>
      <Button type="primary" aria-label="Lưu bố cục" loading={saving} disabled={!draft || busy} onClick={() => { void save() }}>Lưu bố cục</Button>
    </div></div>
    {draft && <Alert type="info" title="Bố cục chưa lưu. Lưu hoặc hủy thay đổi trước khi thêm/gỡ biểu đồ." className="section-alert" />}
    {notice && <Alert type="success" showIcon title={notice} className="section-alert" />}
    {error && <Alert type="error" showIcon title={error} className="section-alert" action={<Button disabled={saving} onClick={() => { setDraft(null);setError('');onEditing(false);void Promise.all([client.invalidateQueries({ queryKey:dashboardKeys.layout(dashboardId) }),client.invalidateQueries({ queryKey:dashboardKeys.charts(dashboardId) })]) }}>Tải lại bố cục từ server</Button>} />}
    {narrow ? <><p className="footnote">Màn hình nhỏ hiển thị một cột; bố cục đã lưu được giữ nguyên. Mở rộng cửa sổ để kéo thả hoặc đổi kích thước.</p><div className="dashboard-chart-list">{ordered.map(chart=><div key={chart.id}>{children(chart)}</div>)}</div></>
      : <GridLayout width={width} layout={layouts} gridConfig={{ cols:12,rowHeight:32,margin:[16,16],containerPadding:[0,0],maxRows:10040 }} compactor={{ ...noCompactor,preventCollision:true }} dragConfig={{ enabled:!busy && !saving,handle:'.dashboard-drag-handle',cancel:'button,a,input' }} resizeConfig={{ enabled:!busy && !saving,handles:['se'] }} onDragStop={changed} onResizeStop={changed}>
        {charts.map(chart=><div key={String(chart.id)} data-chart-id={chart.id}>{children(chart)}</div>)}
      </GridLayout>}
  </div>
}
