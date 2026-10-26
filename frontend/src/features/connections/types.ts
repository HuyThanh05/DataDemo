export type ConnectionView = {
  id: number
  name: string
  host: string
  port: number
  databaseName: string
  username: string
}
export type ConnectionInput = Omit<ConnectionView, 'id'> & { password: string }
export type ColumnInfo = { name: string; dataType: string; nullable: boolean }
export type TestResult = { success: boolean; message: string; tables: string[] }
