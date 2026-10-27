import type { ChartType } from './types'

export const chartTypeLabels: Record<ChartType, string> = { bar: 'Cột', line: 'Đường', pie: 'Tròn', table: 'Bảng' }
export const chartTypeOptions = (['bar', 'line', 'pie', 'table'] as const).map(value => ({
  value,
  label: chartTypeLabels[value] + (value === 'pie' ? ' (Pie)' : value === 'table' ? ' (Table)' : ''),
}))
