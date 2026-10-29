import { Alert, Button, Empty, Table, Tag } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { datasetKeys, datasetsApi } from '../api'

export default function DatasetPreview({ connectionId, table, datasetId, labels = {} }: { connectionId?: number; table?: string; datasetId?: number; labels?: Record<string, string> }) {
  const query = useQuery({
    queryKey: datasetId ? datasetKeys.savedPreview(datasetId) : datasetKeys.preview(connectionId, table),
    queryFn: ({ signal }) => datasetId ? datasetsApi.previewSaved(datasetId, signal) : datasetsApi.preview({ connectionId: connectionId!, tableName: table! }, signal),
    enabled: connectionId !== undefined && !!table,
  })
  return <section className="surface dataset-preview-panel">
    <div className="section-heading"><h2>Xem trước</h2><div className="form-actions"><Tag>Tối đa 100 dòng</Tag><Button size="small" icon={<ReloadOutlined />} aria-label="Làm mới xem trước" disabled={!connectionId || !table} loading={query.isFetching} onClick={() => { void query.refetch() }} /></div></div>
    {!connectionId || !table ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chọn kết nối và bảng để xem dữ liệu." /> : <>
      {query.error && <Alert type="error" showIcon title={query.error.message} className="section-alert" action={<Button size="small" onClick={() => { void query.refetch() }}>Thử lại</Button>} />}
      <Table rowKey="previewKey" size="small" loading={query.isFetching} pagination={{ pageSize: 5, showSizeChanger: false, hideOnSinglePage: true }} scroll={{ x: 'max-content', y: 240 }}
        columns={(query.data?.columns ?? []).map((column, index) => ({
          key: index, width: 180, title: labels[column.name]?.trim() || column.name, dataIndex: String(index),
          render: (value: unknown) => value === null ? <span className="preview-null">NULL</span> : value === '' ? <span className="preview-null">(trống)</span> : String(value),
        }))}
        dataSource={(query.error ? [] : query.data?.rows ?? []).map((row, index) => ({ previewKey: index, ...Object.fromEntries(row.map((value, column) => [String(column), value])) }))}
        locale={{ emptyText: query.isFetching ? 'Đang đọc dữ liệu…' : query.error ? 'Không tải được dữ liệu.' : 'Bảng nguồn chưa có dữ liệu.' }} />
      {query.data && !query.error && <p className="footnote">Đang xem {query.data.rows.length} dòng mẫu từ {table}, không phải tổng số dòng của bảng. NULL khác điểm 0; ô văn bản dài có thể được rút gọn.</p>}
    </>}
  </section>
}
