import { describe, it, expect, vi, afterEach } from 'vitest'
import { apiGet, ApiError } from './publicApi'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('apiGet', () => {
  it('returns parsed JSON on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [1, 2] }),
    }))
    await expect(apiGet('/api/articles')).resolves.toEqual({ items: [1, 2] })
  })

  it('throws ApiError with the backend detail', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ detail: '文章不存在' }),
    }))
    const error = await apiGet('/api/articles/999').catch((e) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(404)
    expect(error.message).toBe('文章不存在')
  })

  it('normalizes network failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))
    await expect(apiGet('/api/articles')).rejects.toThrow('网络连接失败')
  })

  it('rethrows AbortError untouched', async () => {
    const abort = new Error('aborted')
    abort.name = 'AbortError'
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abort))
    await expect(apiGet('/api/articles')).rejects.toThrow('aborted')
  })
})
