import { useRef, useState } from 'react'
import { Alert, Button, Select } from 'antd'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { datasetKeys, datasetsApi } from '../../datasets/api'
import type { SavedChart } from '../../charts/types'
import { dashboardKeys, dashboardsApi } from '../api'
import type { DashboardFilter } from '../api'

export default function DashboardCommonFilter({ dashboardId,charts,filter,busy }: { dashboardId:number;charts:SavedChart[];filter:DashboardFilter;busy:boolean }) {
  const client=useQueryClient()
  const ids=[...new Set(charts.map(chart=>chart.configuration.datasetId))]
  const [datasetId,setDatasetId]=useState<number | undefined>(filter.datasetId ?? (ids.length===1?ids[0]:undefined))
  const [column,setColumn]=useState<string | undefined>(filter.column ?? undefined)
  const [value,setValue]=useState<string | null>(filter.value)
  const [saving,setSaving]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('')
  const pending=useRef(false)
  const names=useQuery({ queryKey:datasetKeys.list,queryFn:({ signal })=>datasetsApi.list(signal) })
  const validDataset=datasetId!==undefined && ids.includes(datasetId)
  const dataset=useQuery({ queryKey:datasetKeys.detail(datasetId),queryFn:({ signal })=>datasetsApi.get(datasetId!,signal),enabled:validDataset })
  const selectedColumn=dataset.data?.columns.find(c=>c.name===column && c.canFilter)
  const values=useQuery({ queryKey:['dashboard-filter-values',dashboardId,datasetId,column],queryFn:({ signal })=>dashboardsApi.filterValues(dashboardId,datasetId!,column!,signal),enabled:validDataset && !!selectedColumn })
  const draft:DashboardFilter={ datasetId:datasetId ?? null,column:column ?? null,value }
  const dirty=JSON.stringify(draft)!==JSON.stringify(filter)
  const options=[...(values.data?.values ?? [])]
  if(value!==null && !options.includes(value)) options.unshift(value)
  async function apply(next:DashboardFilter) {
    if(pending.current) return
    pending.current=true;setSaving(true);setError('');setNotice('')
    try {
      const result=await dashboardsApi.saveFilter(dashboardId,next)
      client.setQueryData(dashboardKeys.filter(dashboardId),result)
      setDatasetId(result.datasetId ?? undefined);setColumn(result.column ?? undefined);setValue(result.value)
      setNotice('Đã áp dụng và lưu bộ lọc chung.')
    } catch(failure) { setError((failure as Error).message) }
    finally { pending.current=false;setSaving(false) }
  }
  return <section className="dashboard-common-filter">
    <h3>Bộ lọc chung theo môn học</h3>
    <p className="footnote">Chọn dataset và cột Môn học tương ứng. Chỉ các biểu đồ cùng dataset chịu tác động; bộ lọc chung kết hợp bộ lọc riêng bằng VÀ (AND). Tất cả giữ nguyên bộ lọc riêng.</p>
    {error && <Alert type="error" showIcon title={error} className="section-alert" />}
    {notice && !dirty && <Alert type="success" showIcon title={notice} className="section-alert" />}
    {filter.datasetId!==null && !ids.includes(filter.datasetId) && <Alert type="warning" title="Dataset nguồn lọc không còn được dùng trên dashboard. Chọn nguồn khác hoặc tắt bộ lọc chung." className="section-alert" />}
    <div className="dataset-source-fields">
      <div><label htmlFor="common-filter-dataset">Dataset áp dụng bộ lọc</label><Select id="common-filter-dataset" style={{ width:'100%' }} placeholder="Chọn dataset" value={datasetId} disabled={busy || saving} options={ids.map(id=>({ value:id,label:names.data?.find(item=>item.id===id)?.name ?? `Dataset ${id}` }))} onChange={id=>{ setDatasetId(id);setColumn(undefined);setValue(null);setNotice('') }} /></div>
      <div><label htmlFor="common-filter-column">Cột môn học</label><Select id="common-filter-column" style={{ width:'100%' }} placeholder="Chọn cột Môn học" value={selectedColumn?.name} disabled={!validDataset || busy || saving || dataset.isPending || !!dataset.error} loading={dataset.isFetching} options={(dataset.data?.columns ?? []).filter(c=>c.canFilter).map(c=>({ value:c.name,label:c.displayName }))} onChange={name=>{ setColumn(name);setValue(null);setNotice('') }} /></div>
      <div><label htmlFor="common-filter-value">Môn học</label><Select id="common-filter-value" style={{ width:'100%' }} showSearch optionFilterProp="label" value={value===null?'all':JSON.stringify(value)} disabled={!selectedColumn || busy || saving} loading={values.isFetching} options={[{ value:'all',label:'Tất cả' },...options.map(v=>({ value:JSON.stringify(v),label:v }))]} onChange={next=>{ setValue(next==='all'?null:JSON.parse(next));setNotice('') }} /></div>
    </div>
    {dataset.error && <Alert type="error" title={dataset.error.message} action={<Button onClick={()=>{ void dataset.refetch() }}>Tải lại cột</Button>} />}
    {values.error && <Alert type="error" title={values.error.message} action={<Button onClick={()=>{ void values.refetch() }}>Tải lại danh sách môn</Button>} />}
    {values.data?.truncated && <Alert type="warning" title="Danh sách giá trị được giới hạn 1.000 mục; bỏ qua giá trị trống hoặc dài quá 500 ký tự." />}
    {dirty && <p className="footnote">Lựa chọn chưa áp dụng. Bấm Áp dụng bộ lọc để cập nhật biểu đồ và lưu cấu hình.</p>}
    <div className="form-actions"><Button type="primary" aria-label="Áp dụng bộ lọc" loading={saving} disabled={!validDataset || !selectedColumn || busy} onClick={()=>{ void apply(draft) }}>Áp dụng bộ lọc</Button><Button disabled={busy || saving || filter.datasetId===null} onClick={()=>{ void apply({ datasetId:null,column:null,value:null }) }}>Tắt bộ lọc chung</Button></div>
    <p className="footnote">Đang áp dụng: {filter.datasetId===null?'Không có bộ lọc chung':`${names.data?.find(item=>item.id===filter.datasetId)?.name ?? `Dataset ${filter.datasetId}`} · ${filter.value ?? 'Tất cả'}`}. Không thay đổi cấu hình biểu đồ gốc.</p>
  </section>
}
