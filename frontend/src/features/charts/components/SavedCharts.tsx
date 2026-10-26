import { Alert, Button, Table } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { chartsApi } from '../api'
import type { SavedChart } from '../types'

export default function SavedCharts() {
  const [, setParams] = useSearchParams()
  const list = useQuery({ queryKey: ['charts'], queryFn: ({ signal }) => chartsApi.list(signal) })
  return <section className="surface dataset-saved-panel">
    <div className="section-heading"><h2>Biểu đồ đã lưu</h2><Button loading={list.isFetching} onClick={() => { void list.refetch() }}>Tải lại biểu đồ</Button></div>
    {list.error && <Alert type="error" showIcon title={list.error.message} />}
    <Table<SavedChart> rowKey="id" size="small" loading={list.isFetching} dataSource={list.data ?? []} pagination={{ pageSize: 5, hideOnSinglePage: true }} locale={{ emptyText: 'Chưa có biểu đồ đã lưu.' }} columns={[
      { title: 'Tên biểu đồ', dataIndex: 'name' },
      { title: 'Loại', render: (_, chart) => chart.configuration.chartType === 'bar' ? 'Cột' : 'Đường' },
      { title: 'Thao tác', render: (_, chart) => <Button onClick={() => setParams({ chartId: String(chart.id) })}>Mở biểu đồ</Button> },
    ]} />
  </section>
}
