import { useRef, useState } from 'react'
import { Alert, Button, Form, Input, InputNumber } from 'antd'
import { connectionsApi } from '../api'
import type { ConnectionInput, ConnectionView } from '../types'

const defaults: ConnectionInput = { name: 'MySQL local', host: 'localhost', port: 3306, databaseName: 'datademo_source', username: 'datademo_reader', password: '' }

export default function ConnectionForm({ onSaved }: { onSaved: (connection: ConnectionView) => void }) {
  const [form] = Form.useForm<ConnectionInput>()
  const [busy, setBusy] = useState<'test' | 'save' | null>(null)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)
  const pending = useRef(false)
  const revision = useRef(0)

  async function submit(mode: 'test' | 'save') {
    if (pending.current) return
    pending.current = true
    try {
      let values: ConnectionInput
      try { values = await form.validateFields() } catch { return }
      const token = revision.current
      setBusy(mode); setResult(null)
      try {
        const input = { ...values, password: values.password ?? '' }
        if (mode === 'test') {
          const response = await connectionsApi.test(input)
          if (revision.current === token) setResult({ ok: true, message: response.message })
        } else {
          const connection = await connectionsApi.save(input)
          form.setFieldValue('password', '')
          setResult({ ok: true, message: 'Đã kiểm tra và lưu kết nối. Mật khẩu được mã hóa.' })
          onSaved(connection)
        }
      } catch (error) {
        if (revision.current === token) setResult({ ok: false, message: (error as Error).message })
      }
    } finally { pending.current = false; setBusy(null) }
  }

  return <section className="surface"><h2>Thêm kết nối</h2>
    <Form form={form} layout="vertical" initialValues={defaults} disabled={busy !== null} onValuesChange={() => { revision.current++; setResult(null) }} onFinish={() => submit('save')}>
      <Form.Item label="Tên kết nối" name="name" rules={[{ required: true, whitespace: true, message: 'Nhập tên kết nối.' }, { max: 100 }]}><Input maxLength={100} /></Form.Item>
      <div className="host-port">
        <Form.Item label="Host" name="host" rules={[{ required: true, whitespace: true, message: 'Nhập Host.' }]}><Input /></Form.Item>
        <Form.Item label="Port" name="port" rules={[{ required: true, message: 'Nhập Port.' }]}><InputNumber min={1} max={65535} precision={0} style={{ width: '100%' }} /></Form.Item>
      </div>
      <Form.Item label="Database" name="databaseName" rules={[{ required: true, whitespace: true, message: 'Nhập database.' }]}><Input /></Form.Item>
      <Form.Item label="Tài khoản" name="username" rules={[{ required: true, whitespace: true, message: 'Nhập tài khoản.' }]}><Input autoComplete="username" /></Form.Item>
      <Form.Item label="Mật khẩu" name="password"><Input.Password autoComplete="new-password" placeholder="Mật khẩu tài khoản nguồn" /></Form.Item>
      {result && <Alert type={result.ok ? 'success' : 'error'} showIcon title={result.message} className="section-alert" />}
      <div className="form-actions"><Button onClick={() => submit('test')} loading={busy === 'test'}>Kiểm tra kết nối</Button><Button type="primary" htmlType="submit" loading={busy === 'save'}>Lưu</Button></div>
    </Form>
    <p className="footnote">Chỉ hỗ trợ MySQL. Dùng tài khoản chỉ đọc nguồn; mật khẩu không hiển thị lại sau khi lưu.</p>
  </section>
}
