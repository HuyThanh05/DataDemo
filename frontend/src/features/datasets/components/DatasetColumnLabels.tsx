import { Alert, Button, Empty, Input, Select, Table, Tag } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { connectionKeys, connectionsApi } from '../../connections/api'
import type { ColumnInfo } from '../../connections/types'

import type { ColumnSettings } from '../types'
import { aggregationOptions, defaultSettings, numericType } from '../columnPolicy'

type Props = {
  connectionId?: number
  table?: string
  labels: Record<string, string>
  onChange: (column: string, label: string) => void
  settings?: Record<string, ColumnSettings>
  onSettingsChange?: (column: string, settings: ColumnSettings) => void
  disabled?: boolean
}

export default function DatasetColumnLabels({ connectionId, table, labels, onChange, disabled, settings = {}, onSettingsChange }: Props) {
  const query = useQuery({
    queryKey: connectionKeys.columns(connectionId, table ?? ''),
    queryFn: ({ signal }) => connectionsApi.columns(connectionId!, table!, signal),
    enabled: connectionId !== undefined && !!table,
  })

  return <section className="surface dataset-columns-panel">
    <div className="section-heading"><h2>Cấu hình cột</h2>{query.data && <Tag>{query.data.length} cột</Tag>}</div>
    {!connectionId || !table ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chọn kết nối và bảng để đặt tên hiển thị cho cột." /> : <>
      {query.error && <Alert type="error" showIcon title={query.error.message} className="section-alert" action={<Button size="small" onClick={() => { void query.refetch() }}>Thử lại</Button>} />}
      <Table<ColumnInfo> rowKey="name" size="small" loading={query.isFetching} pagination={false} tableLayout="fixed" scroll={{ x: 980, y: 360 }}
        dataSource={query.error ? [] : query.data ?? []}
        columns={[
          {
            title: 'Tên hiển thị', key: 'displayName', width: 240,
            render: (_, column) => <div><Input
              aria-label={`Tên hiển thị của ${column.name}`}
              value={labels[column.name] ?? column.name}
              placeholder={column.name}
              maxLength={100}
              disabled={disabled}
              onChange={event => onChange(column.name, event.target.value)}
            /><small className="column-original-name"><code>{column.name}</code></small></div>,
          },
          { title: 'Kiểu', dataIndex: 'dataType', width: 110 },
          ...(onSettingsChange ? [
            { title: 'Vai trò', key: 'role', width: 150, render: (_: unknown, c: ColumnInfo) => {
              const policy=settings[c.name] ?? defaultSettings(c.dataType)
              return <Select aria-label={`Vai trò của ${c.name}`} style={{width:'100%'}} disabled={disabled} value={policy.role}
                options={[{value:'IDENTIFIER',label:'Định danh'},{value:'DIMENSION',label:'Phân nhóm'},{value:'MEASURE',label:'Đo lường',disabled:!numericType(c.dataType)}]}
                onChange={role => onSettingsChange(c.name, role === 'MEASURE' ? defaultSettings(c.dataType) : {role,allowedAggregations:role === 'DIMENSION' ? ['COUNT','COUNT_DISTINCT'] : ['COUNT'],defaultAggregation:'COUNT'})} />
            } },
            { title: 'Phép tính cho phép', key: 'allowed', width: 260, render: (_: unknown, c: ColumnInfo) => {
              const policy=settings[c.name] ?? defaultSettings(c.dataType)
              if(policy.role!=='MEASURE') return null
              const options=aggregationOptions.filter(a=>['COUNT','COUNT_DISTINCT'].includes(a.value) || (numericType(c.dataType) && policy.role!=='IDENTIFIER')).map(a=>({value:a.value,label:a.value}))
              return <Select mode="multiple" maxTagCount="responsive" aria-label={`Phép tính cho phép của ${c.name}`} style={{width:'100%'}} disabled={disabled} value={policy.allowedAggregations} options={options}
                onChange={allowedAggregations => onSettingsChange(c.name,{...policy,allowedAggregations,defaultAggregation:policy.defaultAggregation && allowedAggregations.includes(policy.defaultAggregation)?policy.defaultAggregation:allowedAggregations[0] ?? null})} />
            } },
            { title: 'Phép tính mặc định', key: 'default', width: 220, render: (_: unknown, c: ColumnInfo) => {
              const policy=settings[c.name] ?? defaultSettings(c.dataType)
              if(policy.role!=='MEASURE' || policy.allowedAggregations.length < 2) return null
              return <Select allowClear aria-label={`Phép tính mặc định của ${c.name}`} style={{width:'100%'}} disabled={disabled || !policy.allowedAggregations.length} value={policy.defaultAggregation ?? undefined}
                options={aggregationOptions.filter(a=>policy.allowedAggregations.includes(a.value))} placeholder="Không chọn sẵn"
                onChange={value => onSettingsChange(c.name,{...policy,defaultAggregation:value ?? null})} />
            } },
          ] : []),
        ]}
        locale={{ emptyText: query.isFetching ? 'Đang đọc cấu trúc cột…' : query.error ? 'Không tải được cấu trúc cột.' : 'Chưa có cột.' }} />
      <p className="footnote">Chọn Đo lường cho cột muốn tính toán (SUM, AVG...); cột Phân nhóm dùng để nhóm và lọc.</p>
    </>}
  </section>
}
