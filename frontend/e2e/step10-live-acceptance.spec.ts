import { expect,test } from '@playwright/test'
import { readFileSync,writeFileSync,mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { Page } from '@playwright/test'

test.skip(process.env.DATADEMO_LIVE_ACCEPTANCE!=='1','Opt-in: prepares SQL baselines and retains one verified demo dashboard.')

test('step 10 real frontend/backend/MySQL acceptance with two demo charts',async({ page })=>{
  test.setTimeout(240000)
  const baselinePath=fileURLToPath(new URL('../../backend/target/step10-acceptance-baseline.json',import.meta.url))
  const reportPath=fileURLToPath(new URL('../../backend/target/step10-acceptance-browser.json',import.meta.url))
  const baseline=JSON.parse(readFileSync(baselinePath,'utf8')) as {
    prefix:string;connectionId:number;datasetName:string;rawName:string;bucketName:string;dashboardName:string;subjects:string[];
    scenarios:{ subject:string|null;raw:{ dimension:string;value:string }[];bucket:{ dimension:string;value:string }[] }[]
  }
  const report:{ prefix:string;datasetId?:number;rawId?:number;bucketId?:number;dashboardId?:number;browserPassed:boolean;checks:string[];scenarios:unknown[];layout?:unknown }={ prefix:baseline.prefix,browserPassed:false,checks:[],scenarios:[] }
  const persist=()=>writeFileSync(reportPath,JSON.stringify(report,null,2))
  persist()
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message))
  await page.setViewportSize({ width:1600,height:1200 })
  async function choose(id:string,label:string) {
    const input=page.locator('#'+id);await expect(input).toBeEnabled();await input.click()
    if(await input.getAttribute('readonly')===null) await input.fill(label)
    const controls=await input.getAttribute('aria-controls')
    const popup=page.locator(`[id="${controls}"]`).locator('xpath=ancestor::div[contains(@class,"ant-select-dropdown")][1]')
    const exact=new RegExp('^'+label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$')
    await popup.locator('.ant-select-item-option-content').filter({ hasText:exact }).click()
  }
  async function jsonGet(path:string) { const response=await page.request.get(path);expect(response.ok(),path).toBe(true);return response.json() }
  const normalized=(rows:{ dimension:unknown;value:unknown }[])=>rows.map(row=>({ dimension:row.dimension===null?null:String(Number(row.dimension)),value:String(row.value) }))

  await test.step('saved connection and real metadata → named dataset with display labels',async()=>{
    await page.goto('/connections')
    const connections=await jsonGet('/api/connections') as { id:number }[]
    await expect(page.locator('.saved-connection')).toHaveCount(connections.length)
    await page.locator('.saved-connection').nth(connections.findIndex(item=>item.id===baseline.connectionId)).click()
    await page.locator('.source-tables button').filter({ hasText:/^exam_scores$/ }).click()
    await expect(page.locator('.columns-table tbody tr')).toHaveCount(8)
    await page.getByRole('button',{ name:'Kiểm tra lại',exact:true }).click()
    await expect(page.getByText(/Kết nối thành công. Tìm thấy/)).toBeVisible()
    await page.getByRole('button',{ name:'Tạo dataset từ bảng này',exact:true }).click()
    await expect(page).toHaveURL(new RegExp(`connectionId=${baseline.connectionId}&table=exam_scores`))
    await page.getByLabel('Tên dataset',{ exact:true }).fill(baseline.datasetName)
    await page.getByRole('textbox',{ name:'Tên hiển thị của score',exact:true }).fill('Điểm thi')
    await page.getByRole('textbox',{ name:'Tên hiển thị của subject_name',exact:true }).fill('Môn học')
    await expect(page.getByText(/Đang xem 100 dòng mẫu/)).toBeVisible()
    await page.getByRole('button',{ name:'Lưu dataset',exact:true }).click()
    await expect(page).toHaveURL(/datasetId=\d+/)
    report.datasetId=Number(new URL(page.url()).searchParams.get('datasetId'));persist()
    await page.reload();await expect(page.getByLabel('Tên dataset',{ exact:true })).toHaveValue(baseline.datasetName)
    report.checks.push('Connection metadata, preview 100 rows, dataset name and column labels persisted');persist()
  })
  async function createChart(bucket:boolean) {
    await page.goto(`/charts?datasetId=${report.datasetId}`)
    await choose('chart-type',bucket?'Đường':'Cột')
    await choose('chart-dimension','Điểm thi')
    if(bucket) await choose('chart-grouping','Theo khoảng số')
    await choose('chart-aggregation','Đếm giá trị có dữ liệu (COUNT)')
    await choose('chart-metric','Điểm thi')
    await page.getByLabel('Tên biểu đồ',{ exact:true }).fill(bucket?baseline.bucketName:baseline.rawName)
    const preview=page.waitForResponse(response=>response.url().endsWith('/api/charts/preview') && response.request().method()==='POST')
    await page.getByRole('button',{ name:'Xem trước',exact:true }).click()
    const response=await preview;expect(response.ok()).toBe(true)
    const payload=await response.json();expect(payload.truncated).toBe(false)
    expect(normalized(payload.rows)).toEqual(baseline.scenarios[0][bucket?'bucket':'raw'])
    await expect(page.locator('.chart-preview canvas')).toBeVisible()
    await page.getByRole('button',{ name:'Lưu biểu đồ',exact:true }).click()
    await expect(page).toHaveURL(/chartId=\d+/)
    const id=Number(new URL(page.url()).searchParams.get('chartId'))
    if(bucket) report.bucketId=id;else report.rawId=id;persist()
    await page.reload();await expect(page.getByLabel('Tên biểu đồ',{ exact:true })).toHaveValue(bucket?baseline.bucketName:baseline.rawName)
    report.checks.push(`${bucket?'Line interval [0,1)…[9,10]':'Bar score distribution'} saved/reopened and matched independent SQL`);persist()
  }
  await test.step('two charts from one dataset; preview and reopen',async()=>{ await createChart(false);await createChart(true) })
  await test.step('dashboard create and add both charts',async()=>{
    await page.goto('/dashboards');await page.getByLabel('Tên dashboard',{ exact:true }).fill(baseline.dashboardName)
    await page.getByRole('button',{ name:'Lưu dashboard',exact:true }).click();await expect(page).toHaveURL(/dashboardId=\d+/)
    report.dashboardId=Number(new URL(page.url()).searchParams.get('dashboardId'));persist()
    for(const name of [baseline.rawName,baseline.bucketName]) {await choose('dashboard-chart-picker',name);await page.getByRole('button',{ name:'+ Thêm biểu đồ',exact:true }).click();await expect(page.getByText('Đã thêm và lưu biểu đồ vào dashboard.',{ exact:true })).toBeVisible()}
    await expect(page.locator('.dashboard-chart-card canvas')).toHaveCount(2)
    await page.reload();await expect(page.locator('.dashboard-chart-card canvas')).toHaveCount(2)
    report.checks.push('Dashboard and both memberships survived full reload');persist()
  })
  await test.step('two subjects and All update both charts and match SQL',async()=>{
    await choose('common-filter-column','Môn học')
    for(const subject of [...baseline.subjects,null]) {
      await choose('common-filter-value',subject ?? 'Tất cả')
      const paths=[report.rawId,report.bucketId].map(id=>`/api/dashboards/${report.dashboardId}/charts/${id}/preview`)
      const responses=paths.map(path=>page.waitForResponse(response=>response.url().endsWith(path) && response.request().method()==='GET'))
      await page.getByRole('button',{ name:'Áp dụng bộ lọc',exact:true }).click()
      const payloads=await Promise.all(responses.map(async pending=>{ const r=await pending;expect(r.ok()).toBe(true);return r.json() }))
      const expected=baseline.scenarios.find(item=>item.subject===subject)!
      expect(normalized(payloads[0].rows)).toEqual(expected.raw);expect(normalized(payloads[1].rows)).toEqual(expected.bucket)
      report.scenarios.push({ subject,scoreGroups:payloads[0].rows.length,intervalGroups:payloads[1].rows.length,total:payloads[0].rows.reduce((sum:number,row:{ value:string })=>sum+Number(row.value),0) });persist()
    }
    await choose('common-filter-value',baseline.subjects[0]);await page.getByRole('button',{ name:'Áp dụng bộ lọc',exact:true }).click()
    await expect.poll(async()=>(await jsonGet(`/api/dashboards/${report.dashboardId}/filter`)).value).toBe(baseline.subjects[0])
    await page.reload();await expect(page.locator('#common-filter-value').locator('..')).toContainText(baseline.subjects[0]);await expect(page.locator('.dashboard-chart-card canvas')).toHaveCount(2)
    report.checks.push('Both subjects and All matched SQL for both charts; selected subject persisted');persist()
  })
  async function move(page:Page,selector:string,dx:number,dy:number) {
    const handle=page.locator(selector);await handle.scrollIntoViewIfNeeded();const box=(await handle.boundingBox())!
    await page.mouse.move(box.x+20,box.y+10);await page.mouse.down();await page.mouse.move(box.x+20+dx,box.y+10+dy,{ steps:12 });await page.mouse.up()
  }
  await test.step('drag, resize, save and reopen real chart geometry',async()=>{
    const item=page.locator(`[data-chart-id="${report.rawId}"]`)
    await move(page,`[data-chart-id="${report.rawId}"] .dashboard-drag-handle`,0,650)
    const corner=item.locator('.react-resizable-handle-se');await corner.scrollIntoViewIfNeeded();const box=(await corner.boundingBox())!
    await page.mouse.move(box.x+10,box.y+10);await page.mouse.down();await page.mouse.move(box.x+130,box.y+82,{ steps:12 });await page.mouse.up()
    await page.getByRole('button',{ name:'Lưu bố cục',exact:true }).click();await expect(page.getByText('Đã lưu bố cục dashboard.',{ exact:true })).toBeVisible()
    const saved=await jsonGet(`/api/dashboards/${report.dashboardId}/layout`)
    const raw=saved.find((item:{ chartId:number })=>item.chartId===report.rawId)
    expect(raw.y).toBeGreaterThan(0);expect(raw.w).toBeGreaterThan(6);expect(raw.h).toBeGreaterThan(12)
    report.layout=saved;persist()
    await page.reload();await expect(page.locator('.dashboard-chart-card canvas')).toHaveCount(2)
    expect(await jsonGet(`/api/dashboards/${report.dashboardId}/layout`)).toEqual(saved)
    await page.setViewportSize({ width:390,height:844 });await expect(page.getByText(/Màn hình nhỏ hiển thị một cột/)).toBeVisible()
    expect(await jsonGet(`/api/dashboards/${report.dashboardId}/layout`)).toEqual(saved)
    await page.setViewportSize({ width:1600,height:1200 })
    report.checks.push('Mouse drag/resize saved, reloaded and retained across mobile view');persist()
  })
  await test.step('remove/re-add keeps original chart and other chart layout',async()=>{
    const before=await jsonGet(`/api/dashboards/${report.dashboardId}/layout`)
    await page.getByRole('button',{ name:`Gỡ ${baseline.bucketName} khỏi dashboard`,exact:true }).click()
    await expect(page.getByRole('region',{ name:`Biểu đồ ${baseline.bucketName}`,exact:true })).toHaveCount(0)
    expect((await jsonGet(`/api/charts/${report.bucketId}`)).name).toBe(baseline.bucketName)
    await choose('dashboard-chart-picker',baseline.bucketName);await page.getByRole('button',{ name:'+ Thêm biểu đồ',exact:true }).click()
    await expect(page.locator('.dashboard-chart-card canvas')).toHaveCount(2)
    const after=await jsonGet(`/api/dashboards/${report.dashboardId}/layout`)
    expect(after.find((item:{ chartId:number })=>item.chartId===report.rawId)).toEqual(before.find((item:{ chartId:number })=>item.chartId===report.rawId))
    report.checks.push('Remove/re-add retained original chart and unaffected chart geometry');persist()
  })
  // Finish with a compact, useful demo after the interactive geometry checks above.
  const finalLayout=[{ chartId:report.rawId,x:0,y:0,w:6,h:14 },{ chartId:report.bucketId,x:6,y:0,w:6,h:14 }]
  const layoutResponse=await page.request.put(`/api/dashboards/${report.dashboardId}/layout`,{ data:{ items:finalLayout } });expect(layoutResponse.ok()).toBe(true)
  report.layout=await layoutResponse.json()
  await page.reload();await expect(page.locator('.dashboard-chart-card canvas')).toHaveCount(2)
  await expect.poll(async()=>page.locator('.dashboard-chart-card canvas').first().evaluate(canvas=>canvas.getBoundingClientRect().height)).toBeGreaterThan(180)
  const artifactDir=fileURLToPath(new URL('../../docs/acceptance',import.meta.url));mkdirSync(artifactDir,{ recursive:true })
  await settledCanvases(page)
  await page.locator('.dashboard-grid-area').screenshot({ path:artifactDir+'/step-10-dashboard.png',animations:'disabled' })
  expect(errors).toEqual([]);report.browserPassed=true;persist()
})

async function settledCanvases(page:Page) {
  let previous='',stable=0;const started=Date.now()
  await expect.poll(async()=>{
    const signature=await page.locator('.dashboard-chart-card canvas').evaluateAll(nodes=>nodes.map(node=>(node as HTMLCanvasElement).toDataURL()).join('|'))
    stable=signature===previous?stable+1:0;previous=signature
    return Date.now()-started>=1200 && stable>=2
  },{ timeout:10000,intervals:[150,250,400] }).toBe(true)
}

test('capture verified step 10 demo with fully settled charts',async({ page })=>{
  const report=JSON.parse(readFileSync(fileURLToPath(new URL('../../backend/target/step10-acceptance-browser.json',import.meta.url)),'utf8'))
  expect(report.browserPassed).toBe(true)
  await page.setViewportSize({ width:1600,height:1200 })
  await page.goto(`/dashboards?dashboardId=${report.dashboardId}`)
  await expect(page.locator('.dashboard-chart-card canvas')).toHaveCount(2)
  await settledCanvases(page)
  await page.locator('.dashboard-grid-area').screenshot({ path:fileURLToPath(new URL('../../docs/acceptance/step-10-dashboard.png',import.meta.url)),animations:'disabled' })
})
