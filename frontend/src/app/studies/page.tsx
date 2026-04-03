'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toast } from 'sonner'
import { studiesApi } from '@/lib/studies'
import { authApi } from '@/lib/auth'
import type { Study } from '@/lib/studies'

export default function StudiesPage() {
  const router = useRouter()
  const [studies, setStudies] = useState<Study[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
  })

  useEffect(() => {
    checkAdmin()
    fetchStudies()
  }, [])

  const checkAdmin = async () => {
    try {
      const user = await authApi.getCurrentUser()
      setIsAdmin(user?.role === 'admin')
    } catch (error) {
      console.error(error)
    }
  }

  const fetchStudies = async () => {
    try {
      setLoading(true)
      const data = await studiesApi.listMy()
      setStudies(data)
    } catch (error) {
      toast.error('加载研究列表失败')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    try {
      await studiesApi.create(formData)
      toast.success('研究创建成功')
      setCreateDialogOpen(false)
      setFormData({ name: '', code: '', description: '' })
      fetchStudies()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '创建失败'
      toast.error(errorMessage)
    }
  }

  const handleSelectStudy = (studyId: number) => {
    router.push(`/studies/${studyId}`)
  }

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

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-900">选择研究</h1>
          {isAdmin && (
            <Button onClick={() => setCreateDialogOpen(true)}>
              + 创建新研究
            </Button>
          )}
        </div>

        {studies.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-gray-500">
              暂无研究记录
              {isAdmin && (
                <div className="mt-4">
                  <Button variant="link" onClick={() => setCreateDialogOpen(true)}>
                    创建第一个研究
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {studies.map((study) => (
              <Card
                key={study.id}
                className="cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => handleSelectStudy(study.id)}
              >
                <CardHeader>
                  <CardTitle>{study.name}</CardTitle>
                  <CardDescription>{study.code}</CardDescription>
                </CardHeader>
                <CardContent>
                  {study.description && (
                    <p className="text-sm text-gray-600 mb-4">{study.description}</p>
                  )}
                  <div className="flex gap-4 text-xs text-gray-500">
                    <span>{study.subject_count || 0} 名受试者</span>
                    <span>{study.member_count || 0} 名成员</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* 创建研究对话框 */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>创建新研究</DialogTitle>
            <DialogDescription>
              填写以下信息创建新的队列研究
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="name">研究名称</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="例如：队列 A、糖尿病研究"
              />
            </div>
            <div>
              <Label htmlFor="code">研究编码</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="例如：COHORT_A"
              />
            </div>
            <div>
              <Label htmlFor="description">研究描述</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="可选"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleCreate}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
