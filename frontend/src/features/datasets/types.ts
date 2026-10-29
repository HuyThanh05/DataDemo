import type { Aggregation } from '../charts/types'
export type ColumnSettings = { role: 'IDENTIFIER' | 'DIMENSION' | 'MEASURE'; allowedAggregations: Aggregation[]; defaultAggregation: Aggregation | null }
export type DatasetSource = { connectionId: number; tableName: string }
export type DatasetSummary = DatasetSource & { id: number; name: string }
export type DatasetColumn = { id: number; name: string; displayName: string; dataType: string; nullable: boolean; canGroup: boolean; canAggregate: boolean; canFilter: boolean; role?: ColumnSettings['role']; allowedAggregations?: Aggregation[]; defaultAggregation?: Aggregation | null }
export type DatasetDetail = DatasetSummary & { columns: DatasetColumn[] }
export type DatasetCreate = DatasetSource & { name: string; columnLabels: Record<string, string>; columnSettings?: Record<string, ColumnSettings> }
export type PreviewValue = string | number | boolean | null
export type TablePreview = {
  columns: { name: string; dataType: string }[]
  rows: PreviewValue[][]
  limit: number
}
