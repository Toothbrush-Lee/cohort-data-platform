'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { subjectsApi } from '@/lib/subjects'

interface ImportResult {
  row: number
  subject_code?: string
  reason?: string
}

interface ImportResponse {
  message: string
  success: ImportResult[]
  failed: ImportResult[]
}

export default function ImportSubjectsPage() {
  const router = useRouter()
  const params = useParams()
  const studyId = parseInt(params.studyId as string)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [uploading, setUploading] = useState(false)
  const [importResult, setImportResult] = useState<ImportResponse | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      setImportResult(null)
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('请选择文件')
      return
    }

    // 检查文件类型
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ]
    const isExcel = selectedFile.name.endsWith('.xlsx') || selectedFile.name.endsWith('.xls')
    if (!isExcel) {
      toast.error('请上传 Excel 文件 (.xlsx 或 .xls)')
      return
    }

    setUploading(true)
    try {
      const token = localStorage.getItem('token')
      const formData = new FormData()
      formData.append('file', selectedFile)

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'}/subjects/import/excel?study_id=${studyId}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      )

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: '导入失败' }))
        throw new Error(error.detail || '导入失败')
      }

      const result: ImportResponse = await response.json()
      setImportResult(result)

      if (result.success.length > 0) {
        toast.success(`成功导入 ${result.success.length} 条记录`)
      }
      if (result.failed.length > 0) {
        toast.error(`失败 ${result.failed.length} 条，请查看详情`)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '导入失败')
    } finally {
      setUploading(false)
    }
  }

  const handleReset = () => {
    setSelectedFile(null)
    setImportResult(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const downloadTemplate = () => {
    // 创建一个简单的 Excel 模板下载链接
    toast.info('模板下载功能开发中，请参考以下格式创建 Excel 文件：')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">批量导入受试者</h1>
            <p className="text-sm text-gray-500 mt-1">研究 ID: {studyId}</p>
          </div>
          <div className="flex gap-2">
            <Link href={`/studies/${studyId}/subjects`}>
              <Button variant="outline">返回受试者列表</Button>
            </Link>
          </div>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>上传 Excel 文件</CardTitle>
              <CardDescription>
                批量导入受试者信息
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="file-upload"
                />
                <label
                  htmlFor="file-upload"
                  className="cursor-pointer"
                >
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <p className="text-lg font-medium text-gray-700">
                    {selectedFile ? selectedFile.name : '点击选择 Excel 文件'}
                  </p>
                  <p className="text-sm text-gray-500 mt-2">
                    支持格式：.xlsx, .xls
                  </p>
                </label>
              </div>

              {selectedFile && (
                <div className="flex gap-4">
                  <Button
                    onClick={handleUpload}
                    disabled={uploading}
                    className="flex-1"
                  >
                    {uploading ? '导入中...' : '开始导入'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleReset}
                    disabled={uploading}
                  >
                    重新选择
                  </Button>
                </div>
              )}

              <div className="bg-blue-50 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">Excel 格式要求</h4>
                <p className="text-sm text-blue-800 mb-2">请确保 Excel 文件包含以下列：</p>
                <table className="w-full text-sm text-blue-800">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">列名</th>
                      <th className="text-left">说明</th>
                      <th className="text-left">必填</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="py-2 font-medium">subject_code</td>
                      <td>受试者编号</td>
                      <td>是</td>
                    </tr>
                    <tr>
                      <td className="py-2 font-medium">name_pinyin</td>
                      <td>姓名拼音</td>
                      <td>是</td>
                    </tr>
                    <tr>
                      <td className="py-2 font-medium">gender</td>
                      <td>性别（男/女）</td>
                      <td>否（默认男）</td>
                    </tr>
                    <tr>
                      <td className="py-2 font-medium">birth_date</td>
                      <td>出生日期（YYYY-MM-DD）</td>
                      <td>否</td>
                    </tr>
                    <tr>
                      <td className="py-2 font-medium">enrollment_date</td>
                      <td>入组日期（YYYY-MM-DD）</td>
                      <td>否</td>
                    </tr>
                    <tr>
                      <td className="py-2 font-medium">notes</td>
                      <td>备注</td>
                      <td>否</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {importResult && (
            <Card>
              <CardHeader>
                <CardTitle>导入结果</CardTitle>
                <CardDescription>{importResult.message}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {importResult.success.length > 0 && (
                  <div>
                    <h4 className="font-medium text-green-700 mb-2">
                      成功 {importResult.success.length} 条
                    </h4>
                    <div className="max-h-40 overflow-y-auto border rounded bg-green-50 p-2">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-1">行号</th>
                            <th className="text-left">受试者编号</th>
                          </tr>
                        </thead>
                        <tbody>
                          {importResult.success.slice(0, 10).map((item) => (
                            <tr key={item.row}>
                              <td className="py-1">{item.row}</td>
                              <td>{item.subject_code}</td>
                            </tr>
                          ))}
                          {importResult.success.length > 10 && (
                            <tr>
                              <td colSpan={2} className="text-gray-500 italic py-1">
                                还有 {importResult.success.length - 10} 条...
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {importResult.failed.length > 0 && (
                  <div>
                    <h4 className="font-medium text-red-700 mb-2">
                      失败 {importResult.failed.length} 条
                    </h4>
                    <div className="max-h-40 overflow-y-auto border rounded bg-red-50 p-2">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-1">行号</th>
                            <th className="text-left">失败原因</th>
                          </tr>
                        </thead>
                        <tbody>
                          {importResult.failed.map((item) => (
                            <tr key={item.row}>
                              <td className="py-1">{item.row}</td>
                              <td className="text-red-600">{item.reason}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
