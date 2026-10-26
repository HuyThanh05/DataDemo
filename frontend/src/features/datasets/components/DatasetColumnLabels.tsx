import { Alert, Button, Empty, Input, Table } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { connectionKeys, connectionsApi } from '../../connections/api'
import type { ColumnInfo } from '../../connections/types'

type Props = {
  connectionId?: number
  table?: string
  labels: Record<string, string>
  onChange: (column: string, label: string) => void
  disabled?: boolean
}

export default function DatasetColumnLabels({ connectionId, table, labels, onChange, disabled }: Props) {
  const query = useQuery({
    queryKey: connectionKeys.columns(connectionId, table ?? ''),
    queryFn: ({ signal }) => connectionsApi.columns(connectionId!, table!, signal),
    enabled: connectionId !== undefined && !!table,
  })

  return <section className="surface dataset-columns-panel">
    <h2>Cột và tên hiển thị</h2>
    {!connectionId || !table ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chọn kết nối và bảng để đặt tên hiển thị cho cột." /> : <>
      {query.error && <Alert type="error" showIcon title={query.error.message} className="section-alert" action={<Button size="small" onClick={() => { void query.refetch() }}>Thử lại</Button>} />}
      <Table<ColumnInfo> rowKey="name" size="small" loading={query.isFetching} pagination={false} scroll={{ x: 'max-content' }}
        dataSource={query.error ? [] : query.data ?? []}
        columns={[
          { title: 'Cột gốc', dataIndex: 'name', render: (value: string) => <code>{value}</code> },
          { title: 'Kiểu', dataIndex: 'dataType' },
          {
            title: 'Tên hiển thị', key: 'displayName', width: 230,
            render: (_, column) => <Input
              aria-label={`Tên hiển thị của ${column.name}`}
              value={labels[column.name] ?? column.name}
              placeholder={column.name}
              maxLength={100}
              disabled={disabled}
              onChange={event => onChange(column.name, event.target.value)}
            />,
          },
        ]}
        locale={{ emptyText: query.isFetching ? 'Đang đọc cấu trúc cột…' : query.error ? 'Không tải được cấu trúc cột.' : 'Chưa có cột.' }} />
      <p className="footnote">Tên hiển thị chỉ dùng trong ứng dụng, không đổi tên cột gốc. Để trống sẽ dùng tên cột gốc. Bấm Lưu dataset để giữ các thay đổi khi tải lại trang.</p>
    </>}
  </section>
}
