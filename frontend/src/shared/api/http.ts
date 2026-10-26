export class ApiError extends Error {
  readonly status: number
  readonly code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

/** JSON transport only. Credentials are never persisted or logged here. */
export async function request<T>(path: string, options: { body?: unknown; signal?: AbortSignal; method?: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT' } = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch('/api' + path, {
      method: options.method ?? (options.body === undefined ? 'GET' : 'POST'),
      signal: options.signal,
      ...(options.body === undefined ? {} : {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options.body),
      }),
    })
  } catch (error) {
    if (options.signal?.aborted) throw error
    throw new ApiError('Không gọi được backend. Kiểm tra Spring Boot tại cổng 8080.', 0)
  }
  const value = await response.json().catch(() => null)
  if (!response.ok) {
    throw new ApiError(
      typeof value?.message === 'string' ? value.message : 'Phản hồi không hợp lệ. Kiểm tra backend và cấu hình MySQL.',
      response.status,
      typeof value?.code === 'string' ? value.code : undefined,
    )
  }
  if (value === null) throw new ApiError('Backend không trả dữ liệu JSON hợp lệ.', response.status)
  return value as T
}
