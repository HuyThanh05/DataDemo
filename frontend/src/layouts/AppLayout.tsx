import { useState } from 'react'
import { Button, Input } from 'antd'
import { AppstoreOutlined, BarChartOutlined, DatabaseOutlined, TableOutlined } from '@ant-design/icons'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import type { ConnectionView } from '../features/connections/types'
import './app.css'

export type WorkspaceContext = {
  search: string
  selectedConnection: ConnectionView | null
  setSelectedConnection: (connection: ConnectionView) => void
}

export default function AppLayout() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [selectedConnection, setSelectedConnection] = useState<ConnectionView | null>(null)
  const context: WorkspaceContext = { search, selectedConnection, setSelectedConnection }
  return <div className="app-shell">
    <aside className="app-sidebar">
      <div className="app-brand"><span>D</span>DataDemo</div>
      <Button type="primary" block onClick={() => navigate('/charts')}>+ Tạo biểu đồ</Button>
      <Input placeholder="Tìm kết nối…" aria-label="Tìm kết nối" value={search} onChange={e => setSearch(e.target.value)} />
      <nav aria-label="Điều hướng chính">
        <NavLink to="/connections"><DatabaseOutlined />Kết nối</NavLink>
        <NavLink to="/datasets"><TableOutlined />Dataset</NavLink>
        <NavLink to="/charts"><BarChartOutlined />Chart Builder</NavLink>
        <NavLink to="/dashboards"><AppstoreOutlined />Dashboard</NavLink>
      </nav>
      <div className="sidebar-foot"><DatabaseOutlined /><div>{selectedConnection?.name || 'MySQL'}<small>{selectedConnection ? 'Kết nối đã lưu' : 'Chọn kết nối để xem bảng'}</small></div></div>
    </aside>
    <main className="app-main"><Outlet context={context} /></main>
  </div>
}
