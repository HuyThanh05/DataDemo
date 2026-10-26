import type { DatasetColumn } from '../datasets/types'
import type { ChartFilter, FilterOperator } from './types'

export const filterOperatorLabels: Record<FilterOperator, string> = {
  EQ: 'Bằng', NE: 'Khác', GT: 'Lớn hơn', GTE: 'Lớn hơn hoặc bằng', LT: 'Nhỏ hơn', LTE: 'Nhỏ hơn hoặc bằng', IS_NULL: 'Không có dữ liệu (NULL)', IS_NOT_NULL: 'Có dữ liệu (khác NULL)',
}
export function numericColumn(column: DatasetColumn) {
  return /^(tinyint|smallint|mediumint|int|integer|bigint|decimal|numeric|float|double|real)(\b|\()/i.test(column.dataType)
}
export function needsFilterValue(operator: FilterOperator) { return operator !== 'IS_NULL' && operator !== 'IS_NOT_NULL' }
export function allowedFilterOperators(column?: DatasetColumn): FilterOperator[] {
  return column && numericColumn(column)
    ? ['EQ', 'NE', 'GT', 'GTE', 'LT', 'LTE', 'IS_NULL', 'IS_NOT_NULL']
    : ['EQ', 'NE', 'IS_NULL', 'IS_NOT_NULL']
}
export function filterError(filter: ChartFilter, columns: DatasetColumn[]): string | undefined {
  const column = columns.find(c => c.name === filter.column && c.canFilter)
  if (!column) return 'Hãy chọn cột lọc.'
  if (!allowedFilterOperators(column).includes(filter.operator)) return 'Điều kiện không phù hợp với cột.'
  if (!needsFilterValue(filter.operator)) return undefined
  if (!filter.value.trim()) return 'Hãy nhập giá trị lọc.'
  if (numericColumn(column) && (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(filter.value.trim()) || !Number.isFinite(Number(filter.value)))) return 'Giá trị lọc phải là số hợp lệ; dùng dấu chấm cho phần thập phân.'
}
