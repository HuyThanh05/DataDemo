import { useRef, useState } from 'react'
import { Alert, Button, Empty, Input, Select, Spin, Tag } from 'antd'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { connectionKeys, connectionsApi } from '../../connections/api'
import DatasetPreview from '../components/DatasetPreview'
import DatasetColumnLabels from '../components/DatasetColumnLabels'
import SavedDatasets from '../components/SavedDatasets'
import { datasetKeys, datasetsApi } from '../api'
import { savedSettings } from '../columnPolicy'
import type { ColumnSettings, DatasetDetail } from '../types'

export default function DatasetPage() {
  const [params] = useSearchParams()
  const rawId = params.get('datasetId')
  const id = rawId && /^\d+$/.test(rawId) && Number.isSafeInteger(Number(rawId)) && Number(rawId) > 0 ? Number(rawId) : undefined
  const detail = useQuery({ queryKey: datasetKeys.detail(id), queryFn: ({ signal }) => datasetsApi.get(id!, signal), enabled: id !== undefined })
  let content
  if (rawId !== null && id === undefined) content = <Alert type="error" title="Mã dataset không hợp lệ." />
  else if (id !== undefined && detail.isPending) content = <Spin description="Đang mở dataset…"><div style={{ minHeight: 120 }} /></Spin>
  else if (id !== undefined && detail.error) content = <Alert type="error" showIcon title={detail.error.message} action={<Button onClick={() => { void detail.refetch() }}>Thử lại</Button>} />
  else content = <DatasetEditor key={id ?? 'new'} saved={id === undefined ? undefined : detail.data} />
  return <div className="dataset-workspace">{content}<SavedDatasets /></div>
}

function DatasetEditor({ saved }: { saved?: DatasetDetail }) {
  const [params, setParams] = useSearchParams()
  const client = useQueryClient()
  const [datasetName, setDatasetName] = useState(saved?.name ?? '')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [dirty, setDirty] = useState(false)
  const pending = useRef(false)
  const [columnLabelsBySource, setColumnLabelsBySource] = useState<Record<string, Record<string, string>>>(() => saved ? {
    [JSON.stringify([saved.connectionId, saved.tableName])]: Object.fromEntries(saved.columns.map(c => [c.name, c.displayName])),
  } : {})
  const [settingsBySource,setSettingsBySource] = useState<Record<string,Record<string,ColumnSettings>>>(()=>saved?{
    [JSON.stringify([saved.connectionId,saved.tableName])]:Object.fromEntries(saved.columns.map(c=>[c.name,savedSettings(c)])),
  }:{})
  const rawId = saved ? String(saved.connectionId) : params.get('connectionId') ?? ''
  const connectionId = /^\d+$/.test(rawId) && Number.isSafeInteger(Number(rawId)) && Number(rawId) > 0 ? Number(rawId) : undefined
  const requestedTable = saved?.tableName ?? params.get('table') ?? ''
  const list = useQuery({ queryKey: connectionKeys.list, queryFn: ({ signal }) => connectionsApi.list(signal) })
  const selected = list.data?.find(c => c.id === connectionId)
  const tables = useQuery({ queryKey: connectionKeys.tables(selected?.id), queryFn: ({ signal }) => connectionsApi.tables(selected!.id, signal), enabled: selected !== undefined })
  const table = tables.data?.includes(requestedTable) ? requestedTable : undefined
  const loading = list.isFetching || tables.isFetching
  const activeConnectionId = selected && !tables.error && !list.error ? selected.id : undefined
  const sourceKey = JSON.stringify([activeConnectionId, table])
  const columnSettings = settingsBySource[sourceKey] ?? {}
  const columnLabels = columnLabelsBySource[sourceKey] ?? {}

  function changeColumnLabel(column: string, label: string) {
    setDirty(true); setSaveError('')
    setColumnLabelsBySource(previous => ({
      ...previous,
      [sourceKey]: { ...previous[sourceKey], [column]: label },
    }))
  }

  async function save() {
    if (pending.current) return
    if (!datasetName.trim()) { setSaveError('Hãy nhập tên dataset.'); return }
    if (!activeConnectionId || !table) { setSaveError('Hãy chọn kết nối và bảng hợp lệ.'); return }
    pending.current = true; setSaving(true); setSaveError('')
    try {
      const result = saved
        ? await datasetsApi.update(saved.id, { name: datasetName, columnLabels, columnSettings })
        : await datasetsApi.create({ name: datasetName, connectionId: activeConnectionId, tableName: table, columnLabels, columnSettings })
      client.setQueryData(datasetKeys.detail(result.id), result)
      await client.invalidateQueries({ queryKey: datasetKeys.list })
      setDatasetName(result.name)
      setColumnLabelsBySource(previous => ({ ...previous, [sourceKey]: Object.fromEntries(result.columns.map(c => [c.name, c.displayName])) }))
      setSettingsBySource(previous=>({...previous,[sourceKey]:Object.fromEntries(result.columns.map(c=>[c.name,savedSettings(c)]))}))
      void client.invalidateQueries({ queryKey: ['dataset', result.id] })
      setDirty(false)
      setParams({ datasetId: String(result.id) }, { replace: true })
    } catch (error) { setSaveError((error as Error).message) }
    finally { pending.current = false; setSaving(false) }
  }

  return <>
    <header className="page-heading dataset-heading"><div><h1>Dataset</h1><p>Chọn nguồn, xem trước và lưu cấu hình dataset.</p></div><div className="form-actions"><Button disabled={saving} onClick={() => { setDatasetName(''); setColumnLabelsBySource({}); setSettingsBySource({}); setDirty(false); setSaveError(''); setParams({}) }}>Dataset mới</Button><Button type="primary" onClick={() => { void save() }} loading={saving}>Lưu dataset</Button></div></header>
    <section className="surface dataset-source-panel">
      {saveError && <Alert type="error" showIcon title={saveError} className="section-alert" />}

      {list.error && <Alert type="error" showIcon title={list.error.message} className="section-alert" action={<Button size="small" onClick={() => { void list.refetch() }}>Thử lại</Button>} />}
      {!list.isPending && !list.error && rawId && !selected && <Alert type="warning" title="Kết nối trong đường dẫn không tồn tại. Hãy chọn lại kết nối." className="section-alert" />}
      <div className="dataset-source-fields">
        <div><label htmlFor="dataset-connection">Kết nối</label><Select id="dataset-connection" placeholder="Chọn kết nối đã lưu" style={{ width: '100%' }} value={selected?.id} loading={list.isFetching} disabled={saving || !!saved || list.isPending || !!list.error} options={(list.data ?? []).map(c => ({ value: c.id, label: `${c.name} / ${c.databaseName}` }))} onChange={id => setParams({ connectionId: String(id) })} /></div>
        <div><label htmlFor="dataset-table">Bảng</label><Select id="dataset-table" placeholder="Chọn bảng nguồn" style={{ width: '100%' }} value={table} loading={tables.isFetching} disabled={saving || !!saved || !selected || tables.isPending || !!tables.error} options={(tables.data ?? []).map(t => ({ value: t, label: t }))} onChange={name => setParams({ connectionId: String(selected!.id), table: name })} /></div>
        <div><label htmlFor="dataset-name">Tên dataset</label><Input id="dataset-name" value={datasetName} disabled={saving} onChange={event => { setDatasetName(event.target.value); setDirty(true); setSaveError('') }} placeholder="Ví dụ: Điểm thi Đà Nẵng 2026" maxLength={100} showCount aria-describedby="dataset-name-help" /></div>
      </div>
      <div className="dataset-source-summary">
        <p id="dataset-name-help" className="footnote">{selected && table && !tables.error ? `Đã chọn ${selected.name} → ${table}` : 'Tên, nhãn cột và phép tính được lưu cùng dataset.'}</p>
        {saved && !dirty ? <Tag color="success">Đã lưu dataset</Tag> : dirty ? <Tag color="gold">Có thay đổi chưa lưu</Tag> : null}
      </div>
      {tables.error && <Alert type="error" showIcon title={tables.error.message} className="section-alert" action={<Button size="small" onClick={() => { void tables.refetch() }}>Thử lại</Button>} />}
      <Spin spinning={loading}>
        {!list.isPending && !list.error && !list.data?.length && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có kết nối. Hãy quay về Kết nối để thêm và lưu nguồn dữ liệu." />}
        {selected && !tables.isPending && !tables.error && !tables.data?.length && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Kết nối này không có bảng được phép đọc." />}
        {selected && !tables.isPending && !tables.error && requestedTable && !table && <Alert type="warning" title="Bảng trong đường dẫn không còn khả dụng. Hãy chọn lại bảng." className="dataset-selection" />}
      </Spin>
    </section>
    <div className="dataset-detail-grid dataset-policy-layout">
      <DatasetColumnLabels connectionId={activeConnectionId} table={table} labels={columnLabels} settings={columnSettings} onSettingsChange={(column,policy)=>{ setSettingsBySource(previous=>({...previous,[sourceKey]:{...previous[sourceKey],[column]:policy}})); setDirty(true); setSaveError('') }} onChange={changeColumnLabel} disabled={saving} />
      <DatasetPreview connectionId={activeConnectionId} table={table} datasetId={saved?.id} labels={columnLabels} />
    </div>
  </>
}

