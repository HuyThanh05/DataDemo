import { describe, expect, it } from 'vitest'
import { allowedFilterOperators, filterError } from './filters'
import type { DatasetColumn } from '../datasets/types'
import type { ChartFilter } from './types'

const number: DatasetColumn = { id: 1, name: 'score', displayName: 'Điểm', dataType: 'decimal(4,2)', nullable: true, canGroup: true, canAggregate: true, canFilter: true }
const text = { ...number, id: 2, name: 'subject', dataType: 'varchar(100)', canAggregate: false }
const filter: ChartFilter = { id: 1, column: 'score', operator: 'GTE', value: '0' }
describe('filter validation', () => {
  it('accepts zero and decimals, rejects blank and malformed numbers', () => {
    expect(filterError(filter, [number])).toBeUndefined()
    expect(filterError({ ...filter, value: '7.25' }, [number])).toBeUndefined()
    for (const value of ['', ' ', '7,25', 'NaN', 'Infinity', '0x10']) expect(filterError({ ...filter, value }, [number])).toBeTruthy()
  })
  it('limits operators by data type and requires an allowed column', () => {
    expect(allowedFilterOperators(text)).not.toContain('GT')
    expect(filterError({ ...filter, column: 'subject' }, [text])).toBeTruthy()
    expect(filterError(filter, [{ ...number, canFilter: false }])).toBeTruthy()
    expect(filterError({ ...filter, column: 'missing' }, [number])).toBeTruthy()
    expect(filterError({ ...filter, operator: 'IS_NULL', value: '' }, [number])).toBeUndefined()
  })
})
