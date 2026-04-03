'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Header } from '@/components/header'
import { visitsApi } from '@/lib/visits'
import { subjectsApi } from '@/lib/subjects'
import { templatesApi } from '@/lib/templates'
import { assessmentsApi } from '@/lib/files'
import { apiRequest } from '@/lib/api'
import type { Visit, Subject, AssessmentTemplate } from '@/types'
import { toast } from 'sonner'
import { authApi } from '@/lib/auth'
import { useRouter } from 'next/navigation'

interface TemplateFormData {
  [key: string]: string | number | boolean
}

interface AssessmentWithDetails {
  id: number
  assessment_type: string
  extracted_data: Record<string, unknown>
  is_verified: boolean
  file_id?: number
  sample_time?: string
  created_at?: string
}

interface PendingReviewFile {
  id: number
  file_type: string
  original_filename: string
  ai_extracted_data: Record<string, unknown>
  status: string
  uploaded_at: string
}

interface EditingState {
  [fileId: number]: {
    data: Record<string, any>
    sampleTime: string
  }
}

interface VisitSummaryWithFiles extends VisitSummary {
  visit: { id: number; visit_name: string; visit_date: string }
  subject: { id: number; subject_code: string; name_pinyin: string; gender: string }
  assessments: AssessmentWithDetails[]
  pending_files: PendingReviewFile[]
}

export default function EnterPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const visitId = searchParams.get('visit_id')

  const [visits, setVisits] = useState<Visit[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [templates, setTemplates] = useState<AssessmentTemplate[]>([])
  const [summary, setSummary] = useState<VisitSummary | null>(null)

  const [selectedVisitType, setSelectedVisitType] = useState<string>('')
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('')
  const [selectedVisitId, setSelectedVisitId] = useState<string>('')
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  const [sampleTime, setSampleTime] = useState<string>('')
  const [formData, setFormData] = useState<TemplateFormData>({})

  const [loading, setLoading] = useState(true)
  const [verifying, setVerifying] = useState<number | null>(null)

  // 待审核文件列表和编辑状态
  const [pendingFiles, setPendingFiles] = useState<PendingReviewFile[]>([])
  const [expandedFileId, setExpandedFileId] = useState<number | null>(null)
  const [editingStates, setEditingStates] = useState<EditingState>({})

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/login')
      return
    }
    loadData()
  }, [])

  useEffect(() => {
    if (visitId) {
      // 根据 visit_id 反推出 subject_id 和 visit_type
      const visit = visits.find(v => v.id === parseInt(visitId))
      if (visit) {
        setSelectedVisitType(visit.visit_name)
        setSelectedSubjectId(visit.subject_id.toString())
        setSelectedVisitId(visitId)
        loadSummary(parseInt(visitId))
      }
    }
  }, [visitId, visits])

  const loadData = async () => {
    try {
      setLoading(true)
      const [visitsData, subjectsData, templatesData] = await Promise.all([
        visitsApi.list(),
        subjectsApi.list(),
        templatesApi.list(),
      ])
      setVisits(visitsData)
      setSubjects(subjectsData)
      setTemplates(templatesData)
    } catch (error) {
      toast.error('加载失败')
    } finally {
      setLoading(false)
    }
  }

  const loadSummary = async (id: number) => {
    try {
      const data = await assessmentsApi.getVisitSummary(id)
      setSummary(data)
      // 使用后端返回的 pending_files
      setPendingFiles((data as any).pending_files || [])
    } catch (error) {
      toast.error('加载随访详情失败')
    }
  }

  // 不再需要 loadPendingFiles，因为后端已经返回

  const getSelectedVisit = () => {
    if (!selectedVisitId) return null
    const visit = visits.find(v => v.id === parseInt(selectedVisitId))
    if (!visit) return null

    const subject = subjects.find(s => s.id === parseInt(visit.subject_id.toString()))
    return { visit, subject }
  }

  const getVisitTypeSubjects = (visitType: string) => {
    if (!visitType) return []
    // 获取该随访类型下的所有随访记录
    const typeVisits = visits.filter(v => v.visit_name === visitType)
    // 返回对应的受试者信息（去重）
    const subjectIds = new Set(typeVisits.map(v => v.subject_id))
    return subjects.filter(s => subjectIds.has(s.id))
  }

  const getSubjectVisitByType = (subjectId: string, visitType: string) => {
    if (!subjectId || !visitType) return null
    return visits.find(v => v.subject_id === parseInt(subjectId) && v.visit_name === visitType)
  }

  const handleInputChange = (fieldName: string, value: string | number | boolean) => {
    setFormData(prev => ({ ...prev, [fieldName]: value }))
  }

  const handleSubmit = async () => {
    const selected = getSelectedVisit()
    if (!selected || !selectedTemplate) {
      toast.error('请选择随访记录和检测类型')
      return
    }

    const template = templates.find(t => t.template_name === selectedTemplate)
    if (!template) return

    // Validate required fields
    for (const field of template.fields) {
      if (field.required && (formData[field.field_name] === undefined || formData[field.field_name] === '')) {
        toast.error(`请填写必填项：${field.field_label}`)
        return
      }
    }

    try {
      await apiRequest('/assessments/manual', {
        method: 'POST',
        body: JSON.stringify({
          visit_id: parseInt(selectedVisitId),
          assessment_type: selectedTemplate,
          extracted_data: formData,
          sample_time: sampleTime || undefined,
        }),
      })

      toast.success('数据保存成功')
      setFormData({})
      setSampleTime('')
      // 刷新当前随访的摘要
      if (visitId) {
        loadSummary(parseInt(visitId))
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存失败')
    }
  }

  const handleVerify = async (assessmentId: number) => {
    setVerifying(assessmentId)
    try {
      await assessmentsApi.update(assessmentId, { is_verified: true })
      toast.success('已确认入库')
      if (visitId) {
        loadSummary(parseInt(visitId))
        loadPendingFiles(parseInt(visitId))
      }
    } catch (error) {
      toast.error('操作失败')
    } finally {
      setVerifying(null)
    }
  }

  // 处理待审核文件的编辑和确认
  const handleExpandFile = (fileId: number, fileType: string, aiData: Record<string, any>) => {
    // 展开/收起文件编辑区域
    if (expandedFileId === fileId) {
      setExpandedFileId(null)
    } else {
      // 展开时初始化编辑状态
      const template = templates.find(t => t.template_name === fileType)
      const initialData: Record<string, any> = {}

      // 先填充模板字段
      if (template) {
        template.fields.forEach(field => {
          initialData[field.field_name] = aiData[field.field_name] ?? null
        })
      }

      // 保留 AI 提取的其他字段
      Object.keys(aiData).forEach(key => {
        if (!initialData.hasOwnProperty(key)) {
          initialData[key] = aiData[key]
        }
      })

      setEditingStates(prev => ({
        ...prev,
        [fileId]: {
          data: initialData,
          sampleTime: aiData.test_date || aiData.sample_time || ''
        }
      }))
      setExpandedFileId(fileId)
    }
  }

  const handleEditInputChange = (fileId: number, fieldName: string, value: string | number | null) => {
    setEditingStates(prev => {
      const currentState = prev[fileId] || { data: {}, sampleTime: '' }
      return {
        ...prev,
        [fileId]: {
          ...currentState,
          data: {
            ...currentState.data,
            [fieldName]: value
          }
        }
      }
    })
  }

  const handleSampleTimeChange = (fileId: number, value: string) => {
    setEditingStates(prev => {
      const currentState = prev[fileId] || { data: {}, sampleTime: '' }
      return {
        ...prev,
        [fileId]: {
          ...currentState,
          sampleTime: value
        }
      }
    })
  }

  const handleConfirmFile = async (fileId: number, fileTypeId: string) => {
    try {
      const state = editingStates[fileId]
      if (!state) {
        toast.error('编辑状态未初始化')
        return
      }

      // 过滤掉 null 值，但要保留 0
      const cleanedData: Record<string, any> = {}
      Object.entries(state.data).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          cleanedData[key] = value
        }
      })

      const token = localStorage.getItem('token')
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'}/files/${fileId}/confirm`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ai_extracted_data: {
              ...cleanedData,
              sample_time: state.sampleTime || undefined
            }
          }),
        }
      )

      if (!response.ok) {
        const error = await response.json().catch(() => null)
        throw new Error(error?.detail || '确认失败')
      }

      const result = await response.json()
      toast.success(`数据已确认入库 (ID: ${result.assessment_id})`)
      setExpandedFileId(null)
      setEditingStates(prev => {
        const newState = { ...prev }
        delete newState[fileId]
        return newState
      })
      if (visitId) {
        loadSummary(parseInt(visitId))
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '确认失败')
    }
  }

  const handleDelete = async (assessmentId: number) => {
    if (!confirm('确定要删除这条数据吗？此操作不可恢复。')) return

    try {
      await apiRequest(`/assessments/${assessmentId}`, { method: 'DELETE' })
      toast.success('删除成功')
      if (visitId) {
        loadSummary(parseInt(visitId))
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '删除失败')
    }
  }

  const handleLogout = () => {
    authApi.logout()
    router.push('/')
    toast.success('已退出登录')
  }

  const selectedVisitInfo = getSelectedVisit()
  const renderExtractedData = (data: Record<string, unknown>) => {
    return Object.entries(data).map(([key, value]) => (
      <div key={key} className="grid grid-cols-2 gap-2 py-2 border-b last:border-0">
        <span className="text-gray-600 font-medium">{key}</span>
        <span className="font-mono">{String(value)}</span>
      </div>
    ))
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p>加载中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="container mx-auto px-4 py-8">
        {/* 顶部：访视选择 - 先选择随访类型，再选择受试者 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="md:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>选择随访记录</CardTitle>
                <CardDescription>按随访阶段分组，同一阶段多条记录会合并</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="visit-type-select">随访类型</Label>
                  <select
                    id="visit-type-select"
                    value={selectedVisitType}
                    onChange={(e) => {
                      setSelectedVisitType(e.target.value)
                      setSelectedSubjectId('')
                      setSelectedVisitId('')
                      setFormData({})
                      // 自动选择该随访类型下的第一个受试者
                      const typeSubjects = getVisitTypeSubjects(e.target.value)
                      if (typeSubjects.length > 0) {
                        const firstSubject = typeSubjects[0]
                        setSelectedSubjectId(firstSubject.id.toString())
                        const visit = getSubjectVisitByType(firstSubject.id.toString(), e.target.value)
                        if (visit) {
                          setSelectedVisitId(visit.id.toString())
                          router.push(`/enter?visit_id=${visit.id}`)
                        }
                      }
                    }}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">选择随访类型</option>
                    <option value="Baseline">Baseline (基线)</option>
                    <option value="V1">V1 (1 月)</option>
                    <option value="V3">V3 (3 月)</option>
                    <option value="V6">V6 (6 月)</option>
                    <option value="V12">V12 (12 月)</option>
                    <option value="Other">Other (其他)</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subject-select">受试者</Label>
                  <select
                    id="subject-select"
                    value={selectedSubjectId}
                    onChange={(e) => {
                      setSelectedSubjectId(e.target.value)
                      setFormData({})
                      const visit = getSubjectVisitByType(e.target.value, selectedVisitType)
                      if (visit) {
                        setSelectedVisitId(visit.id.toString())
                        router.push(`/enter?visit_id=${visit.id}`)
                      }
                    }}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    disabled={!selectedVisitType}
                  >
                    <option value="">选择受试者</option>
                    {getVisitTypeSubjects(selectedVisitType).map((subject) => (
                      <option key={subject.id} value={subject.id}>
                        {subject.subject_code} - {subject.name_pinyin}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedVisitInfo && (
                  <div className="p-3 bg-blue-50 rounded-md">
                    <p className="text-sm font-medium">{selectedVisitInfo.subject?.name_pinyin}</p>
                    <p className="text-xs text-gray-500">{selectedVisitInfo.subject?.subject_code}</p>
                    <p className="text-xs text-gray-500">{selectedVisitInfo.visit.visit_name}</p>
                    <p className="text-xs text-gray-500">{selectedVisitInfo.visit.visit_date.split('T')[0]}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* 右侧：审核和数据录入 */}
          <div className="md:col-span-2 space-y-6">
            {/* 待审核文件列表 */}
            {pendingFiles.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>待审核数据</CardTitle>
                  <CardDescription>
                    AI 已自动提取以下数据，请核对并补充采样时间后确认入库
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {pendingFiles.map((file) => {
                    const isExpanded = expandedFileId === file.id
                    const template = templates.find(t => t.template_name === file.file_type)
                    const fields = template?.fields || []
                    const state = editingStates[file.id] || {
                      data: {},
                      sampleTime: ''
                    }

                    return (
                      <Card key={file.id} className="bg-blue-50 border-blue-200">
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <CardTitle className="text-lg">{file.file_type}</CardTitle>
                              <CardDescription>
                                {file.original_filename}
                              </CardDescription>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                                待审核
                              </span>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleExpandFile(file.id, file.file_type, file.ai_extracted_data as Record<string, any>)}
                              >
                                {isExpanded ? '收起' : '展开'}
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        {isExpanded && (
                          <CardContent className="space-y-4">
                            {/* 采样时间 */}
                            <div className="grid gap-2">
                              <Label htmlFor={`${file.id}-sample-time`}>采样时间</Label>
                              <Input
                                id={`${file.id}-sample-time`}
                                type="datetime-local"
                                value={state.sampleTime ? String(state.sampleTime).replace(' ', 'T') : ''}
                                onChange={(e) => handleSampleTimeChange(file.id, e.target.value)}
                              />
                            </div>

                            {/* 数据字段 */}
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 bg-white p-4 rounded border">
                              {fields.length > 0 ? (
                                fields.sort((a, b) => a.sort_order - b.sort_order).map((field) => (
                                  <div key={field.field_name} className="space-y-1">
                                    <Label htmlFor={`${file.id}-${field.field_name}`} className="text-xs">
                                      {field.field_label}
                                      {field.required && <span className="text-red-500">*</span>}
                                      {field.unit && <span className="text-gray-500 text-xs">({field.unit})</span>}
                                    </Label>
                                    <Input
                                      id={`${file.id}-${field.field_name}`}
                                      type={field.field_type === 'number' ? 'number' : 'text'}
                                      step={field.field_type === 'number' ? '0.01' : undefined}
                                      value={state.data[field.field_name] === null || state.data[field.field_name] === undefined || state.data[field.field_name] === '' ? '' : state.data[field.field_name]}
                                      onChange={(e) => {
                                        if (field.field_type === 'number') {
                                          const val = e.target.value === '' ? null : parseFloat(e.target.value)
                                          handleEditInputChange(file.id, field.field_name, isNaN(val as number) ? null : val)
                                        } else {
                                          handleEditInputChange(file.id, field.field_name, e.target.value)
                                        }
                                      }}
                                    />
                                  </div>
                                ))
                              ) : (
                                Object.entries(state.data).map(([key, value]) => (
                                  <div key={key} className="space-y-1">
                                    <Label className="text-xs capitalize">{key}</Label>
                                    <Input
                                      type="text"
                                      value={value === null || value === undefined ? '' : String(value)}
                                      onChange={(e) => handleEditInputChange(file.id, key, e.target.value)}
                                    />
                                  </div>
                                ))
                              )}
                            </div>

                            <div className="flex gap-2 pt-2">
                              <Button
                                size="sm"
                                onClick={() => handleConfirmFile(file.id, file.file_type)}
                              >
                                确认入库
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setExpandedFileId(null)
                                  setEditingStates(prev => {
                                    const newState = { ...prev }
                                    delete newState[file.id]
                                    return newState
                                  })
                                }}
                              >
                                取消
                              </Button>
                            </div>
                          </CardContent>
                        )}
                        {!isExpanded && (
                          <CardContent>
                            <div className="bg-white p-4 rounded border">
                              {fields.length > 0 ? (
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                  {fields.sort((a, b) => a.sort_order - b.sort_order).map((field) => {
                                    const value = (file.ai_extracted_data as Record<string, any>)?.[field.field_name]
                                    return (
                                      <div key={field.field_name}>
                                        <div className="text-xs text-gray-500">{field.field_label}</div>
                                        <div className="font-mono text-sm">
                                          {value === null || value === undefined || value === '' ? '-' : String(value)}
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              ) : (
                                <pre className="text-xs overflow-auto max-h-40">
                                  {JSON.stringify(file.ai_extracted_data, null, 2)}
                                </pre>
                              )}
                            </div>
                            <div className="mt-4 flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleExpandFile(file.id, file.file_type, file.ai_extracted_data as Record<string, any>)}
                              >
                                编辑
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleConfirmFile(file.id, file.file_type)}
                              >
                                确认入库
                              </Button>
                            </div>
                          </CardContent>
                        )}
                      </Card>
                    )
                  })}
                </CardContent>
              </Card>
            )}

            {/* 审核部分 */}
            {summary && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>数据审核</CardTitle>
                      <CardDescription>
                        {summary.subject.subject_code} - {summary.subject.name_pinyin}
                      </CardDescription>
                    </div>
                    <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                      {summary.visit.visit_name}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {summary.assessments.length === 0 ? (
                    <p className="text-center text-gray-500 py-4">暂无已录入的数据</p>
                  ) : (
                    summary.assessments.map((assessment) => (
                      <Card key={assessment.id} className={assessment.is_verified ? 'bg-green-50' : 'bg-yellow-50'}>
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <div>
                              <CardTitle className="text-lg">{assessment.assessment_type}</CardTitle>
                              <CardDescription>
                                {assessment.is_verified ? (
                                  <span className="text-green-600">已审核</span>
                                ) : (
                                  <span className="text-yellow-600">待审核</span>
                                )}
                                {assessment.sample_time && (
                                  <span className="ml-2 text-gray-500">
                                    采样：{assessment.sample_time.replace('T', ' ')}
                                  </span>
                                )}
                              </CardDescription>
                            </div>
                            <div className="flex gap-2">
                              {!assessment.is_verified && (
                                <Button
                                  size="sm"
                                  onClick={() => handleVerify(assessment.id)}
                                  disabled={verifying === assessment.id}
                                >
                                  {verifying === assessment.id ? '处理中...' : '确认入库'}
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleDelete(assessment.id)}
                              >
                                删除
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="bg-white rounded-lg p-4 border">
                            {renderExtractedData(assessment.extracted_data)}
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </CardContent>
              </Card>
            )}

            {/* 手动录入部分 */}
            <Card>
              <CardHeader>
                <CardTitle>手动录入数据</CardTitle>
                <CardDescription>填写检测指标或补充数据</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!selectedVisitInfo ? (
                  <p className="text-center text-gray-500 py-4">请先选择随访记录</p>
                ) : (
                  <>
                    <div className="grid gap-2">
                      <Label htmlFor="template-select">检测类型</Label>
                      <select
                        id="template-select"
                        value={selectedTemplate}
                        onChange={(e) => {
                          setSelectedTemplate(e.target.value)
                          setFormData({})
                        }}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        <option value="">选择检测类型</option>
                        {templates.map((template) => (
                          <option key={template.id} value={template.template_name}>
                            {template.display_name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {selectedTemplate && (
                      <>
                        <div className="grid gap-2">
                          <Label htmlFor="sample_time">采样时间</Label>
                          <Input
                            id="sample_time"
                            type="datetime-local"
                            value={sampleTime}
                            onChange={(e) => setSampleTime(e.target.value)}
                          />
                        </div>

                        {templates
                          .find(t => t.template_name === selectedTemplate)
                          ?.fields.sort((a, b) => a.sort_order - b.sort_order)
                          .map((field) => (
                            <div key={field.field_name} className="grid gap-2">
                              <Label htmlFor={field.field_name}>
                                {field.field_label}
                                {field.required && <span className="text-red-500 ml-1">*</span>}
                                {field.unit && <span className="text-gray-500 ml-2">({field.unit})</span>}
                              </Label>
                              {field.field_type === 'text' ? (
                                <Input
                                  id={field.field_name}
                                  value={formData[field.field_name] || ''}
                                  onChange={(e) => handleInputChange(field.field_name, e.target.value)}
                                  placeholder={`请输入${field.field_label}`}
                                />
                              ) : (
                                <Input
                                  id={field.field_name}
                                  type="number"
                                  step="0.01"
                                  value={formData[field.field_name] || ''}
                                  onChange={(e) => handleInputChange(field.field_name, parseFloat(e.target.value) || 0)}
                                  placeholder={`请输入${field.field_label}`}
                                  min={field.min_value}
                                  max={field.max_value}
                                />
                              )}
                            </div>
                          ))}

                        <div className="flex gap-4 pt-4">
                          <Button onClick={handleSubmit} className="flex-1">
                            保存数据
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => setFormData({})}
                          >
                            重置
                          </Button>
                        </div>
                      </>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
