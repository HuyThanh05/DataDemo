import { expect, test } from '@playwright/test'

test('confirms deletions, explains dependencies and clears selected configuration after success', async ({ page }) => {
  test.setTimeout(60000)
  const connection = { id: 901, name: 'Nguồn kiểm tra xóa', host: 'localhost', port: 3306, databaseName: 'sample', username: 'reader' }
  const dataset = { id: 902, name: 'Dataset kiểm tra xóa', connectionId: 901, tableName: 'exam_scores', columns: [
    { id: 1, name: 'score', displayName: 'Điểm thi', dataType: 'decimal', nullable: false, canGroup: true, canAggregate: true, canFilter: true },
  ] }
  const chart = { id: 903, name: 'Biểu đồ kiểm tra xóa', configuration: { datasetId: 902, chartType: 'bar', dimension: 'score', aggregation: 'COUNT', metricColumn: 'score', sortDirection: 'ASC', filters: [] } }
  const dashboard = { id: 904, name: 'Dashboard kiểm tra xóa' }
  const exists = { connection: true, dataset: true, chart: true, dashboard: true }
  const deletes: string[] = [], errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (!path.startsWith('/api/')) return route.continue()
    const json = (value: unknown, status = 200) => route.fulfill({ status, json: value })
    if (route.request().method() === 'DELETE') {
      deletes.push(path)
      if (path === '/api/connections/901') {
        if (exists.dataset) return json({ code: 'CONNECTION_IN_USE', message: 'Không thể xóa kết nối: đang có 1 dataset sử dụng. Hãy xóa các dataset đó trước.' }, 409)
        exists.connection = false
      } else if (path === '/api/datasets/902') {
        if (exists.chart) return json({ code: 'DATASET_IN_USE', message: 'Không thể xóa dataset: đang có 1 biểu đồ sử dụng. Hãy xóa các biểu đồ đó trước.' }, 409)
        exists.dataset = false
      } else if (path === '/api/charts/903') {
        if (exists.dashboard) return json({ code: 'CHART_IN_USE', message: 'Không thể xóa biểu đồ: đang có 1 dashboard sử dụng. Hãy gỡ biểu đồ khỏi các dashboard đó trước.' }, 409)
        exists.chart = false
      } else if (path === '/api/dashboards/904') exists.dashboard = false
      else throw new Error('Unexpected DELETE: ' + path)
      return route.fulfill({ status: 204 })
    }
    if (path === '/api/connections') return json(exists.connection ? [connection] : [])
    if (path === '/api/connections/901/tables') return json(['exam_scores'])
    if (path === '/api/connections/901/columns') return json([{ name: 'score', dataType: 'decimal', nullable: false }])
    if (path === '/api/datasets') return json(exists.dataset ? [dataset] : [])
    if (path.includes('/preview') && !path.includes('/charts')) return json({ columns: [{ name: 'score', dataType: 'decimal' }], rows: [['5.00']], limit: 100 })
    if (path === '/api/datasets/902') return json(dataset)
    if (path === '/api/charts') return json(exists.chart ? [chart] : [])
    if (path === '/api/charts/903') return json(chart)
    if (path.includes('/preview')) return json({ rows: [{ dimension: '5', value: '1' }], truncated: false, limit: 1000, durationMs: 1 })
    if (path === '/api/dashboards') return json(exists.dashboard ? [dashboard] : [])
    if (path === '/api/dashboards/904') return json(dashboard)
    if (path.endsWith('/charts')) return json(exists.chart ? [chart] : [])
    if (path.endsWith('/layout')) return json([{ chartId: 903, x: 0, y: 0, w: 6, h: 12 }])
    if (path.endsWith('/filter')) return json({ datasetId: null, column: null, value: null })
    throw new Error('Unexpected request: ' + path)
  })
  async function confirm(kind: string, name: string) {
    await page.getByRole('button', { name: `Xóa ${kind} ${name}`, exact: true }).click()
    await expect(page.getByRole('dialog').getByText(name, { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Xác nhận xóa', exact: true }).click()
  }
  async function blocked(kind: string, name: string, reason: RegExp) {
    await confirm(kind, name)
    await expect(page.getByRole('dialog')).toContainText(reason)
    await page.getByRole('button', { name: 'Hủy', exact: true }).click()
  }

  await page.goto('/connections')
  await page.locator('.saved-connection').click()
  await expect(page.getByText('score', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: `Xóa kết nối ${connection.name}`, exact: true }).click()
  await page.getByRole('button', { name: 'Hủy', exact: true }).click()
  expect(deletes).toHaveLength(0)
  await blocked('kết nối', connection.name, /đang có 1 dataset sử dụng/)

  await page.locator('nav a[href="/datasets"]').click()
  await page.getByRole('button', { name: 'Mở', exact: true }).click()
  await expect(page.getByLabel('Tên dataset', { exact: true })).toHaveValue(dataset.name)
  await blocked('dataset', dataset.name, /đang có 1 biểu đồ sử dụng/)
  await expect(page.getByLabel('Tên dataset', { exact: true })).toHaveValue(dataset.name)

  await page.locator('nav a[href="/charts"]').click()
  await page.getByRole('button', { name: 'Mở biểu đồ', exact: true }).click()
  await expect(page.getByLabel('Tên biểu đồ', { exact: true })).toHaveValue(chart.name)
  await blocked('biểu đồ', chart.name, /đang có 1 dashboard sử dụng/)

  await page.locator('nav a[href="/dashboards"]').click()
  await page.getByRole('button', { name: 'Mở dashboard', exact: true }).click()
  await expect(page.locator('.dashboard-chart-card canvas')).toBeVisible()
  await confirm('dashboard', dashboard.name)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page).toHaveURL(/\/dashboards$/)
  await expect(page.getByLabel('Tên dashboard', { exact: true })).toHaveValue('')
  await expect(page.getByRole('button', { name: `Xóa dashboard ${dashboard.name}`, exact: true })).toHaveCount(0)
  expect(exists.chart).toBe(true)
  expect(exists.dataset).toBe(true)

  await page.locator('nav a[href="/charts"]').click()
  await page.getByRole('button', { name: 'Mở biểu đồ', exact: true }).click()
  await expect(page.getByLabel('Tên biểu đồ', { exact: true })).toHaveValue(chart.name)
  await confirm('biểu đồ', chart.name)
  await expect(page).toHaveURL(/\/charts\?datasetId=902$/)
  await expect(page.getByLabel('Tên biểu đồ', { exact: true })).toHaveValue('')
  await page.reload()
  await expect(page.getByRole('button', { name: `Xóa biểu đồ ${chart.name}`, exact: true })).toHaveCount(0)

  await page.locator('nav a[href="/datasets"]').click()
  await page.getByRole('button', { name: 'Mở', exact: true }).click()
  await expect(page.getByLabel('Tên dataset', { exact: true })).toHaveValue(dataset.name)
  await confirm('dataset', dataset.name)
  await expect(page).toHaveURL(/\/datasets$/)
  await expect(page.getByLabel('Tên dataset', { exact: true })).toHaveValue('')
  await page.reload()
  await expect(page.getByRole('button', { name: `Xóa dataset ${dataset.name}`, exact: true })).toHaveCount(0)

  await page.locator('nav a[href="/connections"]').click()
  await page.locator('.saved-connection').click()
  await confirm('kết nối', connection.name)
  await expect(page.locator('.saved-connection')).toHaveCount(0)
  await expect(page.locator('.sidebar-foot')).toContainText('Chọn kết nối để xem bảng')
  await page.reload()
  await expect(page.locator('.saved-connection')).toHaveCount(0)
  expect(exists).toEqual({ connection: false, dataset: false, chart: false, dashboard: false })
  expect(errors).toEqual([])
})
