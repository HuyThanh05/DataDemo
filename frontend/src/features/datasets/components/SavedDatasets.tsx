import { Alert, Button, Empty, Table } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { datasetKeys, datasetsApi } from '../api'
import type { DatasetSummary } from '../types'

export default function SavedDatasets() {
  const [, setParams] = useSearchParams()
  const query = useQuery({ queryKey: datasetKeys.list, queryFn: ({ signal }) => datasetsApi.list(signal) })
  return <section className="surface dataset-saved-panel">
    <div className="section-heading"><h2>Dataset đã lưu</h2><Button size="small" loading={query.isFetching} onClick={() => { void query.refetch() }}>Tải lại danh sách dataset</Button></div>
    {query.error && <Alert type="error" showIcon title={query.error.message} className="section-alert" />}
    <Table<DatasetSummary> rowKey="id" loading={query.isFetching} size="small" dataSource={query.data ?? []} pagination={{ pageSize: 5, hideOnSinglePage: true }} scroll={{ x: 'max-content' }} locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có dataset đã lưu." /> }} columns={[
      { title: 'Tên dataset', dataIndex: 'name' },
      { title: 'Bảng nguồn', dataIndex: 'tableName' },
      { title: 'Thao tác', key: 'action', render: (_, dataset) => <Button onClick={() => setParams({ datasetId: String(dataset.id) })}>Mở</Button> },
    ]} />
  </section>
}
