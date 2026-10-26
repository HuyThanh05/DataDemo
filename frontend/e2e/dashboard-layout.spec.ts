import { expect,test } from '@playwright/test'

test('drag and resize persist across reload and mobile does not overwrite desktop layout',async({ page })=>{
  await page.setViewportSize({ width:1600,height:1200 })
  const chart={ id:17,name:'Biểu đồ mẫu',configuration:{ datasetId:8,chartType:'bar',dimension:'score',metricColumn:'score',aggregation:'COUNT',sortDirection:'ASC',filters:[] } }
  let stored=[{ chartId:17,x:0,y:0,w:6,h:12 }],writes=0
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message))
  await page.route('**/api/dashboards',route=>route.fulfill({ json:[{ id:91,name:'Dashboard demo' }] }))
  await page.route('**/api/dashboards/91',route=>route.fulfill({ json:{ id:91,name:'Dashboard demo' } }))
  await page.route('**/api/dashboards/91/filter',route=>route.fulfill({ json:{ datasetId:null,column:null,value:null } }))
  await page.route('**/api/dashboards/91/charts',route=>route.fulfill({ json:[chart] }))
  await page.route('**/api/dashboards/91/layout',async route=>{
    if(route.request().method()==='PUT') { stored=route.request().postDataJSON().items;writes++ }
    await route.fulfill({ json:stored })
  })
  await page.route('**/api/charts',route=>route.fulfill({ json:[chart] }))
  await page.route('**/api/datasets/8',route=>route.fulfill({ json:{ id:8,columns:[{ name:'score',displayName:'Điểm thi' }] } }))
  await page.route('**/api/dashboards/91/charts/17/preview',route=>route.fulfill({ json:{ rows:[{ dimension:'5',value:'100' }],truncated:false,limit:1000,durationMs:1 } }))
  await page.goto('/dashboards?dashboardId=91')
  const item=page.locator('[data-chart-id="17"]')
  await expect(item.locator('canvas')).toBeVisible()
  const handle=item.locator('.dashboard-drag-handle')
  await handle.scrollIntoViewIfNeeded()
  const start=(await handle.boundingBox())!
  await page.mouse.move(start.x+40,start.y+10);await page.mouse.down();await page.mouse.move(start.x+200,start.y+106,{ steps:10 });await page.mouse.up()
  await expect(page.getByRole('button',{ name:'Lưu bố cục',exact:true })).toBeEnabled()
  const resize=item.locator('.react-resizable-handle-se')
  await resize.scrollIntoViewIfNeeded()
  const corner=(await resize.boundingBox())!
  await page.mouse.move(corner.x+10,corner.y+10);await page.mouse.down();await page.mouse.move(corner.x+130,corner.y+82,{ steps:10 });await page.mouse.up()
  await page.getByRole('button',{ name:'Lưu bố cục',exact:true }).click()
  await expect(page.getByText('Đã lưu bố cục dashboard.',{ exact:true })).toBeVisible()
  expect(stored[0].x+stored[0].y).toBeGreaterThan(0)
  expect(stored[0].w).toBeGreaterThan(6);expect(stored[0].h).toBeGreaterThan(12)
  const saved=JSON.stringify(stored)
  await expect.poll(async()=>Math.abs((await item.boundingBox())!.width-await item.evaluate(element=>parseFloat((element as HTMLElement).style.width)))).toBeLessThan(1)
  const bounds=(await item.boundingBox())!
  await page.reload();await expect(item.locator('canvas')).toBeVisible()
  await expect.poll(async()=>Math.abs((await item.boundingBox())!.width-bounds.width)).toBeLessThan(3)
  await expect.poll(async()=>Math.abs((await item.boundingBox())!.height-bounds.height)).toBeLessThan(3)
  await page.setViewportSize({ width:390,height:844 })
  await expect(page.getByText(/Màn hình nhỏ hiển thị một cột/)).toBeVisible()
  expect(writes).toBe(1);expect(JSON.stringify(stored)).toBe(saved)
  expect(errors).toEqual([])
})
