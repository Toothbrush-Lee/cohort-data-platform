'use client'

import Link from 'next/link'
import { usePathname, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { authApi } from '@/lib/auth'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { studiesApi } from '@/lib/studies'
import type { Study } from '@/lib/studies'

export function Header() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useParams()
  const [isAdmin, setIsAdmin] = useState(false)
  const [currentStudy, setCurrentStudy] = useState<Study | null>(null)
  const [studies, setStudies] = useState<Study[]>([])

  // 检查当前用户是否为管理员
  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const user = await authApi.getCurrentUser()
        setIsAdmin(user?.role === 'admin')
      } catch (error) {
        console.error('Failed to get current user:', error)
      }
    }
    checkAdmin()
  }, [])

  // 加载研究列表和当前研究
  useEffect(() => {
    const loadStudies = async () => {
      try {
        const data = await studiesApi.listMy()
        setStudies(data)

        // 如果在研究子页面，加载当前研究信息
        const studyId = params.studyId as string
        if (studyId) {
          const study = data.find(s => s.id === parseInt(studyId))
          if (study) {
            setCurrentStudy(study)
          }
        }
      } catch (error) {
        console.error('Failed to load studies:', error)
      }
    }
    loadStudies()
  }, [params.studyId])

  const handleLogout = async () => {
    authApi.logout()
    toast.success('已退出登录')
    // 清除 token 后跳转到登录页
    router.push('/login')
  }

  const handleSwitchStudy = (studyId: string) => {
    if (studyId) {
      router.push(`/studies/${studyId}`)
    }
  }

  // 检查是否在登录页
  if (pathname === '/login') {
    return null
  }

  // 是否在有 studyId 的嵌套路由中
  const isInStudyRoute = !!params.studyId

  return (
    <header className="bg-white shadow">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/studies" className="text-xl font-bold text-gray-900">
          队列研究多模态数据中台
        </Link>
        <nav className="flex items-center gap-4">
          {/* 研究选择器 - 仅在有研究时显示 */}
          {studies.length > 0 && (
            <select
              value={isInStudyRoute ? params.studyId : ''}
              onChange={(e) => handleSwitchStudy(e.target.value)}
              className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">选择研究...</option>
              {studies.map((study) => (
                <option key={study.id} value={study.id}>
                  {study.name}
                </option>
              ))}
            </select>
          )}

          {isInStudyRoute && (
            <>
              <Link
                href={`/studies/${params.studyId}/subjects`}
                className={`text-sm ${
                  pathname.startsWith(`/studies/${params.studyId}/subjects`)
                    ? 'text-gray-900 font-medium'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                受试者
              </Link>
              <Link
                href={`/studies/${params.studyId}/visits`}
                className={`text-sm ${
                  pathname.startsWith(`/studies/${params.studyId}/visits`)
                    ? 'text-gray-900 font-medium'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                随访
              </Link>
              <Link
                href={`/studies/${params.studyId}/enter`}
                className={`text-sm ${
                  pathname.startsWith(`/studies/${params.studyId}/enter`)
                    ? 'text-gray-900 font-medium'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                录入与审核
              </Link>
              <Link
                href={`/studies/${params.studyId}/data`}
                className={`text-sm ${
                  pathname.startsWith(`/studies/${params.studyId}/data`)
                    ? 'text-gray-900 font-medium'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                已录入数据
              </Link>
              <Link
                href={`/studies/${params.studyId}/export`}
                className={`text-sm ${
                  pathname.startsWith(`/studies/${params.studyId}/export`)
                    ? 'text-gray-900 font-medium'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                导出
              </Link>
            </>
          )}

          {isAdmin && (
            <Link href="/admin">
              <Button variant="outline" size="sm">👤 用户管理</Button>
            </Link>
          )}
          <Link href="/help">
            <Button variant="outline" size="sm">📖 帮助</Button>
          </Link>
          <Button variant="outline" onClick={handleLogout}>退出</Button>
        </nav>
      </div>
    </header>
  )
}
