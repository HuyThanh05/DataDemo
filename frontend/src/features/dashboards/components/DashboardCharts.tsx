import { useRef, useState } from 'react'
import { Alert, Button, Empty, Select } from 'antd'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { chartsApi } from '../../charts/api'
import type { SavedChart } from '../../charts/types'
import ChartPreview from '../../charts/components/ChartPreview'
import { datasetKeys, datasetsApi } from '../../datasets/api'
import { dashboardKeys, dashboardsApi } from '../api'
import DashboardGrid from './DashboardGrid'
import DashboardCommonFilter from './DashboardCommonFilter'
import type { DashboardFilter } from '../api'

export default function DashboardCharts({ dashboardId }: { dashboardId: number }) {
  const client = useQueryClient()
  const [selectedId, setSelectedId] = useState<number>()
  const [busy, setBusy] = useState(false)
  const [layoutEditing, setLayoutEditing] = useState(false)
  const pending = useRef(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const linked = useQuery({ queryKey: dashboardKeys.charts(dashboardId), queryFn: ({ signal }) => dashboardsApi.charts(dashboardId,signal) })
  const all = useQuery({ queryKey: ['charts'], queryFn: ({ signal }) => chartsApi.list(signal) })
  const filter=useQuery({ queryKey:dashboardKeys.filter(dashboardId),queryFn:({ signal })=>dashboardsApi.filter(dashboardId,signal) })
  const available = (all.data ?? []).filter(chart => !linked.data?.some(item => item.id === chart.id))
  const selected = available.find(chart => chart.id === selectedId)
  async function change(chartId: number, remove: boolean) {
    if (pending.current || layoutEditing) return
    pending.current = true;setBusy(true);setError('');setNotice('')
    try {
      const result = remove ? await dashboardsApi.removeChart(dashboardId,chartId) : await dashboardsApi.addChart(dashboardId,chartId)
      client.setQueryData(dashboardKeys.charts(dashboardId),result)
      await client.invalidateQueries({ queryKey: dashboardKeys.layout(dashboardId) })
      if (!remove) setSelectedId(undefined)
      setNotice(remove ? 'Đã gỡ khỏi dashboard; biểu đồ gốc vẫn được giữ.' : 'Đã thêm và lưu biểu đồ vào dashboard.')
    } catch (failure) { setError((failure as Error).message) }
    finally { pending.current = false;setBusy(false) }
  }
  return <div className="dashboard-charts">
    <h2>Biểu đồ trên dashboard</h2>
    <p className="footnote">Thêm/gỡ được lưu ngay. Gỡ khỏi dashboard không xóa biểu đồ gốc trong Chart Builder.</p>
    {error && <Alert type="error" showIcon title={error} className="section-alert" />}
    {notice && <Alert type="success" showIcon title={notice} className="section-alert" />}
    {all.error && <Alert type="error" showIcon title={all.error.message} action={<Button onClick={() => { void all.refetch() }}>Tải lại biểu đồ đã lưu</Button>} className="section-alert" />}
    <div className="dashboard-chart-picker">
      <div><label htmlFor="dashboard-chart-picker">Biểu đồ đã lưu</label><Select id="dashboard-chart-picker" style={{ width: '100%' }} showSearch optionFilterProp="label" placeholder="Chọn biểu đồ để thêm" value={selected?.id} disabled={busy || layoutEditing || linked.isPending || !!linked.error || !!all.error} loading={all.isFetching || linked.isFetching} options={available.map(chart => ({ value: chart.id, label: chart.name }))} onChange={setSelectedId} /></div>
      <Button type="primary" aria-label="+ Thêm biểu đồ" disabled={!selected || busy || layoutEditing || !!linked.error} loading={busy} onClick={() => { if (selected) void change(selected.id,false) }}>+ Thêm biểu đồ</Button>
    </div>
    {!all.isPending && !all.error && !all.data?.length && <p>Chưa có biểu đồ đã lưu. <Link to="/charts">Tạo biểu đồ</Link> trước khi thêm vào dashboard.</p>}
    {!!all.data?.length && !available.length && !linked.isPending && !linked.error && <p className="footnote">Tất cả biểu đồ đã lưu đều có trên dashboard này.</p>}
    {linked.error && <Alert type="error" showIcon title={linked.error.message} action={<Button onClick={() => { void linked.refetch() }}>Tải lại biểu đồ dashboard</Button>} className="section-alert" />}
    {linked.isPending && <p>Đang tải biểu đồ dashboard…</p>}
    {filter.error && <Alert type="error" showIcon title={filter.error.message} action={<Button onClick={()=>{ void filter.refetch() }}>Tải lại bộ lọc chung</Button>} />}
    {filter.data && linked.data && <DashboardCommonFilter key={`${filter.data.datasetId}:${filter.data.column}`} dashboardId={dashboardId} charts={linked.data} filter={filter.data} busy={busy} />}
    {!linked.isPending && !linked.error && !linked.data?.length && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Dashboard chưa có biểu đồ." />}
    {!!linked.data?.length && <DashboardGrid dashboardId={dashboardId} charts={linked.data} busy={busy} onEditing={setLayoutEditing}>{chart => <section className="dashboard-chart-card" aria-label={`Biểu đồ ${chart.name}`}>
        <div className="section-heading"><h3 className="dashboard-drag-handle" title="Kéo để di chuyển">⠿ {chart.name}</h3><div className="form-actions"><Link to={`/charts?chartId=${chart.id}`}>Mở trong Chart Builder</Link><Button danger disabled={busy || layoutEditing} onClick={() => { void change(chart.id,true) }} aria-label={`Gỡ ${chart.name} khỏi dashboard`}>Gỡ</Button></div></div>
        {filter.isPending ? <p>Đang tải bộ lọc chung…</p> : filter.error ? <Alert type="error" title="Chưa tải được bộ lọc chung, tạm dừng truy vấn để tránh hiển thị sai dữ liệu." /> : <DashboardChart dashboardId={dashboardId} chart={chart} filter={filter.data!} />}
      </section>}</DashboardGrid>}
  </div>
}

function DashboardChart({ chart,dashboardId,filter }: { chart: SavedChart;dashboardId:number;filter:DashboardFilter }) {
  const dataset = useQuery({ queryKey: datasetKeys.detail(chart.configuration.datasetId), queryFn: ({ signal }) => datasetsApi.get(chart.configuration.datasetId,signal) })
  if (dataset.isPending) return <p>Đang tải cấu hình biểu đồ…</p>
  if (dataset.error) return <Alert type="error" showIcon title={dataset.error.message} action={<Button onClick={() => { void dataset.refetch() }}>Thử lại</Button>} />
  const columns = dataset.data.columns
  const dimension = columns.find(column => column.name === chart.configuration.dimension)?.displayName ?? chart.configuration.dimension
  const metric = columns.find(column => column.name === chart.configuration.metricColumn)?.displayName ?? chart.configuration.metricColumn
  const effective=filter.datasetId===chart.configuration.datasetId && filter.value!==null?filter:null
  return <ChartPreview configuration={chart.configuration} dimensionLabel={dimension} metricLabel={`${chart.configuration.aggregation}(${metric})`} autoLoad showTable={false} fillHeight previewQuery={{ key:['dashboard-chart-preview',dashboardId,chart.id,chart.configuration,effective],load:signal=>dashboardsApi.previewChart(dashboardId,chart.id,signal) }} />
}
