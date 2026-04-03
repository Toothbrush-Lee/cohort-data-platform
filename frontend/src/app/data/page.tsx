'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Header } from '@/components/header'
import { assessmentsApi } from '@/lib/files'
import { subjectsApi } from '@/lib/subjects'
import type { AssessmentData, Subject } from '@/types'
import { toast } from 'sonner'
import { authApi } from '@/lib/auth'
import { useRouter } from 'next/navigation'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface AssessmentWithDetails extends AssessmentData {
  subject_code?: string
  subject_name?: string
  visit_name?: string
  visit_date?: string
}

export default function DataPage() {
  const router = useRouter()
  const [data, setData] = useState<AssessmentWithDetails[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedData, setSelectedData] = useState<AssessmentWithDetails | null>(null)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)

  const assessmentTypes = ['EndoPAT', 'TCD', 'Vicorder', 'BloodTest', 'CGM', 'Wearable']

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/login')
      return
    }
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [assessmentsData, subjectsData] = await Promise.all([
        assessmentsApi.list(),
        subjectsApi.list(),
      ])
      setData(assessmentsData)
      setSubjects(subjectsData)
    } catch (error) {
      toast.error('加载失败')
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async (id: number) => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'}/assessments/${id}/download`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      if (!response.ok) {
        throw new Error('下载失败')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `assessment_${id}.json`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success('下载成功')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '下载失败')
    }
  }

  const handleBatchDownload = async (format: 'json' | 'csv' | 'excel') => {
    try {
      const token = localStorage.getItem('token')
      const params = new URLSearchParams()
      params.append('format', format)
      params.append('data_format', 'long')  // 默认使用长格式

      if (typeFilter !== 'all') {
        params.append('assessment_type', typeFilter)
      }
      if (statusFilter !== 'all') {
        params.append('is_verified', statusFilter === 'verified')
      }

      const url = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'}/assessments/export?${params.toString()}`

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        const error = await response.json().catch(() => null)
        const errorMsg = error?.detail || error?.message || '导出失败'
        throw new Error(errorMsg)
      }

      const blob = await response.blob()
      const ext = format === 'json' ? 'json' : format === 'csv' ? 'csv' : 'xlsx'
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = `assessments_export_${new Date().toISOString().split('T')[0]}.${ext}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(downloadUrl)
      document.body.removeChild(a)
      toast.success('导出成功')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '导出失败')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这条数据吗？此操作不可恢复。')) return

    try {
      const token = localStorage.getItem('token')
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'}/assessments/${id}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: '删除失败' }))
        throw new Error(error.detail || '删除失败')
      }

      toast.success('删除成功')
      loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '删除失败')
    }
  }

  const handleViewDetail = (assessment: AssessmentWithDetails) => {
    setSelectedData(assessment)
    setDetailDialogOpen(true)
  }

  const filteredData = data.filter((item) => {
    const matchSearch = !search ||
      item.assessment_type.toLowerCase().includes(search.toLowerCase()) ||
      String(item.id).includes(search) ||
      (item.subject_code && item.subject_code.toLowerCase().includes(search.toLowerCase()))
    const matchType = typeFilter === 'all' || item.assessment_type === typeFilter
    const matchStatus = statusFilter === 'all' ||
      (statusFilter === 'verified' && item.is_verified) ||
      (statusFilter === 'pending' && !item.is_verified)
    return matchSearch && matchType && matchStatus
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">已录入数据</h2>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => handleBatchDownload('json')}>
              导出 JSON
            </Button>
            <Button variant="outline" onClick={() => handleBatchDownload('csv')}>
              导出 CSV
            </Button>
            <Button variant="outline" onClick={() => handleBatchDownload('excel')}>
              导出 Excel
            </Button>
          </div>
        </div>

        {/* 筛选器 */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>搜索</Label>
                <Input
                  placeholder="搜索检测类型、ID 或受试者编号..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>检测类型</Label>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="all">全部</option>
                  {assessmentTypes.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>状态</Label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="all">全部</option>
                  <option value="verified">已审核</option>
                  <option value="pending">待审核</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 数据列表 */}
        <Card>
          <CardHeader>
            <CardTitle>数据列表</CardTitle>
            <CardDescription>
              共 {filteredData.length} 条记录 {search || typeFilter !== 'all' || statusFilter !== 'all' ? '(筛选后)' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-gray-500">加载中...</div>
            ) : filteredData.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                暂无数据
                <div className="mt-2">
                  <Link href="/data-entry">
                    <Button variant="link">去录入数据</Button>
                  </Link>
                  或
                  <Link href="/upload">
                    <Button variant="link">上传文件</Button>
                  </Link>
                </div>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>受试者编号</TableHead>
                    <TableHead>姓名</TableHead>
                    <TableHead>检测类型</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>采样时间</TableHead>
                    <TableHead>创建时间</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.subject_code || '-'}</TableCell>
                      <TableCell>{item.subject_name_pinyin || '-'}</TableCell>
                      <TableCell>
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">
                          {item.assessment_type}
                        </span>
                      </TableCell>
                      <TableCell>
                        {item.is_verified ? (
                          <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">
                            已审核
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-sm">
                            待审核
                          </span>
                        )}
                      </TableCell>
                      <TableCell>{item.sample_time ? item.sample_time.split('T')[0] : '-'}</TableCell>
                      <TableCell>{item.created_at?.split('T')[0] || '-'}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewDetail(item)}
                          >
                            查看
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownload(item.id)}
                          >
                            下载
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(item.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            删除
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>

      {/* 详情对话框 */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>数据详情</DialogTitle>
          </DialogHeader>
          {selectedData && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-gray-500">检测类型</Label>
                  <p className="font-medium">{selectedData.assessment_type}</p>
                </div>
                <div>
                  <Label className="text-gray-500">状态</Label>
                  <p className="font-medium">
                    {selectedData.is_verified ? '已审核' : '待审核'}
                  </p>
                </div>
                <div>
                  <Label className="text-gray-500">采样时间</Label>
                  <p className="font-medium">
                    {selectedData.sample_time ? selectedData.sample_time.replace('T', ' ') : '未设置'}
                  </p>
                </div>
                <div>
                  <Label className="text-gray-500">创建时间</Label>
                  <p className="font-medium">{selectedData.created_at?.replace('T', ' ') || '-'}</p>
                </div>
                <div>
                  <Label className="text-gray-500">审核时间</Label>
                  <p className="font-medium">{selectedData.verified_at?.replace('T', ' ') || '-'}</p>
                </div>
              </div>

              <div>
                <Label className="text-gray-500">提取数据</Label>
                <div className="mt-2 bg-gray-50 rounded-lg p-4 font-mono text-sm max-h-96 overflow-auto">
                  <pre>{JSON.stringify(selectedData.extracted_data, null, 2)}</pre>
                </div>
              </div>

              {selectedData.file_id && (
                <div>
                  <Label className="text-gray-500">原始文件 ID</Label>
                  <p className="font-medium">{selectedData.file_id}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>
              关闭
            </Button>
            {selectedData && (
              <Button onClick={() => handleDownload(selectedData.id)}>
                下载 JSON
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
