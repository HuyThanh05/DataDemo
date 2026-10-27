import { Alert, Button, Empty } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import type { ConnectionView } from '../types'
import DeleteSavedButton from '../../../shared/components/DeleteSavedButton'

type Props = {
  connections: ConnectionView[]
  search: string
  selectedId?: number
  loading: boolean
  error?: string
  onRefresh: () => void
  onSelect: (connection: ConnectionView) => void
  onDelete: (connection: ConnectionView) => Promise<void>
}

export default function ConnectionList({ connections, search, selectedId, loading, error, onRefresh, onSelect, onDelete }: Props) {
  const filtered = connections.filter(c => (c.name + c.databaseName).toLowerCase().includes(search.toLowerCase()))
  return <section className="surface">
    <div className="section-heading"><h2>Kết nối đã lưu</h2><Button size="small" icon={<ReloadOutlined />} aria-label="Tải lại danh sách" loading={loading} onClick={onRefresh} /></div>
    {error && <Alert type="error" showIcon title={error} className="section-alert" />}
    {!error && !filtered.length && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={loading ? 'Đang đọc kết nối…' : connections.length ? 'Không tìm thấy kết nối.' : 'Chưa có kết nối. Thêm cấu hình bên dưới.'} />}
    <div className="saved-list">{filtered.map(c => <div key={c.id} className="saved-connection-row">
      <button className={`saved-connection ${selectedId === c.id ? 'selected' : ''}`} onClick={() => onSelect(c)}><strong>{c.name}</strong><small>{c.host}:{c.port} / {c.databaseName}</small></button>
      <DeleteSavedButton kind="kết nối" name={c.name} description="Chỉ xóa thông tin kết nối đã lưu. Database và dữ liệu nguồn được giữ nguyên. Kết nối còn dataset sử dụng sẽ không được xóa." onDelete={() => onDelete(c)} />
    </div>)}</div>
  </section>
}
