import { Alert, Button, Empty, Table } from 'antd'
import { useQuery } from '@tanstack/react-query'
import ReactECharts from 'echarts-for-react'
import { chartsApi } from '../api'
import type { ChartConfiguration } from '../types'
import type { ChartPreviewResult } from '../types'

export default function ChartPreview({ configuration, dimensionLabel, metricLabel, autoLoad = false, showTable = true, fillHeight = false, previewQuery }: { configuration: ChartConfiguration | undefined; dimensionLabel: string; metricLabel: string; autoLoad?: boolean; showTable?: boolean; fillHeight?: boolean; previewQuery?: { key: readonly unknown[]; load: (signal?: AbortSignal) => Promise<ChartPreviewResult> } }) {
  const query = useQuery({ queryKey: previewQuery?.key ?? ['chart-preview', configuration], queryFn: ({ signal }) => previewQuery ? previewQuery.load(signal) : chartsApi.preview(configuration!, signal), enabled: autoLoad && !!configuration, retry: false })
  const rows = query.data?.rows ?? []
  const label = (value: string | number | boolean | null) => {
    if (value === null) return '(Không có dữ liệu)'
    const bucket = configuration?.bucket
    if (bucket) {
      const lower = Number(value), upper = Number((lower + Number(bucket.size)).toFixed(10))
      return `[${lower}, ${upper}${Math.abs(upper - Number(bucket.max)) < 1e-9 ? ']' : ')'}`
    }
    return String(value)
  }
  return <div className={`chart-preview${fillHeight ? ' chart-preview-fill' : ''}`}>
    <div className="section-heading"><h3>{autoLoad ? 'Dữ liệu biểu đồ' : 'Xem trước biểu đồ'}</h3><Button type="primary" disabled={!configuration} loading={query.isFetching} onClick={() => { void query.refetch() }}>{autoLoad ? 'Làm mới dữ liệu' : 'Xem trước'}</Button></div>
    {query.error && <Alert type="error" showIcon title={query.error.message} className="section-alert" />}
    {!query.data && !query.error && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={query.isFetching ? 'Đang truy vấn dữ liệu…' : configuration ? 'Bấm Xem trước để truy vấn dữ liệu thật.' : 'Hoàn tất cấu hình và bộ lọc để xem trước.'} />}
    {query.data && <>
      {query.data.truncated && <Alert type="warning" showIcon title={`Chỉ hiển thị ${query.data.limit} nhóm đầu theo thứ tự đã chọn. Hãy thêm bộ lọc hoặc chọn dimension khác để xem đầy đủ.`} className="section-alert" />}
      {!rows.length ? <Empty description="Không có dữ liệu phù hợp với bộ lọc." /> : <>
        <ReactECharts notMerge option={{
          tooltip: { trigger: 'axis', renderMode: 'richText' },
          grid: { left: 65, right: 25, top: 30, bottom: 85 },
          xAxis: { type: 'category', name: dimensionLabel, nameLocation: 'middle', nameGap: 45, data: rows.map(row => label(row.dimension)) },
          yAxis: { type: 'value', name: metricLabel },
          series: [{ type: configuration!.chartType, name: metricLabel, data: rows.map(row => row.value === null ? null : Number(row.value)), itemStyle: { color: '#2870e8' }, connectNulls: false }],
          dataZoom: rows.length > 30 ? [{ type: 'slider', bottom: 0 }, { type: 'inside' }] : [],
        }} style={fillHeight ? { height:'100%',minHeight:180,flex:1 } : { height: 380 }} />
        {showTable && <Table rowKey="key" size="small" pagination={{ pageSize: 10, hideOnSinglePage: true }} dataSource={rows.map((row, key) => ({ ...row, key }))} columns={[
          { title: dimensionLabel, dataIndex: 'dimension', render: label },
          { title: metricLabel, dataIndex: 'value', render: value => value === null ? 'NULL' : value },
        ]} />}
      </>}
      <p className="footnote">Số nhóm hiển thị: {rows.length}. Thời gian truy vấn: {query.data.durationMs} ms. Tổng hợp trên dữ liệu nguồn sau khi lọc, không chỉ 100 dòng xem mẫu của Dataset. Bảng giữ giá trị chính xác; biểu đồ hiển thị dưới dạng số.</p>
    </>}
  </div>
}
