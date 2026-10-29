import {expect,test} from '@playwright/test'

test('dataset layout stays compact with many columns on desktop and mobile',async({page},testInfo)=>{
  const columns=Array.from({length:22},(_,i)=>({id:i+1,name:'column_'+i,displayName:'Trường dữ liệu '+i,dataType:i<17?'varchar(100)':'decimal(20,6)',nullable:false,canGroup:true,canAggregate:i>=17,canFilter:true,role:i<17?'DIMENSION':'MEASURE',allowedAggregations:i<17?['COUNT','COUNT_DISTINCT']:['SUM','AVG','MAX'],defaultAggregation:i<17?'COUNT':'SUM'}))
  const dataset={id:42,name:'Superstore — Bán hàng',connectionId:1,tableName:'superstore_sales',columns}
  const rows=Array.from({length:12},(_,r)=>columns.map((_,c)=>c<17?'Dữ liệu '+r:100+r))
  await page.route('**/api/**',async route=>{
    const path=new URL(route.request().url()).pathname
    if(!path.startsWith('/api/')) return route.continue()
    const json=(value:unknown)=>route.fulfill({json:value})
    if(path==='/api/datasets')return json([dataset])
    if(path==='/api/datasets/42')return json(dataset)
    if(path==='/api/connections')return json([{id:1,name:'MySQL local',databaseName:'datademo_source',host:'localhost',port:3306,username:'reader'}])
    if(path==='/api/connections/1/tables')return json(['superstore_sales'])
    if(path==='/api/connections/1/columns')return json(columns)
    if(path==='/api/datasets/42/preview')return json({columns,rows,limit:100})
    throw new Error('Unexpected API '+path)
  })
  await page.setViewportSize({width:1600,height:1100})
  await page.goto('/datasets?datasetId=42')
  await expect(page.getByLabel('Tên dataset',{exact:true})).toHaveValue(dataset.name)
  await expect(page.getByText('Đã lưu dataset',{exact:true})).toBeVisible()
  await expect(page.getByText('22 cột',{exact:true})).toBeVisible()
  expect((await page.locator('.dataset-source-panel').boundingBox())!.height).toBeLessThan(180)
  const columnsBody=page.locator('.dataset-columns-panel .ant-table-body')
  expect(await columnsBody.evaluate(el=>el.scrollHeight>el.clientHeight)).toBe(true)
  await expect(page.getByRole('button',{name:'Lưu dataset',exact:true})).toBeVisible()
  await page.screenshot({path:testInfo.outputPath('dataset-desktop.png'),fullPage:true})
  await page.setViewportSize({width:390,height:844})
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await expect(page.getByLabel('Tên dataset',{exact:true})).toHaveValue(dataset.name)
  await page.screenshot({path:testInfo.outputPath('dataset-mobile.png'),fullPage:true})
})
