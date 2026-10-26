import { Alert, Button, Empty, Select, Table } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { datasetKeys, datasetsApi } from '../../datasets/api'
import type { DatasetColumn } from '../../datasets/types'
import ChartConfigurationForm from '../components/ChartConfigurationForm'
import SavedCharts from '../components/SavedCharts'
import { chartsApi } from '../api'

export default function ChartBuilderPage() {
  const [params, setParams] = useSearchParams()
  const rawChartId = params.get('chartId')
  const chartId = rawChartId && /^\d+$/.test(rawChartId) && Number.isSafeInteger(Number(rawChartId)) && Number(rawChartId) > 0 ? Number(rawChartId) : undefined
  const chart = useQuery({ queryKey: ['chart',chartId], queryFn: ({ signal }) => chartsApi.get(chartId!,signal), enabled: chartId !== undefined })
  const rawId = rawChartId !== null ? (chart.data ? String(chart.data.configuration.datasetId) : null) : params.get('datasetId')
  const id = rawId && /^\d+$/.test(rawId) && Number.isSafeInteger(Number(rawId)) && Number(rawId) > 0 ? Number(rawId) : undefined
  const invalid = rawId !== null && id === undefined
  const list = useQuery({ queryKey: datasetKeys.list, queryFn: ({ signal }) => datasetsApi.list(signal) })
  const detail = useQuery({ queryKey: datasetKeys.detail(id), queryFn: ({ signal }) => datasetsApi.get(id!, signal), enabled: id !== undefined })

  return <>
    <header className="page-heading dataset-heading"><div><h1>Chart Builder</h1><p>Chọn dataset đã lưu để bắt đầu tạo biểu đồ.</p></div><Button onClick={() => setParams({})}>Biểu đồ mới</Button></header>
    {rawChartId !== null && chartId === undefined && <Alert type="error" title="Mã biểu đồ không hợp lệ." />}
    {chartId !== undefined && chart.isPending && <Alert type="info" title="Đang mở biểu đồ…" />}
    {chartId !== undefined && chart.error && <Alert type="error" title={chart.error.message} action={<Button onClick={() => { void chart.refetch() }}>Thử lại</Button>} />}
    {chartId !== undefined && chart.data && !chart.error && <Alert type="success" title={`Đã mở biểu đồ đã lưu: ${chart.data.name}`} />}
    <section className="surface">
      <div className="section-heading"><h2>Dataset</h2><Button loading={list.isFetching} onClick={() => { void list.refetch(); if (id) void detail.refetch() }}>Tải lại dataset</Button></div>
      {list.error && <Alert type="error" showIcon title={list.error.message} className="section-alert" />}
      {invalid && <Alert type="error" showIcon title="Mã dataset không hợp lệ. Hãy chọn lại dataset." className="section-alert" />}
      <label htmlFor="chart-dataset">Dataset đã lưu</label>
      <Select id="chart-dataset" style={{ width: '100%', marginTop: 8 }} placeholder="Chọn dataset" showSearch optionFilterProp="label" value={id} loading={list.isFetching} disabled={list.isPending || !!list.error} options={(list.data ?? []).map(dataset => ({ value: dataset.id, label: dataset.name }))} onChange={value => setParams({ datasetId: String(value) })} />
      {!list.isPending && !list.error && !list.data?.length && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<span>Chưa có dataset đã lưu. <Link to="/datasets">Tạo dataset</Link> trước khi tạo biểu đồ.</span>} />}
    </section>
    {id !== undefined && detail.data && !detail.error && !chart.error && <ChartConfigurationForm key={`${chartId ?? 'new'}:${id}`} dataset={detail.data} saved={chartId ? chart.data : undefined} onSaved={saved => setParams({ chartId: String(saved.id) })} />}
    <section className="surface dataset-saved-panel">
      <h2>Các cột của dataset</h2>
      {detail.error && <Alert type="error" showIcon title={detail.error.message} className="section-alert" action={<Button onClick={() => { void detail.refetch() }}>Thử lại</Button>} />}
      {detail.data && id !== undefined && <p>{detail.data.name} · Bảng nguồn: {detail.data.tableName}</p>}
      <Table<DatasetColumn> rowKey="id" size="small" loading={id !== undefined && detail.isPending} dataSource={id !== undefined && !detail.error ? detail.data?.columns ?? [] : []} pagination={false} scroll={{ x: 'max-content' }} locale={{ emptyText: 'Chọn dataset để xem các cột.' }} columns={[
        { title: 'Tên hiển thị', dataIndex: 'displayName' },
        { title: 'Tên cột gốc', dataIndex: 'name' },
        { title: 'Kiểu dữ liệu', dataIndex: 'dataType' },
        { title: 'Nhóm theo', dataIndex: 'canGroup', render: value => value ? 'Có' : 'Không' },
        { title: 'Tổng hợp số (AVG)', dataIndex: 'canAggregate', render: value => value ? 'Có' : 'Không' },
        { title: 'Lọc', dataIndex: 'canFilter', render: value => value ? 'Có' : 'Không' },
      ]} />
    </section>
    <SavedCharts />
  </>
}
