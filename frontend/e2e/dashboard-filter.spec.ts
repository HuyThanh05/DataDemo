import { expect,test } from '@playwright/test'

test('subject filter refreshes both charts, survives reload and All restores the unfiltered view',async({ page })=>{
  await page.setViewportSize({ width:1600,height:1200 })
  const configuration={ datasetId:8,chartType:'bar',dimension:'score',metricColumn:'score',aggregation:'COUNT',sortDirection:'ASC',filters:[] }
  const charts=[{ id:17,name:'Phổ điểm',configuration },{ id:18,name:'Khoảng điểm',configuration:{ ...configuration,chartType:'line' } }]
  let filter:{ datasetId:number|null;column:string|null;value:string|null }={ datasetId:8,column:'subject',value:null }
  const counts:Record<number,number>={17:0,18:0}
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message))
  await page.route('**/api/dashboards',route=>route.fulfill({ json:[{ id:91,name:'Dashboard demo' }] }))
  await page.route('**/api/dashboards/91',route=>route.fulfill({ json:{ id:91,name:'Dashboard demo' } }))
  await page.route('**/api/dashboards/91/charts',route=>route.fulfill({ json:charts }))
  await page.route('**/api/charts',route=>route.fulfill({ json:charts }))
  await page.route('**/api/datasets',route=>route.fulfill({ json:[{ id:8,name:'Điểm thi' }] }))
  await page.route('**/api/datasets/8',route=>route.fulfill({ json:{ id:8,columns:[{ name:'subject',displayName:'Môn học',canFilter:true },{ name:'score',displayName:'Điểm thi',canFilter:true }] } }))
  await page.route('**/api/dashboards/91/layout',route=>route.fulfill({ json:[{ chartId:17,x:0,y:0,w:6,h:12 },{ chartId:18,x:6,y:0,w:6,h:12 }] }))
  await page.route('**/api/dashboards/91/filter',async route=>{
    if(route.request().method()==='PUT') filter=route.request().postDataJSON()
    await route.fulfill({ json:filter })
  })
  await page.route('**/api/dashboards/91/filter-values?*',route=>route.fulfill({ json:{ values:['Toán','Ngữ văn'],truncated:false } }))
  await page.route(/\/api\/dashboards\/91\/charts\/(17|18)\/preview$/,async route=>{
    const id=Number(route.request().url().match(/charts\/(\d+)\/preview/)![1]);counts[id]++
    await route.fulfill({ json:{ rows:[{ dimension:'5',value:filter.value==='Toán'?'100':'200' }],truncated:false,limit:1000,durationMs:1 } })
  })
  await page.goto('/dashboards?dashboardId=91')
  await expect(page.locator('.dashboard-chart-card canvas')).toHaveCount(2)
  const initial={ ...counts }
  async function chooseSubject(index:number) {
    const picker=page.getByRole('combobox',{ name:'Môn học',exact:true })
    await picker.click()
    await page.locator('.ant-select-dropdown:visible .ant-select-item-option-content').filter({ hasText:index===0?/^Tất cả$/:/^Toán$/ }).click()
  }
  await chooseSubject(1)
  await page.getByRole('button',{ name:'Áp dụng bộ lọc',exact:true }).click()
  await expect.poll(()=>counts[17]).toBeGreaterThan(initial[17]);await expect.poll(()=>counts[18]).toBeGreaterThan(initial[18])
  expect(filter.value).toBe('Toán')
  await page.reload()
  await expect(page.locator('#common-filter-value').locator('..')).toContainText('Toán')
  await expect(page.locator('.dashboard-chart-card canvas')).toHaveCount(2)
  const baseline={ ...counts }
  await chooseSubject(0)
  await page.getByRole('button',{ name:'Áp dụng bộ lọc',exact:true }).click()
  await expect.poll(()=>counts[17]).toBeGreaterThan(baseline[17]);await expect.poll(()=>counts[18]).toBeGreaterThan(baseline[18])
  expect(filter.value).toBeNull()
  expect(errors).toEqual([])
})
