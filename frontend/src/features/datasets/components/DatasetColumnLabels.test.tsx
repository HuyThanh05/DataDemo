import {render,screen} from '@testing-library/react'
import {QueryClientProvider} from '@tanstack/react-query'
import {describe,it,expect,vi} from 'vitest'
import {createQueryClient} from '../../../app/queryClient'
import DatasetColumnLabels from './DatasetColumnLabels'
import type {ColumnSettings} from '../types'

describe('dataset role controls',()=>{
  it('hides both controls for dimensions and default when a measure has only one aggregation',async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify([{name:'code',dataType:'int',nullable:false},{name:'score',dataType:'decimal',nullable:false}]))))
    const client=createQueryClient()
    const settings:Record<string,ColumnSettings>={code:{role:'DIMENSION',allowedAggregations:['COUNT','COUNT_DISTINCT'],defaultAggregation:'COUNT'},score:{role:'MEASURE',allowedAggregations:['AVG'],defaultAggregation:'AVG'}}
    const view=(policy:Record<string,ColumnSettings>)=><QueryClientProvider client={client}><DatasetColumnLabels connectionId={1} table="example" labels={{}} onChange={()=>{}} settings={policy} onSettingsChange={()=>{}} /></QueryClientProvider>
    const result=render(view(settings))
    await screen.findByLabelText('Vai trò của score')
    expect(screen.queryByLabelText('Phép tính cho phép của code')).toBeNull()
    expect(screen.queryByLabelText('Phép tính mặc định của code')).toBeNull()
    expect(screen.getByLabelText('Phép tính cho phép của score')).toBeTruthy()
    expect(screen.queryByLabelText('Phép tính mặc định của score')).toBeNull()
    result.rerender(view({...settings,score:{...settings.score,allowedAggregations:['AVG','MAX']}}))
    expect(screen.getByLabelText('Phép tính mặc định của score')).toBeTruthy()
    expect(screen.getByText('Chọn Đo lường cho cột muốn tính toán (SUM, AVG...); cột Phân nhóm dùng để nhóm và lọc.')).toBeTruthy()
    expect(screen.queryByRole('columnheader',{name:'Cột gốc'})).toBeNull()
  })
})
