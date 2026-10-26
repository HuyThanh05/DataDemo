import { expect, test } from '@playwright/test'

test('ECharts renders bar and line previews and clears the result when configuration changes', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  const dataset = { id: 901, name: 'Chart fixture', tableName: 'example', connectionId: 1, columns: [
    { id: 1, name: 'subject', displayName: 'Môn học', dataType: 'varchar', canGroup: true, canAggregate: false, canFilter: true },
    { id: 2, name: 'score', displayName: 'Điểm thi', dataType: 'decimal', canGroup: true, canAggregate: true, canFilter: true },
  ] }
  await page.route('**/api/datasets', route => route.fulfill({ json: [dataset] }))
  await page.route('**/api/datasets/901', route => route.fulfill({ json: dataset }))
  let stored: { id: number; name: string; configuration: Record<string, unknown> } | undefined
  await page.route('**/api/charts', async route => {
    if (route.request().method() === 'POST') {
      stored = { id: 501, ...route.request().postDataJSON() }
      await route.fulfill({ status: 201, json: stored })
    } else await route.fulfill({ json: stored ? [stored] : [] })
  })
  await page.route('**/api/charts/501', route => route.fulfill({ json: stored }))
  await page.route('**/api/charts/preview', route => route.fulfill({ json: { rows: [{ dimension: 'Toán', value: '6.25' }, { dimension: 'Văn', value: '7.5' }], truncated: false, limit: 1000, durationMs: 10 } }))
  await page.goto('/charts?datasetId=901')
  async function choose(label: string, option: string) {
    const input = page.getByLabel(label, { exact: true })
    await input.click()
    await input.press('Home')
    if (option === 'Giảm dần' || option === 'Đường') await input.press('ArrowDown')
    await input.press('Enter')
  }
  await choose('Dimension (nhóm theo)', 'Môn học')
  await choose('Cột metric', 'Điểm thi')
  await choose('Sắp xếp dimension', 'Giảm dần')
  const response = page.waitForRequest('**/api/charts/preview')
  await page.getByRole('button', { name: 'Xem trước', exact: true }).click()
  expect((await response).postDataJSON().sortDirection).toBe('DESC')
  await expect(page.locator('.chart-preview canvas')).toBeVisible()
  await expect(page.locator('.chart-preview')).toContainText('6.25')
  await choose('Loại biểu đồ', 'Đường')
  await expect(page.locator('.chart-preview canvas')).toHaveCount(0)
  await page.getByRole('button', { name: 'Xem trước', exact: true }).click()
  await expect(page.locator('.chart-preview canvas')).toBeVisible()
  await page.getByLabel('Tên biểu đồ', { exact: true }).fill('Biểu đồ đã lưu')
  await page.getByRole('button', { name: 'Lưu biểu đồ', exact: true }).click()
  await expect(page).toHaveURL(/chartId=501/)
  await page.reload()
  await expect(page.getByLabel('Tên biểu đồ', { exact: true })).toHaveValue('Biểu đồ đã lưu')
  await expect(page.getByText('Biểu đồ đường · Nhóm theo Môn học · AVG(Điểm thi)', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Xem trước', exact: true }).click()
  await expect(page.locator('.chart-preview canvas')).toBeVisible()
  expect(errors).toEqual([])
})
