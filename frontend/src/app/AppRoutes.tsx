import { Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from '../layouts/AppLayout'
import ConnectionsPage from '../features/connections/pages/ConnectionsPage'
import DatasetPage from '../features/datasets/pages/DatasetPage'
import ChartBuilderPage from '../features/charts/pages/ChartBuilderPage'
import DashboardPage from '../features/dashboards/pages/DashboardPage'

export default function AppRoutes() {
  return <Routes>
    <Route element={<AppLayout />}>
      <Route index element={<Navigate to="/connections" replace />} />
      <Route path="connections" element={<ConnectionsPage />} />
      <Route path="datasets" element={<DatasetPage />} />
      <Route path="charts" element={<ChartBuilderPage />} />
      <Route path="dashboards" element={<DashboardPage />} />
      <Route path="*" element={<Navigate to="/connections" replace />} />
    </Route>
  </Routes>
}
