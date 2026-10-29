import { Alert, Button, Empty, Table } from 'antd'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { datasetKeys, datasetsApi } from '../api'
import type { DatasetSummary } from '../types'
import DeleteSavedButton from '../../../shared/components/DeleteSavedButton'

export default function SavedDatasets() {
  const [params, setParams] = useSearchParams()
  const client = useQueryClient()
  const query = useQuery({ queryKey: datasetKeys.list, queryFn: ({ signal }) => datasetsApi.list(signal) })
  async function remove(id: number) {
    await datasetsApi.remove(id)
    if (Number(params.get('datasetId')) === id) setParams({})
    await client.cancelQueries({ queryKey: datasetKeys.detail(id) })
    client.removeQueries({ queryKey: datasetKeys.detail(id) })
    client.removeQueries({ queryKey: datasetKeys.savedPreview(id) })
    client.setQueryData<DatasetSummary[]>(datasetKeys.list, old => (old ?? []).filter(item => item.id !== id))
    await client.invalidateQueries({ queryKey: datasetKeys.list })
  }
  return <section className="surface dataset-saved-panel">
    <div className="section-heading"><h2>Dataset đã lưu</h2><Button size="small" loading={query.isFetching} onClick={() => { void query.refetch() }}>Tải lại danh sách dataset</Button></div>
    {query.error && <Alert type="error" showIcon title={query.error.message} className="section-alert" />}
    <Table<DatasetSummary> rowKey="id" loading={query.isFetching} size="small" dataSource={query.data ?? []} pagination={{ pageSize: 5, hideOnSinglePage: true }} scroll={{ x: 'max-content' }} locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có dataset đã lưu." /> }} columns={[
      { title: 'Tên dataset', dataIndex: 'name' },
      { title: 'Bảng nguồn', dataIndex: 'tableName' },
      { title: 'Thao tác', key: 'action', width: 180, render: (_, dataset) => <div className="form-actions"><Button onClick={() => setParams({ datasetId: String(dataset.id) })}>Mở</Button><DeleteSavedButton kind="dataset" name={dataset.name} description="Chỉ xóa cấu hình dataset và tên hiển thị cột. Bảng và dữ liệu nguồn được giữ nguyên. Dataset còn biểu đồ hoặc bộ lọc dashboard sử dụng sẽ không được xóa." onDelete={() => remove(dataset.id)} /></div> },
    ]} />
  </section>
}
