'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { studiesApi } from '@/lib/studies'
import { authApi } from '@/lib/auth'
import type { Study } from '@/lib/studies'

export default function StudyDetailPage() {
  const router = useRouter()
  const params = useParams()
  const studyId = params.studyId as string

  const [study, setStudy] = useState<Study | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    checkAdmin()
    fetchStudy()
  }, [studyId])

  const checkAdmin = async () => {
    try {
      const user = await authApi.getCurrentUser()
      setIsAdmin(user?.role === 'admin')
    } catch (error) {
      console.error(error)
    }
  }

  const fetchStudy = async () => {
    try {
      setLoading(true)
      const data = await studiesApi.get(parseInt(studyId))
      setStudy(data)
    } catch (error) {
      toast.error('加载研究详情失败')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const menuItems = [
    { href: `/studies/${studyId}/subjects`, title: '受试者管理', description: '管理受试者信息', icon: '👥' },
    { href: `/studies/${studyId}/visits`, title: '随访记录', description: '管理随访记录', icon: '📅' },
    { href: `/studies/${studyId}/enter`, title: '录入与审核', description: '数据录入和 AI 审核', icon: '📝' },
    { href: `/studies/${studyId}/data`, title: '已录入数据', description: '查看已入库数据', icon: '📊' },
    { href: `/studies/${studyId}/export`, title: '数据导出', description: '导出数据用于分析', icon: '📤' },
  ]

  const settingsItems = [
    { href: `/studies/${studyId}/settings/templates`, title: '检测模板', description: '自定义检测指标', icon: '🔧' },
  ]

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-8">
          <div className="text-center">
            <p className="text-gray-600">加载中...</p>
          </div>
        </main>
      </div>
    )
  }

  if (!study) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-8">
          <Card>
            <CardContent className="py-12 text-center text-gray-500">
              研究不存在或无权访问
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8">
        {/* 研究信息 */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{study.name}</h1>
              <p className="text-gray-500 mt-1">{study.code}</p>
            </div>
            {isAdmin && (
              <Button variant="outline" onClick={() => router.push(`/studies/${studyId}/settings`)}>
                研究设置
              </Button>
            )}
          </div>
          {study.description && (
            <p className="text-gray-600 mt-4">{study.description}</p>
          )}
        </div>

        {/* 功能菜单 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {menuItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <Card className="cursor-pointer hover:shadow-lg transition-shadow h-full">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{item.icon}</span>
                    <div>
                      <CardTitle className="text-lg">{item.title}</CardTitle>
                      <CardDescription>{item.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>

        {/* 设置菜单 */}
        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-4">研究设置</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {settingsItems.map((item) => (
              <Link key={item.href} href={item.href}>
                <Card className="cursor-pointer hover:shadow-lg transition-shadow h-full">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{item.icon}</span>
                      <div>
                        <CardTitle className="text-lg">{item.title}</CardTitle>
                        <CardDescription>{item.description}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        {/* 统计信息 */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">{study.subject_count || 0}</CardTitle>
              <CardDescription>受试者</CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">{study.member_count || 0}</CardTitle>
              <CardDescription>研究成员</CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">{Object.keys(study.visit_types || {}).length}</CardTitle>
              <CardDescription>随访类型</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </main>
    </div>
  )
}
