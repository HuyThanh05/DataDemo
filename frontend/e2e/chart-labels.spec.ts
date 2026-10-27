import { expect, test } from '@playwright/test'

test('all category labels are drawn at an angle without scrolling, including after resize', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(() => {
    const captured = window as unknown as { chartTexts: string[]; chartAngles: Record<string, number>; chartBounds: Record<string, { left: number; right: number; width: number }> }
    captured.chartTexts = []
    captured.chartAngles = {}
    captured.chartBounds = {}
    const fillText = CanvasRenderingContext2D.prototype.fillText
    CanvasRenderingContext2D.prototype.fillText = function (text, x, y, maxWidth) {
      captured.chartTexts.push(String(text))
      const transform = this.getTransform()
      captured.chartAngles[String(text)] = Math.abs(Math.atan2(transform.b, transform.a) * 180 / Math.PI)
      const metrics = this.measureText(text)
      const left = x - metrics.actualBoundingBoxLeft, right = x + metrics.actualBoundingBoxRight
      const top = y - metrics.actualBoundingBoxAscent, bottom = y + metrics.actualBoundingBoxDescent
      const edges = [[left, top], [right, top], [left, bottom], [right, bottom]].map(([px, py]) => transform.a * px + transform.c * py + transform.e)
      captured.chartBounds[String(text)] = { left: Math.min(...edges), right: Math.max(...edges), width: this.canvas.width }
      if (maxWidth === undefined) fillText.call(this, text, x, y)
      else fillText.call(this, text, x, y, maxWidth)
    }
  })
  const names = ['Công nghệ công nghiệp', 'Công nghệ nông nghiệp', 'Địa lý', 'Giáo dục kinh tế và pháp luật', 'Hóa học', 'Lịch sử', 'Ngữ văn', 'Sinh học', 'Tiếng Anh', 'Tiếng Đức', 'Tiếng Hàn', 'Tiếng Nga', 'Tiếng Nhật', 'Tiếng Pháp', 'Tiếng Trung', 'Toán', 'Vật lý']
  let rows = names.map((dimension, index) => ({ dimension, value: String(100 + index * 10) }))
  const dataset = { id: 901, name: 'Label fixture', tableName: 'example', connectionId: 1, columns: [
    { id: 1, name: 'subject', displayName: 'Môn học', dataType: 'varchar', canGroup: true, canAggregate: false, canFilter: true },
    { id: 2, name: 'score', displayName: 'Điểm thi', dataType: 'decimal', canGroup: true, canAggregate: true, canFilter: true },
  ] }
  const chart = { id: 902, name: 'Kiểm tra tên nhóm', configuration: { datasetId: 901, chartType: 'bar', dimension: 'subject', aggregation: 'COUNT', metricColumn: 'score', sortDirection: 'ASC', filters: [] } }
  await page.route('**/api/datasets', route => route.fulfill({ json: [dataset] }))
  await page.route('**/api/datasets/901', route => route.fulfill({ json: dataset }))
  await page.route('**/api/charts', route => route.fulfill({ json: [chart] }))
  await page.route('**/api/charts/902', route => route.fulfill({ json: chart }))
  await page.route('**/api/charts/preview', route => route.fulfill({ json: { rows, truncated: false, limit: 1000, durationMs: 1 } }))
  await page.setViewportSize({ width: 1600, height: 1100 })
  await page.goto('/charts?chartId=902')
  const firstResponse = page.waitForResponse('**/api/charts/preview')
  await page.getByRole('button', { name: 'Xem trước', exact: true }).click()
  expect((await firstResponse).ok()).toBe(true)
  await expect(page.getByRole('button', { name: 'Xem trước', exact: true })).not.toHaveClass(/ant-btn-loading/)
  const canvas = page.locator('.chart-canvas canvas')
  await expect(canvas).toBeVisible()
  for (const name of names) {
    await expect.poll(() => page.evaluate(value => (window as unknown as { chartTexts: string[] }).chartTexts.includes(value), name)).toBe(true)
  }
  await expect.poll(() => page.evaluate(value => value.every(name => {
    const bounds = (window as unknown as { chartBounds: Record<string, { left: number; right: number; width: number }> }).chartBounds[name]
    return bounds && bounds.left >= -1 && bounds.right <= bounds.width + 1
  }), names)).toBe(true)
  await expect(page.locator('.chart-navigation-hint')).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => (window as unknown as { chartAngles: Record<string, number> }).chartAngles['Toán'])).toBeGreaterThanOrEqual(44)
  await page.waitForTimeout(1200) // ECharts animates canvas independently of CSS animations.
  await page.locator('.chart-canvas').screenshot({ path: testInfo.outputPath('labels-wide.png') })

  rows = Array.from({ length: 60 }, (_, index) => ({ dimension: `Môn ${String(index + 1).padStart(2, '0')}`, value: String(index + 1) }))
  await page.evaluate(() => { (window as unknown as { chartTexts: string[] }).chartTexts = [] })
  const secondResponse = page.waitForResponse('**/api/charts/preview')
  await page.getByRole('button', { name: 'Xem trước', exact: true }).click()
  expect((await secondResponse).ok()).toBe(true)
  await expect.poll(() => page.evaluate(() => {
    const texts = (window as unknown as { chartTexts: string[] }).chartTexts
    return Array.from({ length: 60 }, (_, index) => `Môn ${String(index + 1).padStart(2, '0')}`).every(name => texts.includes(name))
  })).toBe(true)
  await expect(page.locator('.chart-navigation-hint')).toHaveCount(0)
  await page.waitForTimeout(1200)
  await page.locator('.chart-canvas').screenshot({ path: testInfo.outputPath('labels-60-groups.png') })

  rows = names.map((dimension, index) => ({ dimension, value: String(100 + index * 10) }))
  const mobileResponse = page.waitForResponse('**/api/charts/preview')
  await page.getByRole('button', { name: 'Xem trước', exact: true }).click()
  expect((await mobileResponse).ok()).toBe(true)
  await page.evaluate(() => { (window as unknown as { chartTexts: string[] }).chartTexts = [] })
  await page.setViewportSize({ width: 390, height: 844 })
  await expect.poll(() => page.evaluate(value => value.every(name => (window as unknown as { chartTexts: string[] }).chartTexts.includes(name)), names)).toBe(true)
  await expect(page.locator('.chart-navigation-hint')).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
  await expect(canvas).toBeVisible()
  await page.waitForTimeout(1200)
  await page.locator('.chart-canvas').screenshot({ path: testInfo.outputPath('labels-mobile.png') })
  expect(errors).toEqual([])
})
