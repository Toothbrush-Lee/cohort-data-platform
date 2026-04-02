// API 配置
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'

// 获取存储的 token
export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('token')
}

// 存储 token
export function setToken(token: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem('token', token)
}

// 清除 token
export function removeToken(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem('token')
}

// API 请求封装
export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: '请求失败' }))
    throw new Error(error.detail || '请求失败')
  }

  return response.json()
}

// API 请求封装（返回 Blob，用于下载）
export async function apiRequestBlob(
  endpoint: string,
  options: RequestInit = {}
): Promise<Blob> {
  const token = getToken()

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: '请求失败' }))
    throw new Error(error.detail || '请求失败')
  }

  return response.blob()
}
