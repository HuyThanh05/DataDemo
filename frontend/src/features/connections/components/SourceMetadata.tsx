import { Alert, Button, Empty, Spin, Table } from 'antd'
import type { ColumnInfo, ConnectionView } from '../types'

type Props = {
  connection: ConnectionView | null
  tables: string[]
  table: string
  columns: ColumnInfo[]
  loading: boolean
  retesting: boolean
  error?: string
  success?: string
  onSelectTable: (table: string) => void
  onRetest: () => void
  onCreateDataset: () => void
}

export default function SourceMetadata(props: Props) {
  const { connection, tables, table, columns, loading, retesting, error, success } = props
  return <section className="surface">
    <div className="section-heading"><h2>{connection ? `Bảng và cột trong ${connection.name}` : 'Bảng và cột'}</h2>{connection && <Button size="small" onClick={props.onRetest} loading={retesting}>Kiểm tra lại</Button>}</div>
    {error && <Alert type="error" showIcon title={error} className="section-alert" />}
    {success && <Alert type="success" showIcon title={success} className="section-alert" />}
    <Spin spinning={loading}>
      {!connection ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chọn kết nối đã lưu để đọc bảng và cột từ MySQL." /> : !tables.length && !loading && !error ? <Empty description="Không có bảng được phép đọc." /> : <div className="metadata-layout">
        <div className="source-tables">{tables.map(t => <button key={t} className={table === t ? 'selected' : ''} onClick={() => props.onSelectTable(t)}>{t}</button>)}</div>
        <div className="columns-table"><Table<ColumnInfo> rowKey="name" dataSource={columns} size="small" pagination={false} locale={{ emptyText: loading ? 'Đang đọc cột…' : 'Chưa có cột' }} columns={[{ title: 'Tên cột', dataIndex: 'name' }, { title: 'Kiểu dữ liệu', dataIndex: 'dataType' }, { title: 'Cho phép NULL', dataIndex: 'nullable', render: (v: boolean) => v ? 'Có' : 'Không' }]} /></div>
      </div>}
    </Spin>
    <Button type="primary" disabled={!connection || !table || loading || !!error} className="dataset-placeholder" onClick={props.onCreateDataset}>Tạo dataset từ bảng này</Button>
  </section>
}
