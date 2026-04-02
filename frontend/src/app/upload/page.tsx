'use client'

import { useEffect, useState, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Header } from '@/components/header'
import { visitsApi } from '@/lib/visits'
import { filesApi } from '@/lib/files'
import type { Visit, RawFile } from '@/types'
import { toast } from 'sonner'
import { authApi } from '@/lib/auth'
import { useRouter } from 'next/navigation'

const FILE_TYPE_OPTIONS = [
  { value: 'EndoPAT', label: 'EndoPAT (RHI 检测)' },
  { value: 'TCD', label: 'TCD (经颅多普勒)' },
  { value: 'Vicorder', label: 'Vicorder (PWV 检测)' },
  { value: 'BloodTest', label: '血检报告' },
  { value: 'CGM', label: 'CGM (连续血糖)' },
  { value: 'Wearable', label: '其他可穿戴设备' },
]

export default function UploadPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const visitIdFromQuery = searchParams.get('visit_id')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [visits, setVisits] = useState<Visit[]>([])
  const [selectedVisitId, setSelectedVisitId] = useState<string>('')
  const [fileType, setFileType] = useState('EndoPAT')
  const [uploading, setUploading] = useState(false)
  const [files, setFiles] = useState<RawFile[]>([])
  const [loading, setLoading] = useState(true)

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
      const visitsData = await visitsApi.list()
      setVisits(visitsData)
      if (visitsData.length > 0 && !visitIdFromQuery) {
        setSelectedVisitId(String(visitsData[0].id))
      }
    } catch (error) {
      toast.error('加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (visitIdFromQuery) {
      setSelectedVisitId(visitIdFromQuery)
      loadFiles(parseInt(visitIdFromQuery))
    }
  }, [visitIdFromQuery])

  const loadFiles = async (visitId: number) => {
    try {
      const data = await filesApi.list({ visit_id: visitId })
      setFiles(data)

      // 检查是否有正在处理中的文件，如果有则继续轮询
      const hasProcessing = data.some(f => f.status === 'processing' || (f.status === 'pending_review' && !f.ai_extracted_data))
      if (hasProcessing) {
        setTimeout(() => loadFiles(visitId), 2000) // 2 秒后重试
      }
    } catch (error) {
      console.error('Failed to load files:', error)
    }
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedVisitId) return

    setUploading(true)
    try {
      await filesApi.upload(file, parseInt(selectedVisitId), fileType)
      toast.success('上传成功，AI 正在提取数据...')
      loadFiles(parseInt(selectedVisitId))
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      // 开始轮询等待 AI 提取完成
      const pollInterval = setInterval(() => {
        loadFiles(parseInt(selectedVisitId)).then(() => {
          // 检查是否所有文件都已完成处理
          setFiles(prevFiles => {
            const hasProcessing = prevFiles.some(f => f.status === 'processing' || (f.status === 'pending_review' && !f.ai_extracted_data))
            if (!hasProcessing) {
              clearInterval(pollInterval)
              toast.success('AI 提取完成，请确认数据')
            }
            return prevFiles
          })
        })
      }, 2000)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '上传失败')
    } finally {
      setUploading(false)
    }
  }

  const handleVisitChange = (visitId: string) => {
    setSelectedVisitId(visitId)
    if (visitId) {
      loadFiles(parseInt(visitId))
    }
  }

  const handleDownload = async (fileId: number, originalFilename: string, storedFilename?: string) => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'}/files/${fileId}/download`,
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
      // 优先使用存储文件名（规范命名），没有则用原始文件名
      a.download = storedFilename || originalFilename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success('下载成功')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '下载失败')
    }
  }

  const handleDelete = async (fileId: number) => {
    if (!confirm('确定要删除这个文件吗？删除后不可恢复。')) return

    try {
      await filesApi.delete(fileId)
      toast.success('删除成功')
      if (selectedVisitId) {
        loadFiles(parseInt(selectedVisitId))
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '删除失败')
    }
  }

  const handleConfirm = async (fileId: number) => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'}/files/${fileId}/confirm`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      if (!response.ok) {
        const error = await response.json().catch(() => null)
        throw new Error(error?.detail || '确认失败')
      }

      const result = await response.json()
      toast.success(`数据已确认入库 (ID: ${result.assessment_id})`)
      if (selectedVisitId) {
        loadFiles(parseInt(selectedVisitId))
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '确认失败')
    }
  }

  const handleLogout = () => {
    authApi.logout()
    router.push('/')
    toast.success('已退出登录')
  }

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, string> = {
      uploaded: 'bg-gray-100 text-gray-800',
      processing: 'bg-blue-100 text-blue-800',
      pending_review: 'bg-yellow-100 text-yellow-800',
      verified: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
    }
    const statusText: Record<string, string> = {
      uploaded: '已上传',
      processing: '处理中',
      pending_review: '待审核',
      verified: '已入库',
      rejected: '已驳回',
    }
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${statusMap[status] || 'bg-gray-100'}`}>
        {statusText[status] || status}
      </span>
    )
  }

  const renderFileItem = (file: RawFile) => {
    return (
      <div
        key={file.id}
        className="flex items-start justify-between p-4 bg-gray-50 rounded-lg"
      >
        <div className="flex-1">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <p className="font-medium">{file.original_filename}</p>
              <p className="text-sm text-gray-500">
                {file.file_type} • {(file.file_size || 0) / 1024 / 1024 < 0.01 ? '< 0.01' : ((file.file_size || 0) / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          </div>

          {/* AI 提取结果 - 只读显示 */}
          {file.ai_extracted_data && Object.keys(file.ai_extracted_data).length > 0 && (
            <div className="mt-3 ml-14">
              <div className="font-medium text-blue-700 mb-2">
                AI 提取结果：
              </div>
              <div className="bg-white p-4 rounded border">
                <pre className="text-xs overflow-auto max-h-60">
                  {JSON.stringify(file.ai_extracted_data, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 ml-4">
          <div className="flex gap-2">
            {getStatusBadge(file.status)}
          </div>
          <div className="flex gap-2 mt-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleDownload(file.id, file.original_filename, file.stored_filename)}
            >
              下载
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => handleDelete(file.id)}
            >
              删除
            </Button>
          </div>
          {file.status === 'pending_review' && file.ai_extracted_data && (
            <Button
              size="sm"
              className="mt-2"
              onClick={() => router.push(`/enter?visit_id=${file.visit_id}`)}
            >
              去审核
            </Button>
          )}
          {file.status === 'pending_review' && !file.ai_extracted_data && (
            <span className="text-sm text-yellow-600 mt-2">AI 提取中...</span>
          )}
          {file.status === 'verified' && (
            <span className="text-sm text-green-600 font-medium mt-2">已入库</span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="container mx-auto px-4 py-8">
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>上传文件</CardTitle>
              <CardDescription>
                选择随访记录并上传 PDF 报告或数据文件，系统将自动使用 AI 提取数据
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="visit">选择随访记录</Label>
                <select
                  id="visit"
                  value={selectedVisitId}
                  onChange={(e) => handleVisitChange(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">请选择</option>
                  {visits.map((visit) => (
                    <option key={visit.id} value={visit.id}>
                      {visit.subject_code} - {visit.visit_name} ({visit.visit_date.split('T')[0]})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="fileType">文件类型</Label>
                <select
                  id="fileType"
                  value={fileType}
                  onChange={(e) => setFileType(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {FILE_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="file">选择文件</Label>
                <Input
                  id="file"
                  type="file"
                  ref={fileInputRef}
                  onChange={handleUpload}
                  accept=".pdf,.csv,.xlsx,.xls"
                  disabled={!selectedVisitId || uploading}
                />
                <p className="text-sm text-gray-500">
                  支持格式：PDF (报告), CSV/Excel (时间序列数据)
                </p>
              </div>

              {uploading && (
                <div className="flex items-center gap-2 text-blue-600">
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  上传中...
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>使用说明</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2 text-gray-600">
              <p>1. 选择受试者的随访记录</p>
              <p>2. 选择文件类型（报告种类）</p>
              <p>3. 上传文件后，AI 会自动提取数据</p>
              <p>4. 在"审核"页面确认 AI 提取结果</p>
              <hr className="my-2" />
              <p className="font-medium">支持的文件：</p>
              <ul className="list-disc list-inside space-y-1">
                <li>EndoPAT PDF 报告</li>
                <li>TCD 超声报告</li>
                <li>Vicorder PWV 报告</li>
                <li>血检报告 PDF</li>
                <li>CGM 数据 CSV/Excel</li>
              </ul>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>已上传文件</CardTitle>
            <CardDescription>当前随访记录下的文件列表</CardDescription>
          </CardHeader>
          <CardContent>
            {files.length === 0 ? (
              <p className="text-center py-8 text-gray-500">暂无文件</p>
            ) : (
              <div className="space-y-3">
                {files.map((file) => renderFileItem(file))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
