import { expect, test } from '@playwright/test'

test('dashboard adds and restores a saved chart, then removes only the membership', async ({ page }) => {
  const chart = { id: 17, name: 'Phổ điểm', configuration: { datasetId: 8, chartType: 'bar', dimension: 'score', metricColumn: 'score', aggregation: 'COUNT', sortDirection: 'ASC', filters: [] } }
  let linked = false
  const errors: string[] = []
  page.on('pageerror',error => errors.push(error.message))
  await page.route('**/api/dashboards',route => route.fulfill({ json: [{ id: 91,name: 'Dashboard demo' }] }))
  await page.route('**/api/dashboards/91',route => route.fulfill({ json: { id: 91,name: 'Dashboard demo' } }))
  await page.route('**/api/dashboards/91/filter',route=>route.fulfill({ json:{ datasetId:null,column:null,value:null } }))
  await page.route('**/api/dashboards/91/charts',async route => {
    if(route.request().method() === 'POST') linked = true
    await route.fulfill({ json: linked ? [chart] : [] })
  })
  await page.route('**/api/dashboards/91/charts/17',async route => { linked = false;await route.fulfill({ json: [] }) })
  await page.route('**/api/charts',route => route.fulfill({ json: [chart] }))
  await page.route('**/api/dashboards/91/layout',route => route.fulfill({ json: linked ? [{ chartId:17,x:0,y:0,w:6,h:12 }] : [] }))
  await page.route('**/api/datasets/8',route => route.fulfill({ json: { id: 8,name: 'Điểm thi',columns: [{ name: 'score',displayName: 'Điểm thi' }] } }))
  await page.route('**/api/dashboards/91/charts/17/preview',route => route.fulfill({ json: { rows: [{ dimension: '5',value: '100' }],truncated: false,limit: 1000,durationMs: 1 } }))
  await page.goto('/dashboards?dashboardId=91')
  await expect(page.getByText('Dashboard chưa có biểu đồ.',{ exact: true })).toBeVisible()
  async function add() {
    const picker = page.getByLabel('Biểu đồ đã lưu',{ exact: true })
    await picker.click();await picker.press('Home');await picker.press('Enter')
    await page.getByRole('button',{ name: '+ Thêm biểu đồ',exact: true }).click()
  }
  await add()
  await expect(page.getByRole('region',{ name: 'Biểu đồ Phổ điểm' })).toBeVisible()
  await expect(page.locator('.dashboard-chart-card canvas')).toBeVisible()
  await page.reload()
  await expect(page.getByRole('region',{ name: 'Biểu đồ Phổ điểm' })).toBeVisible()
  await page.getByRole('button',{ name: 'Gỡ Phổ điểm khỏi dashboard',exact: true }).click()
  await expect(page.getByRole('region',{ name: 'Biểu đồ Phổ điểm' })).toHaveCount(0)
  await expect(page.getByText('Đã gỡ khỏi dashboard; biểu đồ gốc vẫn được giữ.',{ exact: true })).toBeVisible()
  await add()
  await expect(page.getByRole('region',{ name: 'Biểu đồ Phổ điểm' })).toBeVisible()
  expect(errors).toEqual([])
})
