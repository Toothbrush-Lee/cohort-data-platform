import { getToken, removeToken, setToken } from './api'
import type { TokenResponse } from '@/types'

export const authApi = {
  login: async (username: string, password: string): Promise<TokenResponse> => {
    const token = localStorage.getItem('token')

    // 使用 FormData 发送 OAuth2 兼容的格式
    const formData = new FormData()
    formData.append('username', username)
    formData.append('password', password)

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'}/auth/login`,
      {
        method: 'POST',
        // 不要设置 Content-Type，让浏览器自动设置为 multipart/form-data
        headers: {
          Accept: 'application/json',
        },
        body: formData,
      }
    )

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: '登录失败' }))
      throw new Error(error.detail || '登录失败')
    }

    const data = await response.json()
    setToken(data.access_token)
    return data
  },

  logout: () => {
    removeToken()
  },

  getCurrentUser: async (): Promise<any> => {
    const token = getToken()
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'}/auth/me`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    )

    if (!response.ok) {
      throw new Error('获取用户信息失败')
    }

    return response.json()
  },
}
