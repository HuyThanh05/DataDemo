import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useOutletContext } from 'react-router-dom'
import type { WorkspaceContext } from '../../../layouts/AppLayout'
import type { ConnectionView } from '../types'
import { connectionKeys, connectionsApi } from '../api'
import ConnectionForm from '../components/ConnectionForm'
import ConnectionList from '../components/ConnectionList'
import SourceMetadata from '../components/SourceMetadata'

export default function ConnectionsPage() {
  const { search, selectedConnection: selected, setSelectedConnection } = useOutletContext<WorkspaceContext>()
  const navigate = useNavigate()
  const client = useQueryClient()
  const [requestedTable, setRequestedTable] = useState('')
  const [retesting, setRetesting] = useState(false)
  const [retestResult, setRetestResult] = useState<{ id: number; ok: boolean; message: string } | null>(null)
  const list = useQuery({ queryKey: connectionKeys.list, queryFn: ({ signal }) => connectionsApi.list(signal) })
  const tables = useQuery({ queryKey: connectionKeys.tables(selected?.id), queryFn: ({ signal }) => connectionsApi.tables(selected!.id, signal), enabled: selected !== null })
  const table = tables.data?.includes(requestedTable) ? requestedTable : tables.data?.[0] ?? ''
  const columns = useQuery({ queryKey: connectionKeys.columns(selected?.id, table), queryFn: ({ signal }) => connectionsApi.columns(selected!.id, table, signal), enabled: selected !== null && table !== '' })

  function select(connection: ConnectionView) {
    setSelectedConnection(connection); setRequestedTable(''); setRetestResult(null)
  }
  function saved(connection: ConnectionView) {
    client.setQueryData<ConnectionView[]>(connectionKeys.list, old => [connection, ...(old ?? []).filter(c => c.id !== connection.id)])
    void client.invalidateQueries({ queryKey: connectionKeys.list })
    select(connection)
  }
  async function retest() {
    if (!selected || retesting) return
    const id = selected.id
    setRetesting(true); setRetestResult(null)
    try {
      const response = await connectionsApi.retest(id)
      setRetestResult({ id, ok: true, message: response.message })
      await client.invalidateQueries({ queryKey: ['connection', id] })
    } catch (e) { setRetestResult({ id, ok: false, message: (e as Error).message }) }
    finally { setRetesting(false) }
  }
  const result = retestResult?.id === selected?.id ? retestResult : null
  const error = tables.error?.message || columns.error?.message || (result && !result.ok ? result.message : undefined)

  return <>
    <header className="page-heading"><h1>Kết nối database</h1><p>Nhập thông tin, kiểm tra kết nối và xem bảng/cột.</p></header>
    <div className="connection-grid"><div className="left-stack">
      <ConnectionList connections={list.data ?? []} search={search} selectedId={selected?.id} loading={list.isFetching} error={list.error?.message} onRefresh={() => { void list.refetch() }} onSelect={select} />
      <ConnectionForm onSaved={saved} />
    </div>
      <SourceMetadata connection={selected} tables={tables.data ?? []} table={table} columns={columns.data ?? []} loading={tables.isFetching || columns.isFetching} retesting={retesting} error={error} success={result?.ok ? result.message : undefined} onSelectTable={setRequestedTable} onRetest={() => { void retest() }} onCreateDataset={() => { if (selected && table) navigate(`/datasets?${new URLSearchParams({ connectionId: String(selected.id), table })}`) }} />
    </div>
  </>
}
