import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { createQueryClient } from '../../../app/queryClient'
import ChartPreview from './ChartPreview'
import type { ChartConfiguration } from '../types'

vi.mock('echarts-for-react', () => ({ default: ({ option }: { option: unknown }) => <output data-testid="echarts-option">{JSON.stringify(option)}</output> }))
const configuration: ChartConfiguration = { datasetId: 8, chartType: 'line', dimension: 'subject', aggregation: 'AVG', metricColumn: 'score', sortDirection: 'DESC', filters: [{ id: 1, column: 'score', operator: 'GTE', value: '0' }] }
function mount(config: ChartConfiguration | undefined = configuration, options: { showTable?: boolean; autoLoad?: boolean } = {}) {
  return render(<QueryClientProvider client={createQueryClient()}><ChartPreview configuration={config} dimensionLabel="Môn học" metricLabel="Điểm trung bình" {...options} /></QueryClientProvider>)
}
describe('chart preview', () => {
  it('renders pie shares from aggregated values and keeps NULL distinct from zero', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ rows: [
      { dimension: 'Toán', value: '3' }, { dimension: 'Văn', value: '1' }, { dimension: 'Không', value: '0' }, { dimension: 'Thiếu', value: null },
    ], limit: 1000, truncated: false, durationMs: 1 }))))
    mount({ ...configuration, chartType: 'pie' })
    await userEvent.setup().click(screen.getByRole('button', { name: 'Xem trước' }))
    const option = JSON.parse((await screen.findByTestId('echarts-option')).textContent!)
    expect(option.series[0].type).toBe('pie')
    expect(option.series[0].data.map((item: { value: number }) => item.value)).toEqual([3, 1, 0])
    expect(option.series[0].stillShowZeroSum).toBe(false)
    expect(screen.getByRole('list', { name: 'Chú giải biểu đồ tròn' }).textContent).toContain('75%')
    expect(screen.getByText(/Có 1 nhóm có kết quả NULL/)).toBeTruthy()
    expect(screen.getByText('NULL', { selector: 'td' })).toBeTruthy()
  })

  it.each([
    { value: '0', message: 'Chưa có giá trị lớn hơn 0 để vẽ biểu đồ tròn.' },
    { value: '-1', message: 'Biểu đồ tròn cần giá trị không âm. Hãy chọn cách tính khác hoặc dùng biểu đồ cột, đường hay bảng.' },
  ])('does not fabricate pie slices for $value', async ({ value, message }) => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ rows: [{ dimension: 'Toán', value }], limit: 1000, truncated: false, durationMs: 1 }))))
    mount({ ...configuration, chartType: 'pie' })
    await userEvent.setup().click(screen.getByRole('button', { name: 'Xem trước' }))
    expect(await screen.findByText(message)).toBeTruthy()
    expect(screen.queryByTestId('echarts-option')).toBeNull()
    expect(screen.getByText(value, { selector: 'td' })).toBeTruthy()
  })

  it('shows a table on dashboards even when auxiliary chart tables are disabled, preserving exact values', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ rows: [
      { dimension: 'Lớn', value: '9007199254740993.12' }, { dimension: 'Không', value: '0' }, { dimension: 'Thiếu', value: null },
    ], limit: 1000, truncated: false, durationMs: 1 }))))
    mount({ ...configuration, chartType: 'table' }, { showTable: false, autoLoad: true })
    expect(await screen.findByText('9007199254740993.12', { selector: 'td' })).toBeTruthy()
    expect(screen.getByText('0', { selector: 'td' })).toBeTruthy()
    expect(screen.getByText('NULL', { selector: 'td' })).toBeTruthy()
    expect(screen.queryByTestId('echarts-option')).toBeNull()
    expect(screen.getAllByRole('table')).toHaveLength(1)
  })

  it('shows every category without a scrolling window and rotates labels as the chart narrows', async () => {
    const observers: ResizeObserverCallback[] = []
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: ResizeObserverCallback) { observers.push(callback) }
      observe() {}
      disconnect() {}
    })
    const rows = Array.from({ length: 17 }, (_, index) => ({ dimension: `Môn học có tên dài ${index + 1}`, value: String(index) }))
    const fetch = vi.fn(async () => new Response(JSON.stringify({ rows, limit: 1000, truncated: false, durationMs: 1 })))
    vi.stubGlobal('fetch', fetch)
    mount()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Xem trước' }))
    const chart = await screen.findByTestId('echarts-option')
    const resize = (width: number) => act(() => {
      observers[0]([{ contentRect: { width } } as ResizeObserverEntry], {} as ResizeObserver)
    })
    resize(1300)
    const wide = JSON.parse(chart.textContent!)
    expect(wide.xAxis.axisLabel.interval).toBe(0)
    expect(wide.xAxis.axisLabel.hideOverlap).toBe(false)
    expect(wide.xAxis.axisLabel.rotate).toBe(45)
    expect(wide.xAxis.data).toEqual(rows.map(row => row.dimension))
    expect(wide.series[0].data).toEqual(rows.map(row => Number(row.value)))
    expect(wide.dataZoom).toEqual([])
    resize(360)
    const narrow = JSON.parse(chart.textContent!)
    expect(narrow.xAxis.axisLabel.rotate).toBeGreaterThan(wide.xAxis.axisLabel.rotate)
    expect(narrow.dataZoom).toEqual([])
    expect(narrow.xAxis.data).toEqual(wide.xAxis.data)
    expect(narrow.series[0].data).toEqual(wide.series[0].data)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(/Kéo thanh trượt bên dưới biểu đồ/)).toBeNull()
  })

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
