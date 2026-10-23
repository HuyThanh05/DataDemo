import { useEffect, useRef, useState } from 'react'
import { Alert, Button, ConfigProvider, Empty, Form, Input, InputNumber, Spin, Table } from 'antd'
import { DatabaseOutlined, TableOutlined, BarChartOutlined, AppstoreOutlined, ReloadOutlined } from '@ant-design/icons'
import './connections.css'
type ConnectionView = { id: number; name: string; host: string; port: number; databaseName: string; username: string }
type ConnectionInput = Omit<ConnectionView, 'id'> & { password: string }
type ColumnInfo = { name: string; dataType: string; nullable: boolean }
type TestResult = { success: boolean; message: string; tables: string[] }
const defaults: ConnectionInput = { name: 'MySQL local', host: 'localhost', port: 3306, databaseName: 'datademo_source', username: 'datademo_reader', password: '' }
async function api<T>(path: string, body?: unknown): Promise<T> {
  let response: Response
  try { response = await fetch('/api/connections' + path, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) }
  catch { throw new Error('Không gọi được backend. Kiểm tra Spring Boot tại cổng 8080.') }
  const value = await response.json().catch(() => null)
  if (!response.ok) throw new Error(value?.message || 'Phản hồi không hợp lệ. Kiểm tra backend và cấu hình MySQL.')
  return value as T
}
export default function ConnectionsPage() {
  const [form] = Form.useForm<ConnectionInput>()
  const [items, setItems] = useState<ConnectionView[]>([])
  const [selected, setSelected] = useState<ConnectionView | null>(null)
  const [tables, setTables] = useState<string[]>([])
  const [table, setTable] = useState('')
  const [columns, setColumns] = useState<ColumnInfo[]>([])
  const [listError, setListError] = useState('')
  const [sourceError, setSourceError] = useState('')
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [metadataLoading, setMetadataLoading] = useState(false)
  const [busy, setBusy] = useState<'test' | 'save' | 'retest' | null>(null)
  const [search, setSearch] = useState('')
  const generation = useRef(0)
  const revision = useRef(0)
  async function loadColumns(c: ConnectionView, name: string, token: number) {
    setTable(name); setColumns([])
    try { const value = await api<ColumnInfo[]>(`/${c.id}/columns?table=${encodeURIComponent(name)}`); if (generation.current === token) setColumns(value) }
    catch (e) { if (generation.current === token) setSourceError((e as Error).message) }
  }
  async function open(c: ConnectionView) {
    const token = ++generation.current
    setSelected(c); setTables([]); setColumns([]); setTable(''); setSourceError(''); setMetadataLoading(true)
    try { const value = await api<string[]>(`/${c.id}/tables`); if (generation.current !== token) return; setTables(value); if (value.length) await loadColumns(c, value[0], token) }
    catch (e) { if (generation.current === token) setSourceError((e as Error).message) }
    finally { if (generation.current === token) setMetadataLoading(false) }
  }
  async function refresh() {
    setLoading(true); setListError('')
    try { setItems(await api<ConnectionView[]>('')) } catch (e) { setListError((e as Error).message) } finally { setLoading(false) }
  }
  useEffect(() => { let active = true; api<ConnectionView[]>('').then(v => { if (active) setItems(v) }).catch(e => { if (active) setListError(e.message) }); return () => { active = false } }, [])
  async function submit(mode: 'test' | 'save') {
    if (busy) return
    let values: ConnectionInput
    try { values = await form.validateFields() } catch { return }
    const token = revision.current
    setBusy(mode); setResult(null)
    try {
      const input = { ...values, password: values.password ?? '' }
      if (mode === 'test') { const r = await api<TestResult>('/test', input); if (revision.current === token) setResult({ ok: true, message: r.message }) }
      else { const c = await api<ConnectionView>('', input); setItems(previous => [c, ...previous]); setListError(''); form.setFieldValue('password', ''); setResult({ ok: true, message: 'Đã kiểm tra và lưu kết nối. Mật khẩu được mã hóa.' }); await open(c) }
    } catch (e) { if (revision.current === token) setResult({ ok: false, message: (e as Error).message }) }
    finally { setBusy(null) }
  }
  async function retest() {
    if (!selected || busy) return
    setBusy('retest'); setSourceError('')
    try { const r = await api<TestResult>(`/${selected.id}/test`, {}); setResult({ ok: true, message: selected.name + ': ' + r.message }); await open(selected) }
    catch (e) { setSourceError((e as Error).message) } finally { setBusy(null) }
  }
  const filtered = items.filter(c => (c.name + c.databaseName).toLowerCase().includes(search.toLowerCase()))
  return <ConfigProvider theme={{ token: { colorPrimary: '#2870e8', borderRadius: 10, colorText: '#102447', fontFamily: "'Segoe UI', Arial, sans-serif" } }}><div className="app-shell">
    <aside className="app-sidebar"><div className="app-brand"><span>D</span>DataDemo</div><Button type="primary" block disabled>+ Tạo biểu đồ</Button><Input placeholder="Tìm kết nối…" aria-label="Tìm kết nối" value={search} onChange={e => setSearch(e.target.value)} /><nav><button className="active"><DatabaseOutlined />Kết nối</button><button disabled><TableOutlined />Dataset</button><button disabled><BarChartOutlined />Chart Builder</button><button disabled><AppstoreOutlined />Dashboard</button></nav><div className="sidebar-foot"><DatabaseOutlined /><div>{selected?.name || 'MySQL'}<small>{selected ? 'Kết nối đã lưu' : 'Chọn kết nối để xem bảng'}</small></div></div></aside>
    <main className="app-main"><header className="page-heading"><h1>Kết nối database</h1><p>Nhập thông tin, kiểm tra kết nối và xem bảng/cột.</p></header><div className="connection-grid"><div className="left-stack">
      <section className="surface"><div className="section-heading"><h2>Kết nối đã lưu</h2><Button size="small" icon={<ReloadOutlined />} aria-label="Tải lại danh sách" loading={loading} onClick={refresh} /></div>{listError && <Alert type="error" showIcon title={listError} className="section-alert" />}{!listError && !filtered.length && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={items.length ? 'Không tìm thấy kết nối.' : 'Chưa có kết nối. Thêm cấu hình bên dưới.'} />}<div className="saved-list">{filtered.map(c => <button key={c.id} className={`saved-connection ${selected?.id === c.id ? 'selected' : ''}`} onClick={() => open(c)}><strong>{c.name}</strong><small>{c.host}:{c.port} / {c.databaseName}</small></button>)}</div></section>
      <section className="surface"><h2>Thêm kết nối</h2><Form form={form} layout="vertical" initialValues={defaults} disabled={busy !== null} onValuesChange={() => { revision.current++; setResult(null) }} onFinish={() => submit('save')}>
        <Form.Item label="Tên kết nối" name="name" rules={[{ required: true, whitespace: true, message: 'Nhập tên kết nối.' }, { max: 100 }]}><Input maxLength={100} /></Form.Item><div className="host-port"><Form.Item label="Host" name="host" rules={[{ required: true, whitespace: true, message: 'Nhập Host.' }]}><Input /></Form.Item><Form.Item label="Port" name="port" rules={[{ required: true, message: 'Nhập Port.' }]}><InputNumber min={1} max={65535} precision={0} style={{ width: '100%' }} /></Form.Item></div><Form.Item label="Database" name="databaseName" rules={[{ required: true, whitespace: true, message: 'Nhập database.' }]}><Input /></Form.Item><Form.Item label="Tài khoản" name="username" rules={[{ required: true, whitespace: true, message: 'Nhập tài khoản.' }]}><Input autoComplete="username" /></Form.Item><Form.Item label="Mật khẩu" name="password"><Input.Password autoComplete="new-password" placeholder="Mật khẩu tài khoản nguồn" /></Form.Item>
        {result && <Alert type={result.ok ? 'success' : 'error'} showIcon title={result.message} className="section-alert" />}<div className="form-actions"><Button onClick={() => submit('test')} loading={busy === 'test'}>Kiểm tra kết nối</Button><Button type="primary" htmlType="submit" loading={busy === 'save'}>Lưu</Button></div></Form><p className="footnote">Chỉ hỗ trợ MySQL. Dùng tài khoản chỉ đọc nguồn; mật khẩu không hiển thị lại sau khi lưu.</p></section>
    </div><section className="surface"><div className="section-heading"><h2>{selected ? `Bảng và cột trong ${selected.name}` : 'Bảng và cột'}</h2>{selected && <Button size="small" onClick={retest} disabled={busy !== null} loading={busy === 'retest'}>Kiểm tra lại</Button>}</div>{sourceError && <Alert type="error" showIcon title={sourceError} className="section-alert" />}<Spin spinning={metadataLoading}>{!selected ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chọn kết nối đã lưu để đọc bảng và cột từ MySQL." /> : !tables.length && !metadataLoading && !sourceError ? <Empty description="Không có bảng được phép đọc." /> : <div className="metadata-layout"><div className="source-tables">{tables.map(t => <button key={t} className={table === t ? 'selected' : ''} onClick={async () => { const token = ++generation.current; setMetadataLoading(true); setSourceError(''); await loadColumns(selected, t, token); if (generation.current === token) setMetadataLoading(false) }}>{t}</button>)}</div><div className="columns-table"><Table<ColumnInfo> rowKey="name" dataSource={columns} size="small" pagination={false} locale={{ emptyText: metadataLoading ? 'Đang đọc cột…' : 'Chưa có cột' }} columns={[{ title: 'Tên cột', dataIndex: 'name' }, { title: 'Kiểu dữ liệu', dataIndex: 'dataType' }, { title: 'Cho phép NULL', dataIndex: 'nullable', render: (v: boolean) => v ? 'Có' : 'Không' }]} /></div></div>}</Spin><Button type="primary" disabled className="dataset-placeholder">Tạo dataset từ bảng này</Button><p className="footnote">Tạo dataset thuộc bước 8, chưa triển khai.</p></section></div></main>
  </div></ConfigProvider>
}
