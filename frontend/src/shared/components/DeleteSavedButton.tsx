import { useRef, useState } from 'react'
import { Alert, Button, Modal } from 'antd'

export default function DeleteSavedButton({ kind, name, description, onDelete }: {
  kind: string
  name: string
  description: string
  onDelete: () => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef(false)
  async function remove() {
    if (pending.current) return
    pending.current = true; setBusy(true); setError('')
    try { await onDelete(); setOpen(false) }
    catch (failure) { setError((failure as Error).message) }
    finally { pending.current = false; setBusy(false) }
  }
  return <>
    <Button danger aria-label={`Xóa ${kind} ${name}`} onClick={() => { setError(''); setOpen(true) }}>Xóa</Button>
    <Modal title={`Xóa ${kind}?`} open={open} okText="Xác nhận xóa" cancelText="Hủy" confirmLoading={busy}
      okButtonProps={{ danger: true, 'aria-label': 'Xác nhận xóa' }} cancelButtonProps={{ disabled: busy }}
      closable={!busy} mask={{ closable: !busy }} keyboard={!busy} onCancel={() => setOpen(false)} onOk={() => { void remove() }}>
      <p>Bạn có chắc muốn xóa <strong>{name}</strong>?</p>
      <p>{description}</p>
      {error && <Alert type="error" showIcon title={error} />}
    </Modal>
  </>
}
