import { useState } from 'react'
import { Alert, Button, Empty, Form, Input, Spin, Table } from 'antd'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { dashboardKeys, dashboardsApi } from '../api'
import type { Dashboard } from '../api'
import DashboardCharts from '../components/DashboardCharts'

export default function DashboardPage() {
  const [params, setParams] = useSearchParams()
  const [revision, setRevision] = useState(0)
  const rawId = params.get('dashboardId')
  const id = rawId && /^\d+$/.test(rawId) && Number.isSafeInteger(Number(rawId)) && Number(rawId) > 0 ? Number(rawId) : undefined
  const list = useQuery({ queryKey: dashboardKeys.list, queryFn: ({ signal }) => dashboardsApi.list(signal) })
  const detail = useQuery({ queryKey: dashboardKeys.detail(id), queryFn: ({ signal }) => dashboardsApi.get(id!,signal), enabled: id !== undefined })
  return <>
    <header className="page-heading dataset-heading"><div><h1>Dashboard</h1><p>Tạo và quản lý màn hình phân tích của bạn.</p></div><Button onClick={() => { setParams({});setRevision(value => value + 1) }}>Dashboard mới</Button></header>
    {rawId !== null && id === undefined ? <Alert type="error" title="Mã dashboard không hợp lệ." />
      : id !== undefined && detail.isPending ? <Spin description="Đang mở dashboard…"><div style={{ minHeight: 100 }} /></Spin>
      : id !== undefined && detail.error ? <Alert type="error" showIcon title={detail.error.message} action={<Button onClick={() => { void detail.refetch() }}>Thử lại</Button>} />
      : <DashboardEditor key={`${id ?? 'new'}:${revision}`} dashboard={id ? detail.data : undefined} onSaved={saved => setParams({ dashboardId: String(saved.id) },{ replace: true })} />}
    <section className="surface dataset-saved-panel">
      <div className="section-heading"><h2>Dashboard đã lưu</h2><Button loading={list.isFetching} onClick={() => { void list.refetch() }}>Tải lại dashboard</Button></div>
      {list.error && <Alert type="error" showIcon title={list.error.message} />}
      <Table<Dashboard> rowKey="id" size="small" loading={list.isFetching} dataSource={list.data ?? []} pagination={{ pageSize: 5, hideOnSinglePage: true }} locale={{ emptyText: 'Chưa có dashboard đã lưu.' }} columns={[
        { title: 'Tên dashboard', dataIndex: 'name' },
        { title: 'Thao tác', render: (_, dashboard) => <Button onClick={() => { setParams({ dashboardId: String(dashboard.id) });setRevision(value => value + 1) }}>Mở dashboard</Button> },
      ]} />
    </section>
  </>
}

function DashboardEditor({ dashboard, onSaved }: { dashboard?: Dashboard; onSaved: (dashboard: Dashboard) => void }) {
  const client = useQueryClient()
  const [name, setName] = useState(dashboard?.name ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  async function save() {
    if (saving || !name.trim()) return
    setSaving(true);setError('');setSaved(false)
    try {
      const result = await dashboardsApi.save(dashboard?.id,name)
      client.setQueryData(dashboardKeys.detail(result.id),result)
      await client.invalidateQueries({ queryKey: dashboardKeys.list })
      setName(result.name);setSaved(true);onSaved(result)
    } catch (failure) { setError((failure as Error).message) }
    finally { setSaving(false) }
  }
  return <section className="surface">
    <h2>{dashboard ? 'Chỉnh sửa dashboard' : 'Tạo dashboard'}</h2>
    {error && <Alert type="error" showIcon title={error} className="section-alert" />}
    {(saved || (dashboard && name === dashboard.name)) && <Alert type="success" showIcon title="Dashboard đã được lưu." className="section-alert" />}
    <Form layout="vertical" onFinish={() => { void save() }}>
      <Form.Item label="Tên dashboard" htmlFor="dashboard-name" required><Input id="dashboard-name" value={name} disabled={saving} maxLength={100} placeholder="Ví dụ: Phân tích điểm thi" onChange={event => { setName(event.target.value);setSaved(false);setError('') }} /></Form.Item>
      <Button type="primary" htmlType="submit" loading={saving} disabled={!name.trim()}>Lưu dashboard</Button>
    </Form>
    {dashboard ? <DashboardCharts key={dashboard.id} dashboardId={dashboard.id} /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Lưu dashboard để thêm biểu đồ đã tạo trong Chart Builder." />}
  </section>
}
