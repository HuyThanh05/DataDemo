import { useRef } from 'react'
import { Button, Empty, Form, Input, Select } from 'antd'
import type { DatasetColumn } from '../../datasets/types'
import type { ChartFilter } from '../types'
import { allowedFilterOperators, filterError, filterOperatorLabels, needsFilterValue, numericColumn } from '../filters'

export default function ChartFilters({ columns, filters, onChange }: { columns: DatasetColumn[]; filters: ChartFilter[]; onChange: (filters: ChartFilter[]) => void }) {
  const nextId = useRef(Math.max(0, ...filters.map(filter => filter.id)) + 1)
  const available = columns.filter(column => column.canFilter)
  function update(id: number, change: Partial<ChartFilter>) { onChange(filters.map(filter => filter.id === id ? { ...filter, ...change } : filter)) }
  return <div className="chart-filters">
    <div className="section-heading"><h3>Bộ lọc</h3><Button disabled={!available.length || filters.length >= 10} onClick={() => onChange([...filters, { id: nextId.current++, column: '', operator: 'EQ', value: '' }])}>+ Thêm bộ lọc</Button></div>
    <p className="footnote">Các điều kiện kết hợp bằng VÀ (AND): một dòng dữ liệu phải thỏa tất cả điều kiện. Tối đa 10 bộ lọc.</p>
    {!filters.length && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có bộ lọc; sử dụng toàn bộ dữ liệu." />}
    {filters.map((filter, index) => {
      const column = available.find(c => c.name === filter.column)
      const error = filterError(filter, columns)
      return <div className="chart-filter-row" key={filter.id}>
        <Form.Item label={`Cột lọc ${index + 1}`} htmlFor={`filter-column-${filter.id}`}><Select id={`filter-column-${filter.id}`} placeholder="Chọn cột" value={column?.name} showSearch optionFilterProp="label" options={available.map(c => ({ value: c.name, label: c.displayName }))} onChange={name => update(filter.id, { column: name, operator: 'EQ', value: '' })} /></Form.Item>
        <Form.Item label={`Điều kiện ${index + 1}`} htmlFor={`filter-operator-${filter.id}`}><Select id={`filter-operator-${filter.id}`} disabled={!column} value={filter.operator} options={allowedFilterOperators(column).map(value => ({ value, label: filterOperatorLabels[value] }))} onChange={operator => update(filter.id, { operator, ...(!needsFilterValue(operator) ? { value: '' } : {}) })} /></Form.Item>
        <Form.Item label={`Giá trị lọc ${index + 1}`} htmlFor={`filter-value-${filter.id}`} validateStatus={error ? 'error' : undefined} help={error}>
          <Input id={`filter-value-${filter.id}`} value={filter.value} disabled={!column || !needsFilterValue(filter.operator)} inputMode={column && numericColumn(column) ? 'decimal' : 'text'} maxLength={500} placeholder={needsFilterValue(filter.operator) ? 'Nhập giá trị' : 'Không cần nhập giá trị'} onChange={event => update(filter.id, { value: event.target.value })} />
        </Form.Item>
        <Button danger aria-label={`Xóa bộ lọc ${index + 1}`} onClick={() => onChange(filters.filter(item => item.id !== filter.id))}>Xóa</Button>
      </div>
    })}
  </div>
}
