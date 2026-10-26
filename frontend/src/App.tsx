import { ConfigProvider } from 'antd'
import { QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import AppRoutes from './app/AppRoutes'
import { createQueryClient } from './app/queryClient'

const queryClient = createQueryClient()

export default function App() {
  return (
    <ConfigProvider theme={{ token: { colorPrimary: '#2870e8', borderRadius: 10, colorText: '#102447', fontFamily: "'Segoe UI', Arial, sans-serif" } }}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter><AppRoutes /></BrowserRouter>
      </QueryClientProvider>
    </ConfigProvider>
  )
}
