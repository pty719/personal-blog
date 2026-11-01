// 公开接口的统一 fetch 包装：公开页不需要 token，后台仍用 api/request.js。
export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export async function apiGet(path, { signal } = {}) {
  let res
  try {
    res = await fetch(path, { signal })
  } catch (e) {
    if (e.name === 'AbortError') throw e
    throw new ApiError('网络连接失败，请检查后端是否启动。', 0)
  }

  if (!res.ok) {
    let detail = `请求失败（${res.status}）`
    try {
      const data = await res.json()
      if (data && data.detail) detail = data.detail
    } catch {
      /* 响应体不是 JSON 时保留状态码信息 */
    }
    throw new ApiError(detail, res.status)
  }

  return res.json()
}
