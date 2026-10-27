import { Alert, Button, Table } from 'antd'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { chartsApi } from '../api'
import { chartTypeLabels } from '../chartTypes'
import type { SavedChart } from '../types'
import DeleteSavedButton from '../../../shared/components/DeleteSavedButton'

export default function SavedCharts() {
  const [params, setParams] = useSearchParams()
  const client = useQueryClient()
  const list = useQuery({ queryKey: ['charts'], queryFn: ({ signal }) => chartsApi.list(signal) })
  async function remove(chart: SavedChart) {
    await chartsApi.remove(chart.id)
    if (Number(params.get('chartId')) === chart.id) setParams({ datasetId: String(chart.configuration.datasetId) })
    await client.cancelQueries({ queryKey: ['chart', chart.id] })
    client.removeQueries({ queryKey: ['chart', chart.id] })
    client.setQueryData<SavedChart[]>(['charts'], old => (old ?? []).filter(item => item.id !== chart.id))
    await client.invalidateQueries({ queryKey: ['charts'] })
  }
  return <section className="surface dataset-saved-panel">
    <div className="section-heading"><h2>Biểu đồ đã lưu</h2><Button loading={list.isFetching} onClick={() => { void list.refetch() }}>Tải lại biểu đồ</Button></div>
    {list.error && <Alert type="error" showIcon title={list.error.message} />}
    <Table<SavedChart> rowKey="id" size="small" loading={list.isFetching} dataSource={list.data ?? []} pagination={{ pageSize: 5, hideOnSinglePage: true }} locale={{ emptyText: 'Chưa có biểu đồ đã lưu.' }} columns={[
      { title: 'Tên biểu đồ', dataIndex: 'name' },
      { title: 'Loại', render: (_, chart) => chartTypeLabels[chart.configuration.chartType] },
      { title: 'Thao tác', render: (_, chart) => <div className="form-actions"><Button onClick={() => setParams({ chartId: String(chart.id) })}>Mở biểu đồ</Button><DeleteSavedButton kind="biểu đồ" name={chart.name} description="Chỉ xóa cấu hình biểu đồ. Dataset và dữ liệu nguồn được giữ nguyên. Hãy gỡ biểu đồ khỏi các dashboard đang sử dụng trước khi xóa." onDelete={() => remove(chart)} /></div> },
    ]} />
  </section>
}
