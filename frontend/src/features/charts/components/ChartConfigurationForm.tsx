import { useState } from 'react'
import { Alert, Button, Form, Input, InputNumber, Select } from 'antd'
import { useQueryClient } from '@tanstack/react-query'
import type { DatasetDetail } from '../../datasets/types'
import type { Aggregation, ChartType, ChartFilter, ChartConfiguration, SavedChart } from '../types'
import { chartsApi } from '../api'
import { chartTypeLabels, chartTypeOptions } from '../chartTypes'
import ChartPreview from './ChartPreview'
import ChartFilters from './ChartFilters'
import { aggregationOptions, savedSettings } from '../../datasets/columnPolicy'
import { filterError, filterOperatorLabels, needsFilterValue, numericColumn } from '../filters'

export default function ChartConfigurationForm({ dataset, saved, onSaved }: { dataset: DatasetDetail; saved?: SavedChart; onSaved?: (chart: SavedChart) => void }) {
  const client = useQueryClient()
  const initial = saved?.configuration
  const [chartType, setChartType] = useState<ChartType>(initial?.chartType ?? 'bar')
  const [aggregation, setAggregation] = useState<Aggregation>(initial?.aggregation ?? 'AVG')
  const [dimensionName, setDimensionName] = useState<string | undefined>(initial?.dimension)
  const [metricName, setMetricName] = useState<string | undefined>(initial?.metricColumn)
  const [filters, setFilters] = useState<ChartFilter[]>(() => initial?.filters?.map((filter,index) => ({ ...filter, id: index + 1 })) ?? [])
  const [sortDirection, setSortDirection] = useState<'ASC' | 'DESC'>(initial?.sortDirection ?? 'ASC')
  const [grouping, setGrouping] = useState(initial?.bucket ? 'interval' : 'value')
  const [min, setMin] = useState<number | null>(initial?.bucket?.min ?? 0)
  const [max, setMax] = useState<number | null>(initial?.bucket?.max ?? 10)
  const [size, setSize] = useState<number | null>(initial?.bucket?.size ?? 1)
  const [name, setName] = useState(saved?.name ?? '')
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [saveError, setSaveError] = useState('')
  const filtersValid = filters.every(filter => !filterError(filter, dataset.columns))
  const dimensions = dataset.columns.filter(column => column.canGroup)
  const metrics = dataset.columns.filter(column => savedSettings(column).allowedAggregations.length > 0)
  const dimension = dimensions.find(column => column.name === dimensionName)
  const metric = metrics.find(column => column.name === metricName)
  const bucketValid = grouping === 'value' || !!(dimension && numericColumn(dimension) && min !== null && max !== null && size !== null && size > 0 && max > min && (max - min) / size <= 1000 && Math.abs((max - min) / size - Math.round((max - min) / size)) < 1e-9)
  const configuration: ChartConfiguration | undefined = dimension && metric && savedSettings(metric).allowedAggregations.includes(aggregation) && filtersValid && bucketValid ? {
    datasetId: dataset.id, chartType, dimension: dimension.name, aggregation, metricColumn: metric.name, sortDirection, filters,
    bucket: grouping === 'interval' ? { min: min!, max: max!, size: size! } : null,
  } : undefined
  const options = (columns: typeof dataset.columns) => columns.map(column => ({ value: column.name, label: column.displayName }))

  function changeAggregation(value: Aggregation) {
    setAggregation(value)
    setNotice('')
  }
  async function save() {
    if (!configuration || saving) return
    setSaving(true); setSaveError(''); setNotice('')
    try {
      const result = await chartsApi.save(saved?.id, name, configuration)
      client.setQueryData(['chart',result.id],result)
      await client.invalidateQueries({ queryKey: ['charts'] })
      setNotice('Đã lưu biểu đồ.'); onSaved?.(result)
    } catch (error) { setSaveError((error as Error).message) }
    finally { setSaving(false) }
  }

  return <section className="surface dataset-saved-panel">
    <h2>Cấu hình biểu đồ</h2>
    {saveError && <Alert type="error" showIcon title={saveError} className="section-alert" />}
    {notice && <Alert type="success" showIcon title={notice} className="section-alert" />}
    <Form layout="vertical" disabled={saving} onValuesChange={() => setNotice('')}>
      <Form.Item label="Tên biểu đồ" htmlFor="chart-name"><Input id="chart-name" value={name} maxLength={100} placeholder="Nhập tên biểu đồ" onChange={e => { setName(e.target.value); setNotice('') }} /></Form.Item>
      <div className="chart-configuration-fields">
        <Form.Item label="Loại biểu đồ" htmlFor="chart-type"><Select id="chart-type" value={chartType} onChange={setChartType} options={chartTypeOptions} /></Form.Item>
        <Form.Item label="Nhóm dữ liệu theo (Dimension)" htmlFor="chart-dimension" required><Select id="chart-dimension" placeholder="Chọn cột để chia nhóm" value={dimension?.name} onChange={value => { setDimensionName(value); setGrouping('value') }} showSearch optionFilterProp="label" options={options(dimensions)} /></Form.Item>
        <Form.Item label="Cách chia nhóm (Grouping)" htmlFor="chart-grouping"><Select id="chart-grouping" value={grouping} onChange={setGrouping} options={[{ value: 'value', label: 'Theo từng giá trị' }, { value: 'interval', label: 'Theo khoảng số', disabled: !dimension || !numericColumn(dimension) }]} /></Form.Item>
        <Form.Item label="Cột dùng để tính (Metric Column)" htmlFor="chart-metric" required><Select id="chart-metric" placeholder="Chọn cột dùng để tính trước" value={metric?.name} onChange={value => {
          setMetricName(value); setNotice('')
          const selected=metrics.find(c=>c.name===value)
          if(selected) { const policy=savedSettings(selected); setAggregation(policy.defaultAggregation ?? policy.allowedAggregations[0]) }
        }} showSearch optionFilterProp="label" options={options(metrics)} /></Form.Item>
        <Form.Item label="Cách tính cho mỗi nhóm (Aggregation)" htmlFor="chart-aggregation"><Select id="chart-aggregation" disabled={!metric} placeholder="Chọn cột dùng để tính trước" value={metric && savedSettings(metric).allowedAggregations.includes(aggregation) ? aggregation : undefined} onChange={changeAggregation} options={aggregationOptions.filter(a=>metric && savedSettings(metric).allowedAggregations.includes(a.value))} /></Form.Item>
        <Form.Item label="Thứ tự các nhóm (Sort Order)" htmlFor="chart-sort"><Select id="chart-sort" value={sortDirection} onChange={setSortDirection} options={[{ value: 'ASC', label: 'Tăng dần' }, { value: 'DESC', label: 'Giảm dần' }]} /></Form.Item>
      </div>
      {grouping === 'interval' && <>
        <div className="chart-configuration-fields">
          <Form.Item label="Giá trị đầu" htmlFor="bucket-min"><InputNumber id="bucket-min" value={min} onChange={setMin} /></Form.Item>
          <Form.Item label="Giá trị cuối" htmlFor="bucket-max"><InputNumber id="bucket-max" value={max} onChange={setMax} /></Form.Item>
          <Form.Item label="Độ rộng khoảng" htmlFor="bucket-size"><InputNumber id="bucket-size" value={size} onChange={setSize} /></Form.Item>
        </div>
        <p className="footnote">Chỉ xét dữ liệu trong đoạn từ giá trị đầu đến giá trị cuối; bỏ NULL và dữ liệu ngoài đoạn. Mỗi khoảng gồm cận trái, không gồm cận phải; khoảng cuối gồm cả giá trị cuối. Khoảng không có dữ liệu sẽ không xuất hiện.</p>
        {!bucketValid && <Alert type="error" title="Đoạn phải chia hết cho độ rộng dương và có từ 1 đến 1.000 khoảng." className="section-alert" />}
      </>}
      <ChartFilters columns={dataset.columns} filters={filters} onChange={setFilters} />
    </Form>
    {!dimensions.length && <Alert type="warning" showIcon title="Dataset không có cột được phép nhóm." className="section-alert" />}
    {!metrics.length && <Alert type="warning" showIcon title="Dataset chưa có cột được phép tính. Hãy cấu hình phép tính trong Dataset." className="section-alert" />}
    <p className="footnote">Dữ liệu được chia thành nhóm theo cột đã chọn, rồi tính riêng cho từng nhóm. AVG (trung bình), SUM (tổng), MIN (nhỏ nhất) và MAX (lớn nhất) áp dụng cho cột số. Đếm giá trị có dữ liệu (COUNT) đếm các giá trị khác NULL, kể cả 0. Các cách tính đều bỏ qua NULL.</p>
    {dimension && metric && filtersValid && bucketValid
      ? <Alert type="success" showIcon title="Đã chọn đủ cấu hình cơ bản." description={`${chartType === 'table' ? 'Bảng' : `Biểu đồ ${chartTypeLabels[chartType].toLowerCase()}`} · Nhóm theo ${dimension.displayName} · ${aggregation}(${metric.displayName})`} />
      : <Alert type="info" showIcon title={dimension && metric ? 'Hãy hoàn tất hoặc xóa bộ lọc chưa hợp lệ.' : 'Chọn cột chia nhóm và cột dùng để tính để hoàn tất cấu hình cơ bản.'} />}
    {filters.length > 0 && filtersValid && <p className="footnote">Lọc: {filters.map(filter => `${dataset.columns.find(column => column.name === filter.column)!.displayName} ${filterOperatorLabels[filter.operator]}${needsFilterValue(filter.operator) ? ` “${filter.value}”` : ''}`).join(' VÀ ')}</p>}
    <p className="footnote">Các nhóm được sắp xếp theo giá trị của cột chia nhóm, dùng kiểu dữ liệu gốc trong MySQL. Bấm Lưu biểu đồ để giữ cấu hình; dữ liệu được truy vấn lại khi xem trước.</p>
    <Button type="primary" loading={saving} disabled={!configuration || !name.trim()} onClick={() => { void save() }}>Lưu biểu đồ</Button>
    <ChartPreview key={JSON.stringify(configuration)} configuration={configuration} dimensionLabel={dimension?.displayName ?? ''} metricLabel={`${aggregation}(${metric?.displayName ?? ''})`} />
  </section>
}
