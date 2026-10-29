import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom'
import AppRoutes from './AppRoutes'
import { createQueryClient } from './queryClient'

const connection = { id: 7, name: 'MySQL local', host: 'localhost', port: 3306, databaseName: 'datademo_source', username: 'reader' }
function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status }) }
const preview = { columns: [{ name: 'score', dataType: 'DECIMAL' }], rows: [['0.00'], [null]], limit: 100 }
function transport() {
  const fetch = vi.fn(async (path: string, options?: RequestInit) => {
    if (path === '/api/charts') return json([])
    if (path === '/api/datasets') return json([])
    if (path === '/api/connections') return json(options?.method === 'POST' ? connection : [connection], options?.method === 'POST' ? 201 : 200)
    if (path === '/api/datasets/preview') return json(preview)
    if (path === '/api/connections/7/tables') return json(['exam_scores'])
    if (path === '/api/connections/7/columns?table=exam_scores') return json([{ name: 'score', dataType: 'decimal(4,2)', nullable: false }])
    throw new Error('Unexpected request: ' + path)
  })
  vi.stubGlobal('fetch', fetch)
  return fetch
}
function LocationProbe() {
  const location = useLocation(), navigate = useNavigate()
  return <><output data-testid="location">{location.pathname + location.search}</output><button onClick={() => navigate(-1)}>Test back</button></>
}
function mount(path: string) {
  const client = createQueryClient()
  const view = render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}><AppRoutes /><LocationProbe /></MemoryRouter></QueryClientProvider>)
  return { ...view, client }
}

describe('existing workspace routes', () => {
  it('opens Chart Builder from navigation and switches saved dataset metadata', async () => {
    const datasets = [{ id: 81, name: 'Điểm thi', tableName: 'exam_scores', connectionId: 7 }, { id: 82, name: 'Bán hàng', tableName: 'sales', connectionId: 7 }]
    const fetch = vi.fn(async (path: string) => {
      if (path === '/api/charts') return json([])
      if (path === '/api/datasets') return json(datasets)
      if (path === '/api/datasets/81') return json({ ...datasets[0], columns: [{ id: 1, name: 'score', displayName: 'Điểm thi thân thiện', dataType: 'decimal', canGroup: true, canAggregate: true, canFilter: true }] })
      if (path === '/api/datasets/82') return json({ ...datasets[1], columns: [{ id: 2, name: 'revenue', displayName: 'Doanh thu', dataType: 'decimal', canGroup: true, canAggregate: true, canFilter: true }] })
      throw new Error('Unexpected API: ' + path)
    })
    vi.stubGlobal('fetch', fetch)
    mount('/charts?datasetId=81')
    expect(await screen.findByText('Điểm thi thân thiện')).toBeTruthy()
    expect(screen.getByText('score', { selector: 'td' })).toBeTruthy()
    const user = userEvent.setup()
    await user.click(screen.getByLabelText('Dataset đã lưu'))
    await user.click(await screen.findByText('Bán hàng', { selector: '.ant-select-item-option-content' }))
    expect(await screen.findByText('Doanh thu', { selector: 'td' })).toBeTruthy()
    expect(screen.queryByText('Điểm thi thân thiện')).toBeNull()
    expect(screen.getByTestId('location').textContent).toBe('/charts?datasetId=82')
    await user.click(screen.getByRole('button', { name: 'Test back' }))
    expect(await screen.findByText('Điểm thi thân thiện')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: '+ Tạo biểu đồ' }))
    expect(screen.getByTestId('location').textContent).toBe('/charts')
    expect(screen.queryByText('Điểm thi thân thiện')).toBeNull()
  }, 15000)
  it('rejects invalid Chart Builder dataset IDs without loading metadata', async () => {
    const fetch = transport()
    mount('/charts?datasetId=invalid')
    expect(await screen.findByText('Mã dataset không hợp lệ. Hãy chọn lại dataset.')).toBeTruthy()
    expect(fetch.mock.calls.some(([path]) => path.includes('/datasets/'))).toBe(false)
  })
  it('saves dataset labels and restores them when opening its URL again', async () => {
    let stored: Record<string, unknown> | null = null
    vi.stubGlobal('fetch', vi.fn(async (path: string, options?: RequestInit) => {
      if (path === '/api/connections') return json([connection])
      if (path === '/api/connections/7/tables') return json(['exam_scores'])
      if (path.includes('/columns?')) return json([{ name: 'score', dataType: 'decimal(4,2)', nullable: false }])
      if (path === '/api/datasets' && options?.method === 'POST') {
        const input = JSON.parse(String(options.body))
        stored = { id: 81, name: input.name, connectionId: 7, tableName: 'exam_scores', columns: [{ id: 1, name: 'score', displayName: input.columnLabels.score, dataType: 'decimal(4,2)', nullable: false, canGroup: true, canAggregate: true, canFilter: true }] }
        return json(stored, 201)
      }
      if (path === '/api/datasets') return json(stored ? [stored] : [])
      if (path === '/api/datasets/81') return json(stored)
      if (path.includes('/preview')) return json(preview)
      throw new Error('Unexpected API: ' + path)
    }))
    const first = mount('/datasets?connectionId=7&table=exam_scores')
    const user = userEvent.setup()
    await screen.findByText('0.00')
    await user.type(screen.getByLabelText('Tên dataset'), 'Điểm thi mẫu')
    const label = await screen.findByRole('textbox', { name: 'Tên hiển thị của score' }, { timeout: 5000 })
    await user.clear(label); await user.type(label, 'Điểm thi')
    await user.click(screen.getByRole('button', { name: 'Lưu dataset' }))
    await screen.findByText('Đã lưu dataset')
    expect(screen.getByTestId('location').textContent).toBe('/datasets?datasetId=81')
    first.unmount()
    mount('/datasets?datasetId=81')
    await screen.findByText('Đã lưu dataset')
    expect((screen.getByLabelText('Tên dataset') as HTMLInputElement).value).toBe('Điểm thi mẫu')
    const restored = await screen.findByRole('textbox', { name: 'Tên hiển thị của score' }, { timeout: 5000 })
    expect((restored as HTMLInputElement).value).toBe('Điểm thi')
    expect(await screen.findByRole('columnheader', { name: 'Điểm thi' })).toBeTruthy()
  }, 15000)
  it('updates preview headings without renaming source columns or querying data again', async () => {
    const fetch = transport()
    mount('/datasets?connectionId=7&table=exam_scores')
    await screen.findByText('0.00')
    const input = await screen.findByRole('textbox', { name: 'Tên hiển thị của score' }, { timeout: 5000 })
    const previewCalls = () => fetch.mock.calls.filter(([path]) => path === '/api/datasets/preview').length
    const before = previewCalls()
    const user = userEvent.setup()
    await user.clear(input)
    await user.type(input, 'Điểm thi')
    expect(screen.getByRole('columnheader', { name: 'Điểm thi' })).toBeTruthy()
    expect(screen.getByText('score', { selector: 'code' })).toBeTruthy()
    expect(previewCalls()).toBe(before)
    await user.clear(input)
    expect(screen.getByRole('columnheader', { name: 'score' })).toBeTruthy()
  })
  it('previews rows without confusing zero with NULL', async () => {
    const fetch = transport()
    mount('/datasets?connectionId=7&table=exam_scores')
    expect(await screen.findByText('0.00')).toBeTruthy()
    expect(await screen.findByText('NULL')).toBeTruthy()
    expect(screen.getByText(/Đang xem 2 dòng mẫu/)).toBeTruthy()
    const request = fetch.mock.calls.find(([path]) => path === '/api/datasets/preview')
    expect(JSON.parse(String(request?.[1]?.body))).toEqual({ connectionId: 7, tableName: 'exam_scores' })
  })
  it('opens dataset directly and restores the source from URL', async () => {
    transport()
    mount('/datasets?connectionId=7&table=exam_scores')
    expect(await screen.findByText('Đã chọn MySQL local → exam_scores')).toBeTruthy()
    expect(screen.getAllByRole('navigation')).toHaveLength(1)
    expect(screen.queryByRole('heading', { name: 'Thêm kết nối' })).toBeNull()
  })
  it('navigates from real metadata to dataset and supports browser history', async () => {
    transport()
    mount('/connections')
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /^MySQL local/ }))
    await screen.findByText('decimal(4,2)')
    await user.click(screen.getByRole('button', { name: 'Tạo dataset từ bảng này' }))
    expect(await screen.findByText('Đã chọn MySQL local → exam_scores')).toBeTruthy()
    expect(screen.getByTestId('location').textContent).toBe('/datasets?connectionId=7&table=exam_scores')
    await user.click(screen.getByRole('button', { name: 'Test back' }))
    expect(await screen.findByRole('heading', { name: 'Kết nối database' })).toBeTruthy()
  }, 15000)
  it('rejects missing connection IDs without querying an arbitrary source', async () => {
    const fetch = transport()
    mount('/datasets?connectionId=999&table=exam_scores')
    expect(await screen.findByText('Kết nối trong đường dẫn không tồn tại. Hãy chọn lại kết nối.')).toBeTruthy()
    expect(fetch.mock.calls.some(([path]) => path.includes('/999/'))).toBe(false)
    expect(screen.queryByText(/Đã chọn/)).toBeNull()
  })
  it('does not accept a table removed from the source', async () => {
    transport()
    mount('/datasets?connectionId=7&table=deleted_table')
    expect(await screen.findByText('Bảng trong đường dẫn không còn khả dụng. Hãy chọn lại bảng.')).toBeTruthy()
    expect(screen.queryByText(/Đã chọn/)).toBeNull()
  })
  it('displays server errors and recovers when the user retries', async () => {
    let attempts = 0
    vi.stubGlobal('fetch', vi.fn(async (path: string) => path === '/api/datasets' ? json([]) : path === '/api/datasets/preview' ? json(preview) : path === '/api/connections' ? json([connection]) : path.includes('/columns?') ? json([{ name: 'score', dataType: 'decimal(4,2)', nullable: false }]) : ++attempts === 1 ? json({ message: 'Nguồn tạm ngừng' }, 502) : json(['exam_scores'])))
    mount('/datasets?connectionId=7&table=exam_scores')
    expect(await screen.findByText('Nguồn tạm ngừng')).toBeTruthy()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Thử lại' }))
    expect(await screen.findByText('Đã chọn MySQL local → exam_scores')).toBeTruthy()
  })
  it('saves a connection but does not put its password into query cache', async () => {
    const fetch = transport()
    const { client } = mount('/connections')
    const user = userEvent.setup()
    await user.type(screen.getByPlaceholderText('Mật khẩu tài khoản nguồn'), 'test-only-password')
    await user.click(screen.getByRole('button', { name: 'Lưu' }))
    expect(await screen.findByText('Đã kiểm tra và lưu kết nối. Mật khẩu được mã hóa.')).toBeTruthy()
    await waitFor(() => expect(fetch.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(true))
    expect((screen.getByPlaceholderText('Mật khẩu tài khoản nguồn') as HTMLInputElement).value).toBe('')
    expect(JSON.stringify(client.getQueryCache().getAll().map(query => query.state.data))).not.toContain('test-only-password')
    expect(client.getMutationCache().getAll()).toHaveLength(0)
  })
})
