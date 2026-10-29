import { expect, test } from '@playwright/test'
import type { ChartConfiguration, SavedChart } from '../src/features/charts/types'

test('pie and table can be previewed, reopened and filtered together on a dashboard', async ({ page }, testInfo) => {
  test.setTimeout(60000)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  const names = ['Toán', 'Ngữ văn', 'Vật lý', 'Hóa học', 'Sinh học', 'Lịch sử', 'Địa lý', 'Giáo dục kinh tế và pháp luật', 'Công nghệ công nghiệp', 'Công nghệ nông nghiệp', 'Tin học', 'Tiếng Anh', 'Tiếng Đức', 'Tiếng Nga', 'Tiếng Pháp', 'Tiếng Nhật', 'Tiếng Hàn']
  const rows = names.map((dimension, index) => ({ dimension, value: String(index + 1) }))
  const dataset = { id: 901, name: 'Dataset demo', tableName: 'example', connectionId: 1, columns: [
    { id: 1, name: 'subject', displayName: 'Môn học', dataType: 'varchar', canGroup: true, canAggregate: false, canFilter: true },
    { id: 2, name: 'score', displayName: 'Điểm thi', dataType: 'decimal', canGroup: true, canAggregate: true, canFilter: true },
  ] }
  const saved: SavedChart[] = [], linked: number[] = []
  let dashboard: { id: number; name: string } | undefined
  let filter: { datasetId: number | null; column: string | null; value: string | null } = { datasetId: null, column: null, value: null }
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname, method = route.request().method()
    if (!path.startsWith('/api/')) return route.continue()
    const json = (value: unknown, status = 200) => route.fulfill({ json: value, status })
    if (path === '/api/datasets') return json([dataset])
    if (path === '/api/datasets/901') return json(dataset)
    if (path === '/api/charts/preview') return json({ rows, truncated: false, limit: 1000, durationMs: 1 })
    if (path === '/api/charts') {
      if (method === 'POST') {
        const body = route.request().postDataJSON() as { name: string; configuration: ChartConfiguration }
        const chart = { id: 501 + saved.length, ...body }; saved.push(chart); return json(chart, 201)
      }
      return json(saved)
    }
    if (/^\/api\/charts\/\d+$/.test(path)) return json(saved.find(chart => chart.id === Number(path.split('/').pop())))
    if (path === '/api/dashboards') {
      if (method === 'POST') { dashboard = { id: 99, name: route.request().postDataJSON().name }; return json(dashboard, 201) }
      return json(dashboard ? [dashboard] : [])
    }
    if (path === '/api/dashboards/99') return json(dashboard)
    if (path === '/api/dashboards/99/charts') {
      if (method === 'POST') linked.push(route.request().postDataJSON().chartId)
      return json(saved.filter(chart => linked.includes(chart.id)))
    }
    if (path === '/api/dashboards/99/layout') return json(linked.map((chartId, index) => ({ chartId, x: index * 6, y: 0, w: 6, h: 20 })))
    if (path === '/api/dashboards/99/filter') {
      if (method === 'PUT') filter = route.request().postDataJSON()
      return json(filter)
    }
    if (path === '/api/dashboards/99/filter-values') return json({ values: names, truncated: false })
    if (/^\/api\/dashboards\/99\/charts\/\d+\/preview$/.test(path))
      return json({ rows: filter.value === null ? rows : rows.filter(row => row.dimension === filter.value), truncated: false, limit: 1000, durationMs: 1 })
    throw new Error('Unexpected API: ' + path)
  })
  async function choose(id: string, label: string) {
    const input = page.locator('#' + id)
    await input.click()
    const popup = page.locator('#' + await input.getAttribute('aria-controls')).locator('xpath=ancestor::div[contains(@class,"ant-select-dropdown")][1]')
    await popup.locator('.ant-select-item-option-content').filter({ hasText: new RegExp('^' + label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') }).click()
  }
  await page.setViewportSize({ width: 1600, height: 1200 })
  for (const [type, option, name] of [['pie', 'Tròn (Pie)', 'Tỷ trọng môn học'], ['table', 'Bảng (Table)', 'Số bài theo môn']] as const) {
    await page.goto('/charts?datasetId=901')
    await choose('chart-type', option)
    await choose('chart-dimension', 'Môn học')
    await choose('chart-metric', 'Điểm thi')
    await choose('chart-aggregation', 'Đếm giá trị có dữ liệu (COUNT)')
    await page.getByLabel('Tên biểu đồ', { exact: true }).fill(name)
    const request = page.waitForRequest('**/api/charts/preview')
    await page.getByRole('button', { name: 'Xem trước', exact: true }).click()
    expect((await request).postDataJSON().chartType).toBe(type)
    if (type === 'pie') {
      await expect(page.locator('.chart-canvas canvas')).toBeVisible()
      await expect(page.getByRole('list', { name: 'Chú giải biểu đồ tròn' }).locator('li')).toHaveCount(17)
      await expect(page.getByRole('list', { name: 'Chú giải biểu đồ tròn' })).toContainText('Giáo dục kinh tế và pháp luật')
      await page.waitForTimeout(1200)
      await page.locator('.chart-canvas').screenshot({ path: testInfo.outputPath('pie-preview.png') })
    } else {
      await expect(page.locator('.chart-canvas')).toHaveCount(0)
      await expect(page.locator('.chart-result-table')).toHaveCount(1)
      await page.locator('.chart-result-table .ant-pagination-item-2').click()
      await expect(page.locator('.chart-result-table')).toContainText('Tiếng Hàn')
    }
    await page.getByRole('button', { name: 'Lưu biểu đồ', exact: true }).click()
    await expect(page).toHaveURL(/chartId=\d+/)
    await page.reload()
    await expect(page.getByLabel('Tên biểu đồ', { exact: true })).toHaveValue(name)
    await expect(page.locator('#chart-type').locator('..')).toContainText(option)
    await page.getByRole('button', { name: 'Xem trước', exact: true }).click()
    await expect(page.locator('.chart-result-table')).toContainText('Toán')
  }
  expect(saved.map(chart => chart.configuration.chartType)).toEqual(['pie', 'table'])

  await page.goto('/dashboards')
  await page.getByLabel('Tên dashboard', { exact: true }).fill('Dashboard tròn và bảng')
  await page.getByRole('button', { name: 'Lưu dashboard', exact: true }).click()
  await expect(page).toHaveURL(/dashboardId=99/)
  for (const chart of saved) {
    await choose('dashboard-chart-picker', chart.name)
    await page.getByRole('button', { name: '+ Thêm biểu đồ', exact: true }).click()
    await expect(page.getByRole('region', { name: `Biểu đồ ${chart.name}`, exact: true })).toBeVisible()
  }
  await page.reload()
  const pie = page.getByRole('region', { name: 'Biểu đồ Tỷ trọng môn học', exact: true })
  const table = page.getByRole('region', { name: 'Biểu đồ Số bài theo môn', exact: true })
  await expect(pie.locator('canvas')).toBeVisible()
  await expect(table.locator('.chart-result-table')).toContainText('Toán')
  await expect(table.locator('canvas')).toHaveCount(0)
  await choose('common-filter-column', 'Môn học')
  await choose('common-filter-value', 'Toán')
  await page.getByRole('button', { name: 'Áp dụng bộ lọc', exact: true }).click()
  await expect(pie.getByRole('list', { name: 'Chú giải biểu đồ tròn' }).locator('li')).toHaveCount(1)
  await expect(table.locator('.chart-result-table tbody tr')).toHaveCount(1)
  await expect(table.locator('.chart-result-table')).not.toContainText('Ngữ văn')
  await page.reload()
  await expect(pie.getByRole('list', { name: 'Chú giải biểu đồ tròn' }).locator('li')).toHaveCount(1)
  await expect(table.locator('.chart-result-table tbody tr')).toHaveCount(1)
  await page.waitForTimeout(1200)
  await page.locator('.dashboard-grid-area').screenshot({ path: testInfo.outputPath('pie-table-dashboard.png') })
  expect(errors).toEqual([])
})
