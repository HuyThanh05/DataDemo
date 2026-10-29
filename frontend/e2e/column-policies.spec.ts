import { expect, test } from '@playwright/test'
import type { ColumnSettings, DatasetDetail } from '../src/features/datasets/types'

test('sales dataset policies persist and control aggregation choices', async ({page},testInfo)=>{
  test.setTimeout(60000)
  const columns=[{name:'customer_id',dataType:'int',nullable:false},{name:'revenue',dataType:'decimal(15,2)',nullable:true}]
  let saved: DatasetDetail | undefined
  await page.route('**/api/**',async route=>{
    const path=new URL(route.request().url()).pathname
    if(!path.startsWith('/api/')) return route.continue()
    const json=(value:unknown)=>route.fulfill({json:value})
    if(path==='/api/connections') return json([{id:1,name:'Sales source',host:'localhost',port:3306,databaseName:'sales',username:'reader'}])
    if(path==='/api/connections/1/tables') return json(['sales'])
    if(path==='/api/connections/1/columns') return json(columns)
    if(path==='/api/datasets/preview' || path==='/api/datasets/42/preview') return json({columns,rows:[['1001','150000']],limit:100})
    if(path==='/api/datasets') {
      if(route.request().method()==='POST') {
        const body=route.request().postDataJSON() as {name:string;columnSettings:Record<string,ColumnSettings>}
        expect(body.columnSettings.customer_id).toEqual({role:'DIMENSION',allowedAggregations:['COUNT','COUNT_DISTINCT'],defaultAggregation:'COUNT'})
        expect(body.columnSettings.revenue.defaultAggregation).toBe('SUM')
        saved={id:42,name:body.name,connectionId:1,tableName:'sales',columns:columns.map((c,i)=>({...c,id:i+1,displayName:c.name,canGroup:true,canAggregate:true,canFilter:true,...body.columnSettings[c.name]}))}
        return json(saved)
      }
      return json(saved?[saved]:[])
    }
    if(path==='/api/datasets/42') return json(saved)
    if(path==='/api/charts') return json([])
    throw new Error('Unexpected API '+path)
  })
  async function choose(label:string,option:string) {
    const input=page.getByLabel(label,{exact:true}); await input.click()
    const popup=page.locator('#'+await input.getAttribute('aria-controls')).locator('xpath=ancestor::div[contains(@class,"ant-select-dropdown")][1]')
    await popup.locator('.ant-select-item-option-content').filter({hasText:option}).click()
  }
  await page.setViewportSize({width:1800,height:1100})
  await page.goto('/datasets?connectionId=1&table=sales')
  await page.getByLabel('Tên dataset',{exact:true}).fill('Sales demo')
  await choose('Vai trò của customer_id','Phân nhóm')
  await expect(page.getByLabel('Phép tính cho phép của customer_id')).toHaveCount(0)
  await expect(page.getByLabel('Phép tính mặc định của customer_id')).toHaveCount(0)
  await choose('Phép tính mặc định của revenue','Tính tổng (SUM)')
  await page.getByRole('button',{name:'Lưu dataset',exact:true}).click()
  await expect(page).toHaveURL(/datasetId=42/)
  await page.reload()
  await expect(page.getByLabel('Vai trò của customer_id').locator('xpath=ancestor::div[contains(@class,"ant-select")][1]')).toContainText('Phân nhóm')
  await page.screenshot({path:testInfo.outputPath('dataset-column-settings.png'),fullPage:true})
  await page.goto('/charts?datasetId=42')
  await choose('Nhóm dữ liệu theo (Dimension)','customer_id')
  await choose('Cột dùng để tính (Metric Column)','customer_id')
  await page.getByLabel('Cách tính cho mỗi nhóm (Aggregation)').click()
  const popup=page.locator('#'+await page.getByLabel('Cách tính cho mỗi nhóm (Aggregation)').getAttribute('aria-controls')).locator('xpath=ancestor::div[contains(@class,"ant-select-dropdown")][1]')
  await expect(popup.locator('.ant-select-item-option')).toHaveCount(2)
  await expect(popup).toContainText('COUNT')
  await page.keyboard.press('Escape')
  await choose('Cột dùng để tính (Metric Column)','revenue')
  await expect(page.getByText('Biểu đồ cột · Nhóm theo customer_id · SUM(revenue)',{exact:true})).toBeVisible()
})
