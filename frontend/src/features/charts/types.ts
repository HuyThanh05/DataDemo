export type ChartType = 'bar' | 'line' | 'pie' | 'table'
export type Aggregation = 'AVG' | 'COUNT' | 'COUNT_DISTINCT' | 'SUM' | 'MIN' | 'MAX'
export type FilterOperator = 'EQ' | 'NE' | 'GT' | 'GTE' | 'LT' | 'LTE' | 'IS_NULL' | 'IS_NOT_NULL'
export type ChartFilter = { id: number; column: string; operator: FilterOperator; value: string }
export type ChartConfiguration = {
  datasetId: number
  chartType: ChartType
  dimension: string
  aggregation: Aggregation
  metricColumn: string
  filters: ChartFilter[]
  sortDirection: 'ASC' | 'DESC'
  bucket?: { min: number; max: number; size: number } | null
}
export type SavedChart = { id: number; name: string; configuration: ChartConfiguration }
export type ChartPreviewResult = { rows: { dimension: string | number | boolean | null; value: string | null }[]; truncated: boolean; limit: number; durationMs: number }
