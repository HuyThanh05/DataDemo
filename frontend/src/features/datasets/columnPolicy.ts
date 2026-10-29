import type { ColumnSettings, DatasetColumn } from './types'
import type { Aggregation } from '../charts/types'

export const aggregationOptions: { value: Aggregation; label: string }[] = [
  { value: 'COUNT_DISTINCT', label: 'Đếm giá trị khác nhau (COUNT DISTINCT)' },
  { value: 'COUNT', label: 'Đếm giá trị có dữ liệu (COUNT)' },
  { value: 'SUM', label: 'Tính tổng (SUM)' },
  { value: 'AVG', label: 'Tính trung bình (AVG)' },
  { value: 'MIN', label: 'Giá trị nhỏ nhất (MIN)' },
  { value: 'MAX', label: 'Giá trị lớn nhất (MAX)' },
]
export function numericType(type: string) {
  return /^(tinyint|smallint|mediumint|int|integer|bigint|decimal|numeric|float|double|real)(\b|\()/i.test(type)
}
export function defaultSettings(type: string): ColumnSettings {
  const numeric = numericType(type)
  return { role: numeric ? 'MEASURE' : 'DIMENSION', allowedAggregations: numeric ? ['COUNT','SUM','AVG','MIN','MAX'] : ['COUNT','COUNT_DISTINCT'], defaultAggregation: numeric ? 'AVG' : 'COUNT' }
}
export function savedSettings(column: DatasetColumn): ColumnSettings {
  const fallback = defaultSettings(column.dataType)
  return { role: column.role ?? fallback.role, allowedAggregations: column.allowedAggregations ?? fallback.allowedAggregations, defaultAggregation: column.defaultAggregation === undefined ? fallback.defaultAggregation : column.defaultAggregation }
}
