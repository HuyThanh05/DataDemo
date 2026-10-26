import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { createQueryClient } from '../../../app/queryClient'
import ChartPreview from './ChartPreview'
import type { ChartConfiguration } from '../types'

vi.mock('echarts-for-react', () => ({ default: ({ option }: { option: unknown }) => <output data-testid="echarts-option">{JSON.stringify(option)}</output> }))
const configuration: ChartConfiguration = { datasetId: 8, chartType: 'line', dimension: 'subject', aggregation: 'AVG', metricColumn: 'score', sortDirection: 'DESC', filters: [{ id: 1, column: 'score', operator: 'GTE', value: '0' }] }
function mount(config: ChartConfiguration | undefined = configuration) {
  return render(<QueryClientProvider client={createQueryClient()}><ChartPreview configuration={config} dimensionLabel="Môn học" metricLabel="Điểm trung bình" /></QueryClientProvider>)
}
describe('chart preview', () => {
  it('labels the final score interval as including the maximum value', async () => {
    vi.stubGlobal('fetch',vi.fn(async () => new Response(JSON.stringify({ rows: [{ dimension: '9', value: '2' }], limit: 1000, truncated: false, durationMs: 1 }))))
    mount({ ...configuration, bucket: { min: 0, max: 10, size: 1 } })
    await userEvent.setup().click(screen.getByRole('button',{ name: 'Xem trước' }))
    expect(await screen.findByText('[9, 10]',{ selector: 'td' })).toBeTruthy()
  })
  it('queries only on click, preserves sort/filter values and plots zero separately from NULL', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ rows: [{ dimension: 'Toán', value: '0' }, { dimension: 'Văn', value: null }], limit: 1000, truncated: true, durationMs: 15 })))
    vi.stubGlobal('fetch', fetch)
    mount()
    expect(fetch).not.toHaveBeenCalled()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Xem trước' }))
    const chart = await screen.findByTestId('echarts-option')
    const options = JSON.parse(chart.textContent!)
    expect(options.series[0].type).toBe('line')
    expect(options.series[0].data).toEqual([0, null])
    const [url, request] = fetch.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/charts/preview')
    const body = JSON.parse(String(request.body))
    expect(body.sortDirection).toBe('DESC')
    expect(body.filters).toEqual([{ column: 'score', operator: 'GTE', value: '0' }])
    expect(await screen.findByText(/Chỉ hiển thị 1000 nhóm/)).toBeTruthy()
    expect(screen.getByText('NULL', { selector: 'td' })).toBeTruthy()
  })
  it('shows backend errors and allows retry', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Nguồn không khả dụng' }), { status: 502 })).mockResolvedValueOnce(new Response(JSON.stringify({ rows: [], limit: 1000, truncated: false, durationMs: 1 }))))
    mount()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Xem trước' }))
    expect(await screen.findByText('Nguồn không khả dụng')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Xem trước' }))
    expect(await screen.findByText('Không có dữ liệu phù hợp với bộ lọc.')).toBeTruthy()
  })
})
