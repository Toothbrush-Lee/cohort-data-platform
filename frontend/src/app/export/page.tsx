'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Header } from '@/components/header'
import { toast } from 'sonner'
import { authApi } from '@/lib/auth'
import { useRouter } from 'next/navigation'

export default function ExportPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [dataFormat, setDataFormat] = useState<'wide' | 'long'>('long')
  const [filters, setFilters] = useState({
    subject_codes: '',
    visit_names: '',
    assessment_types: '',
  })

  const handleLogout = () => {
    authApi.logout()
    router.push('/')
    toast.success('已退出登录')
  }

  const handleExport = async (format: 'csv' | 'excel') => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const params = new URLSearchParams()
      params.append('format', format)
      params.append('data_format', dataFormat)

      if (filters.assessment_types) {
        const types = filters.assessment_types.split(',').map(s => s.trim()).filter(Boolean)
        if (types.length > 0) {
          params.append('assessment_type', types[0])
        }
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

      // 下载文件
      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = `cohort_export_${new Date().getTime()}.${format === 'csv' ? 'csv' : 'xlsx'}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(downloadUrl)
      document.body.removeChild(a)

      toast.success('导出成功')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '导出失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>数据导出</CardTitle>
              <CardDescription>
                导出所有已审核的结构化数据，支持 CSV 和 Excel 格式
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="assessment_types">检查类型（可选）</Label>
                <Input
                  id="assessment_types"
                  placeholder="例：EndoPAT, TCD, Vicorder, BloodTest"
                  value={filters.assessment_types}
                  onChange={(e) => setFilters({ ...filters, assessment_types: e.target.value })}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="data-format">数据格式</Label>
                <select
                  id="data-format"
                  value={dataFormat}
                  onChange={(e) => setDataFormat(e.target.value as 'wide' | 'long')}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="long">长格式（每行一个指标值）</option>
                  <option value="wide">宽格式（每行一个样本）</option>
                </select>
                <p className="text-xs text-gray-500">
                  {dataFormat === 'long'
                    ? '导出格式：样本编号，访视名称，检测类型，指标名称，指标值 - 适合统计分析'
                    : '导出格式：样本编号，访视名称，检测类型，各指标为独立列 - 适合数据查看'}
                </p>
              </div>

              <div className="pt-4 flex gap-4">
                <Button
                  onClick={() => handleExport('csv')}
                  disabled={loading}
                  className="flex-1"
                >
                  {loading ? '导出中...' : '导出 CSV'}
                </Button>
                <Button
                  onClick={() => handleExport('excel')}
                  disabled={loading}
                  variant="outline"
                  className="flex-1"
                >
                  {loading ? '导出中...' : '导出 Excel'}
                </Button>
              </div>

              <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">导出数据说明</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• 仅导出已审核（已确认入库）的数据</li>
                  <li>• CSV 文件使用 UTF-8 编码，支持 Excel 直接打开</li>
                  <li>• Excel 文件格式为 .xlsx</li>
                  <li>• 如需更灵活的导出选项，请使用「已录入数据」页面</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
