import { useEffect, useRef, useState } from 'react'
import { Alert, Button, Empty, Table } from 'antd'
import { useQuery } from '@tanstack/react-query'
import ReactECharts from 'echarts-for-react'
import { chartsApi } from '../api'
import type { ChartConfiguration } from '../types'
import type { ChartPreviewResult } from '../types'

export default function ChartPreview({ configuration, dimensionLabel, metricLabel, autoLoad = false, showTable = true, fillHeight = false, previewQuery }: { configuration: ChartConfiguration | undefined; dimensionLabel: string; metricLabel: string; autoLoad?: boolean; showTable?: boolean; fillHeight?: boolean; previewQuery?: { key: readonly unknown[]; load: (signal?: AbortSignal) => Promise<ChartPreviewResult> } }) {
  const query = useQuery({ queryKey: previewQuery?.key ?? ['chart-preview', configuration], queryFn: ({ signal }) => previewQuery ? previewQuery.load(signal) : chartsApi.preview(configuration!, signal), enabled: autoLoad && !!configuration, retry: false })
  const rows = query.data?.rows ?? []
  const isPie = configuration?.chartType === 'pie'
  const isTable = configuration?.chartType === 'table'
  const pieValues = rows.filter(row => row.value !== null).map(row => Number(row.value))
  const invalidPie = pieValues.some(value => !Number.isFinite(value) || value < 0)
  const positivePie = pieValues.some(value => value > 0)
  const hasCanvas = rows.length > 0 && !isTable && (!isPie || (!invalidPie && positivePie))
  const canvasRef = useRef<HTMLDivElement>(null)
  const [canvasWidth, setCanvasWidth] = useState(800)
  useEffect(() => {
    const element = canvasRef.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0) setCanvasWidth(Math.floor(entry.contentRect.width))
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [hasCanvas, configuration?.chartType])
  const label = (value: string | number | boolean | null) => {
    if (value === null) return '(Không có dữ liệu)'
    const bucket = configuration?.bucket
    if (bucket) {
      const lower = Number(value), upper = Number((lower + Number(bucket.size)).toFixed(10))
      return `[${lower}, ${upper}${Math.abs(upper - Number(bucket.max)) < 1e-9 ? ']' : ')'}`
    }
    return String(value)
  }
  const labels = rows.map(row => label(row.dimension))
  const pieRows = rows.flatMap((row, index) => row.value === null ? [] : [{
    name: labels[index], exactValue: row.value, value: Number(row.value),
    itemStyle: { color: `hsl(${(index * 137.508 + 215) % 360}, 65%, 48%)` },
  }])
  const pieTotal = pieValues.reduce((total, value) => total + value, 0)
  const longestLabel = labels.reduce((longest, value) => Math.max(longest, Array.from(value).length), 0)
  const availableWidth = Math.max(80, canvasWidth - 110)
  const categoryWidth = availableWidth / Math.max(1, rows.length)
  const fontSize = categoryWidth < 22 ? 10 : 12
  const lineHeight = fontSize + 4
  const labelWidth = Math.max(32, Math.min(240, longestLabel * fontSize * 0.6 + 8))
  const rotation = labelWidth <= categoryWidth - 8 ? 0
    : categoryWidth >= lineHeight / Math.sin(Math.PI / 4) + 4 ? 45
      : categoryWidth >= lineHeight / Math.sin(Math.PI / 3) + 2 ? 60 : 90
  const radians = rotation * Math.PI / 180
  const labelHeight = Math.ceil(labelWidth * Math.sin(radians) + lineHeight * Math.cos(radians))
  const leftPadding = rotation ? Math.max(14, Math.ceil(labelWidth * Math.cos(radians)) + 12) : 14
  const crowded = categoryWidth < fontSize + 2
  return <div className={`chart-preview${fillHeight ? ' chart-preview-fill' : ''}`}>
    <div className="section-heading"><h3>{autoLoad ? 'Dữ liệu biểu đồ' : 'Xem trước biểu đồ'}</h3><Button type="primary" aria-label={autoLoad ? 'Làm mới dữ liệu' : 'Xem trước'} disabled={!configuration} loading={query.isFetching} onClick={() => { void query.refetch() }}>{autoLoad ? 'Làm mới dữ liệu' : 'Xem trước'}</Button></div>
    {query.error && <Alert type="error" showIcon title={query.error.message} className="section-alert" />}
    {!query.data && !query.error && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={query.isFetching ? 'Đang truy vấn dữ liệu…' : configuration ? 'Bấm Xem trước để truy vấn dữ liệu thật.' : 'Hoàn tất cấu hình và bộ lọc để xem trước.'} />}
    {query.data && <>
      {query.data.truncated && <Alert type="warning" showIcon title={`Chỉ hiển thị ${query.data.limit} nhóm đầu theo thứ tự đã chọn. Hãy thêm bộ lọc hoặc chọn cột chia nhóm khác để xem đầy đủ.`} className="section-alert" />}
      {!rows.length ? <Empty description="Không có dữ liệu phù hợp với bộ lọc." /> : <>
        {isPie && invalidPie && <Alert type="warning" showIcon title="Biểu đồ tròn cần giá trị không âm. Hãy chọn cách tính khác hoặc dùng biểu đồ cột, đường hay bảng." />}
        {isPie && !invalidPie && !positivePie && <Empty description="Chưa có giá trị lớn hơn 0 để vẽ biểu đồ tròn." />}
        {hasCanvas && <div ref={canvasRef} className="chart-canvas" style={fillHeight ? { minHeight: 340, flex: 1 } : { height: 420 }}><ReactECharts notMerge option={isPie ? {
          tooltip: { trigger: 'item', renderMode: 'richText', confine: true },
          series: [{
            type: 'pie', name: metricLabel, radius: '68%', center: ['50%', '50%'],
            data: pieRows, stillShowZeroSum: false, avoidLabelOverlap: true,
            label: { show: pieRows.length <= 12, formatter: '{d}%', fontSize: 12 },
            labelLine: { show: pieRows.length <= 12 },
          }],
        } : {
          tooltip: { trigger: 'axis', renderMode: 'richText', confine: true },
          grid: { left: leftPadding, right: 24, top: 42, bottom: 44, containLabel: true },
          xAxis: {
            type: 'category', name: dimensionLabel, nameLocation: 'middle', nameGap: labelHeight + 18, data: labels,
            nameTextStyle: { width: Math.max(80, canvasWidth - leftPadding - 48), overflow: 'truncate' },
            axisLabel: {
              interval: 0, hideOverlap: false, margin: 12, fontSize, lineHeight, rotate: rotation,
              width: labelWidth, overflow: 'truncate',
            },
          },
          yAxis: { type: 'value', name: metricLabel, nameTextStyle: { align: 'left', width: Math.max(80, canvasWidth - leftPadding - 48), overflow: 'truncate' } },
          series: [{ type: configuration!.chartType, name: metricLabel, data: rows.map(row => row.value === null ? null : Number(row.value)), itemStyle: { color: '#2870e8' }, connectNulls: false }],
          dataZoom: [],
        }} style={{ height: '100%', width: '100%' }} /></div>}
        {isPie && !invalidPie && positivePie && <ul className="chart-pie-legend" aria-label="Chú giải biểu đồ tròn">{pieRows.map((row, index) => <li key={index}>
          <span className="chart-pie-marker" style={{ backgroundColor: row.itemStyle.color }} />
          <span><strong>{row.name}</strong><small>{row.exactValue} · {(row.value / pieTotal * 100).toLocaleString('vi-VN', { maximumFractionDigits: 2 })}%</small></span>
        </li>)}</ul>}
        {isPie && rows.some(row => row.value === null) && <p className="footnote">Có {rows.filter(row => row.value === null).length} nhóm có kết quả NULL, không tạo phần trong biểu đồ tròn.</p>}
        {isPie && !invalidPie && positivePie && <p className="footnote">Tỷ trọng được tính trên tổng các giá trị sau khi nhóm và tính toán. Rê chuột vào từng phần để xem tên và giá trị.</p>}
        {!isPie && !isTable && crowded && <p className="footnote">Đang hiển thị toàn bộ {rows.length} nhóm trong khung hẹp. Phóng to biểu đồ hoặc thêm bộ lọc để đọc rõ tên từng nhóm.</p>}
        {!isPie && !isTable && <p className="footnote">Hiển thị toàn bộ nhóm; tên tự nghiêng khi không đủ chỗ. Rê chuột vào biểu đồ để xem đầy đủ tên và giá trị.</p>}
        {(isTable || showTable) && <Table className="chart-result-table" rowKey="key" size="small" pagination={{ pageSize: 10, hideOnSinglePage: true, showSizeChanger: false }} dataSource={rows.map((row, key) => ({ ...row, key }))} columns={[
          { title: dimensionLabel, dataIndex: 'dimension', render: label },
          { title: metricLabel, dataIndex: 'value', render: value => value === null ? 'NULL' : value },
        ]} />}
      </>}
      <p className="footnote">Số nhóm hiển thị: {rows.length}. Thời gian truy vấn: {query.data.durationMs} ms. Tổng hợp trên dữ liệu nguồn sau khi lọc, không chỉ 100 dòng xem mẫu của Dataset. Bảng giữ giá trị chính xác; biểu đồ hiển thị dưới dạng số.</p>
    </>}
  </div>
}
