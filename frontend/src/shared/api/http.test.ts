import { describe, expect, it, vi } from 'vitest'
import { request } from './http'

describe('HTTP client', () => {
  it('accepts successful DELETE responses without a JSON body', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetch)
    await expect(request<void>('/datasets/8', { method: 'DELETE' })).resolves.toBeUndefined()
    expect(fetch).toHaveBeenCalledWith('/api/datasets/8', expect.objectContaining({ method: 'DELETE' }))
  })
  it('preserves backend error status, code and safe message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: 'SOURCE_ACCESS_DENIED', message: 'Access denied' }), { status: 502 })))
    await expect(request('/connections')).rejects.toMatchObject({ status: 502, code: 'SOURCE_ACCESS_DENIED', message: 'Access denied' })
  })
  it('rejects non-JSON proxy responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>Error</html>', { status: 200 })))
    await expect(request('/connections')).rejects.toMatchObject({ status: 200, message: 'Backend không trả dữ liệu JSON hợp lệ.' })
  })
  it('does not mask cancellation as a network failure', async () => {
    const controller = new AbortController()
    controller.abort()
    const error = new DOMException('Aborted', 'AbortError')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(error))
    await expect(request('/connections', { signal: controller.signal })).rejects.toBe(error)
  })
  it('sends POST payload as JSON without changing its values', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true })))
    vi.stubGlobal('fetch', fetch)
    const body = { password: 'test-only', name: 'Nguồn' }
    await request('/connections/test', { body })
    expect(fetch).toHaveBeenCalledWith('/api/connections/test', expect.objectContaining({ method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }))
  })
})
