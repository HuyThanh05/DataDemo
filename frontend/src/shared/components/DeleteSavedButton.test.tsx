import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ConfigProvider } from 'antd'
import DeleteSavedButton from './DeleteSavedButton'

describe('saved configuration deletion', () => {
  it('does not delete until explicitly confirmed, keeps dependency errors visible and allows retry', async () => {
    const remove = vi.fn().mockRejectedValueOnce(new Error('Dataset đang được sử dụng bởi 2 biểu đồ.')).mockResolvedValueOnce(undefined)
    render(<ConfigProvider theme={{ token: { motion: false } }}><DeleteSavedButton kind="dataset" name="Điểm thi" description="Giữ nguyên bảng nguồn." onDelete={remove} /></ConfigProvider>)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Xóa dataset Điểm thi' }))
    expect(within(screen.getByRole('dialog')).getByText('Điểm thi')).toBeTruthy()
    expect(remove).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Hủy' }))
    expect(remove).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Xóa dataset Điểm thi' }))
    await user.click(screen.getByRole('button', { name: 'Xác nhận xóa' }))
    expect(await screen.findByText('Dataset đang được sử dụng bởi 2 biểu đồ.')).toBeTruthy()
    expect(screen.getByRole('dialog')).toBeTruthy()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Xác nhận xóa' }).className).not.toContain('ant-btn-loading'))
    await user.click(screen.getByRole('button', { name: 'Xác nhận xóa' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull(), { timeout: 3000 })
    expect(remove).toHaveBeenCalledTimes(2)
  }, 15000)
})
