import { render as renderView, screen, within, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { createQueryClient } from '../../../app/queryClient'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import ChartConfigurationForm from './ChartConfigurationForm'
import type { DatasetDetail } from '../../datasets/types'
function render(view: ReactNode) { return renderView(<QueryClientProvider client={createQueryClient()}>{view}</QueryClientProvider>) }

const dataset: DatasetDetail = { id: 8, name: 'Mẫu', connectionId: 1, tableName: 'sample', columns: [
  { id: 1, name: 'category', displayName: 'Nhóm', dataType: 'varchar', nullable: false, canGroup: true, canAggregate: false, canFilter: true },
  { id: 2, name: 'value', displayName: 'Giá trị', dataType: 'decimal', nullable: true, canGroup: true, canAggregate: true, canFilter: true },
] }

describe('chart configuration', () => {
  it('restores saved interval configuration and updates the same chart', async () => {
    const initial = { datasetId: 8, chartType: 'line' as const, dimension: 'value', aggregation: 'COUNT' as const, metricColumn: 'value', sortDirection: 'DESC' as const, filters: [], bucket: { min: 0, max: 10, size: 1 } }
    const fetch = vi.fn(async (_path: string, options?: RequestInit) => new Response(JSON.stringify({ id: 50, ...JSON.parse(String(options?.body)) })))
    vi.stubGlobal('fetch',fetch)
    render(<ChartConfigurationForm dataset={dataset} saved={{ id: 50, name: 'Khoảng điểm', configuration: initial }} />)
    expect((screen.getByLabelText('Giá trị cuối') as HTMLInputElement).value).toBe('10')
    expect((screen.getByLabelText('Độ rộng khoảng') as HTMLInputElement).value).toBe('1')
    const user = userEvent.setup()
    await user.clear(screen.getByLabelText('Tên biểu đồ'))
    await user.type(screen.getByLabelText('Tên biểu đồ'),'Tên mới')
    await user.click(screen.getByRole('button',{ name: 'Lưu biểu đồ' }))
    expect(await screen.findByText('Đã lưu biểu đồ.')).toBeTruthy()
    expect(fetch.mock.calls[0][0]).toBe('/api/charts/50')
    expect(fetch.mock.calls[0][1]?.method).toBe('PATCH')
    expect(JSON.parse(String(fetch.mock.calls[0][1]?.body)).configuration.bucket).toEqual(initial.bucket)
  },15000)
  it('adds, edits and removes filters, resetting incompatible values when changing columns', async () => {
    render(<ChartConfigurationForm dataset={dataset} />)
    const user = userEvent.setup()
    async function choose(label: string, option: string) {
      const input = screen.getByLabelText(label)
      await user.click(input)
      const popup = document.getElementById(input.getAttribute('aria-controls')!)!.closest('.ant-select-dropdown') as HTMLElement
      await user.click(within(popup).getByText(option, { selector: '.ant-select-item-option-content' }))
    }
    await user.click(screen.getByRole('button', { name: '+ Thêm bộ lọc' }))
    await choose('Cột lọc 1', 'Giá trị')
    await choose('Điều kiện 1', 'Lớn hơn hoặc bằng')
    await user.type(screen.getByLabelText('Giá trị lọc 1'), '0')
    expect(screen.getByText('Lọc: Giá trị Lớn hơn hoặc bằng “0”')).toBeTruthy()
    await choose('Cột lọc 1', 'Nhóm')
    expect((screen.getByLabelText('Giá trị lọc 1') as HTMLInputElement).value).toBe('')
    await choose('Điều kiện 1', 'Không có dữ liệu (NULL)')
    expect((screen.getByLabelText('Giá trị lọc 1') as HTMLInputElement).disabled).toBe(true)
    expect(screen.getByText('Lọc: Nhóm Không có dữ liệu (NULL)')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Xóa bộ lọc 1' }))
    expect(screen.getByText('Chưa có bộ lọc; sử dụng toàn bộ dữ liệu.')).toBeTruthy()
  }, 15000)
  it('restricts AVG to numeric columns, supports COUNT on text and clears an incompatible metric', async () => {
    render(<ChartConfigurationForm dataset={dataset} />)
    const user = userEvent.setup()
    async function choose(label: string, option: string) {
      const input = screen.getByLabelText(label)
      await user.click(input)
      const popup = document.getElementById(input.getAttribute('aria-controls')!)!.closest('.ant-select-dropdown') as HTMLElement
      await user.click(within(popup).getByText(option, { selector: '.ant-select-item-option-content' }))
    }
    await choose('Dimension (nhóm theo)', 'Nhóm')
    await user.click(screen.getByLabelText('Cột metric'))
    await waitFor(() => expect(document.getElementById('chart-metric_list')).toBeTruthy())
    const dropdown = document.getElementById('chart-metric_list')!.closest('.ant-select-dropdown') as HTMLElement
    expect(within(dropdown).queryByText('Nhóm', { selector: '.ant-select-item-option-content' })).toBeNull()
    await user.click(within(dropdown).getByText('Giá trị', { selector: '.ant-select-item-option-content' }))
    expect(await screen.findByText('Biểu đồ cột · Nhóm theo Nhóm · AVG(Giá trị)')).toBeTruthy()
    await choose('Loại biểu đồ', 'Đường')
    await choose('Phép tổng hợp', 'COUNT — Đếm giá trị có dữ liệu')
    await choose('Cột metric', 'Nhóm')
    expect(await screen.findByText('Biểu đồ đường · Nhóm theo Nhóm · COUNT(Nhóm)')).toBeTruthy()
    await choose('Phép tổng hợp', 'AVG — Trung bình')
    expect(screen.queryByText('Đã chọn đủ cấu hình cơ bản.')).toBeNull()
    expect(screen.getByText('Chọn dimension và cột metric để hoàn tất cấu hình cơ bản.')).toBeTruthy()
  }, 15000)

  it('explains when a dataset has no numeric metric', () => {
    render(<ChartConfigurationForm dataset={{ ...dataset, columns: [dataset.columns[0]] }} />)
    expect(screen.getByText('Dataset không có cột số để tính trung bình. Bạn có thể chọn COUNT.')).toBeTruthy()
    expect(screen.queryByText('Đã chọn đủ cấu hình cơ bản.')).toBeNull()
  })
})
