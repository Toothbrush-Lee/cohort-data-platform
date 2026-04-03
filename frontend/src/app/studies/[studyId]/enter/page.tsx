'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { templatesApi } from '@/lib/templates'
import { assessmentsApi, filesApi } from '@/lib/files'
import { visitsApi } from '@/lib/visits'
import { subjectsApi } from '@/lib/subjects'
import { apiRequest } from '@/lib/api'
import { toast } from 'sonner'
import type { AssessmentTemplate, Visit, Subject } from '@/types'

interface PendingReviewFile {
  id: number
  file_type: string
  original_filename: string
  ai_extracted_data: Record<string, unknown>
  status: string
  uploaded_at: string
  visit_id: number
}

interface AssessmentData {
  id: number
  visit_id: number
  assessment_type: string
  extracted_data: Record<string, unknown>
  is_verified: boolean
  sample_time?: string
  created_at?: string
}

interface VisitSummary {
  visit: { id: number; visit_name: string; visit_date: string }
  subject: { id: number; subject_code: string; name_pinyin: string; gender: string }
  assessments: AssessmentData[]
}

interface EditingState {
  [fileId: number]: {
    data: Record<string, any>
    sampleTime: string
  }
}

export default function StudyEnterPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const studyId = parseInt(params.studyId as string)
  const visitIdFromUrl = searchParams.get('visit_id')

  const [templates, setTemplates] = useState<AssessmentTemplate[]>([])
  const [visits, setVisits] = useState<Visit[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [summary, setSummary] = useState<VisitSummary | null>(null)
  const [pendingFiles, setPendingFiles] = useState<PendingReviewFile[]>([])

  const [selectedVisitType, setSelectedVisitType] = useState<string>('')
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('')
  const [selectedVisitId, setSelectedVisitId] = useState<string>('')
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  const [sampleTime, setSampleTime] = useState<string>('')
  const [formData, setFormData] = useState<Record<string, any>>({})

  const [loading, setLoading] = useState(true)
  const [verifying, setVerifying] = useState<number | null>(null)

  const [expandedFileId, setExpandedFileId] = useState<number | null>(null)
  const [editingStates, setEditingStates] = useState<EditingState>({})

  // Cleanup editing states on unmount
  useEffect(() => {
    return () => setEditingStates({})
  }, [])

  // 加载模板、随访和受试者列表
  useEffect(() => {
    loadData()
  }, [studyId])

  // 当 URL 中有 visit_id 时，加载该随访的详情
  useEffect(() => {
    if (visitIdFromUrl && selectedVisitId !== visitIdFromUrl) {
      setSelectedVisitId(visitIdFromUrl)
      const visitId = parseInt(visitIdFromUrl)
      // Load summary and pending files in parallel
      Promise.all([
        loadVisitSummary(visitId),
        loadPendingFiles(visitId)
      ])
    }
  }, [visitIdFromUrl])

  const loadData = async () => {
    try {
      setLoading(true)
      const [templatesData, visitsData, subjectsData] = await Promise.all([
        templatesApi.list(studyId),
        visitsApi.list(studyId),
        subjectsApi.list(studyId),
      ])
      setTemplates(templatesData)
      setVisits(visitsData)
      setSubjects(subjectsData)
    } catch (error) {
      toast.error('加载失败')
    } finally {
      setLoading(false)
    }
  }

  const loadVisitSummary = async (id: number) => {
    try {
      const data = await assessmentsApi.getVisitSummary(id)
      setSummary(data)
    } catch (error) {
      console.error('Failed to load visit summary:', error)
    }
  }

  const loadPendingFiles = async (visitId: number) => {
    try {
      const files = await apiRequest(`/files/?study_id=${studyId}&visit_id=${visitId}&status=pending_review`)
      // 只保留有 AI 提取数据的文件
      const filesWithAI = files.filter((f: PendingReviewFile) => f.ai_extracted_data && Object.keys(f.ai_extracted_data).length > 0)
      setPendingFiles(filesWithAI)
    } catch (error) {
      console.error('Failed to load pending files:', error)
    }
  }

  const getVisitTypeSubjects = (visitType: string): Subject[] => {
    if (!visitType) return []
    const typeVisits = visits.filter(v => v.visit_name === visitType)
    const subjectIds = new Set(typeVisits.map(v => v.subject_id))
    return subjects.filter(s => subjectIds.has(s.id))
  }

  const getSubjectVisitByType = (subjectId: string, visitType: string): Visit | null => {
    if (!subjectId || !visitType) return null
    return visits.find(v => v.subject_id === parseInt(subjectId) && v.visit_name === visitType) || null
  }

  const handleVisitTypeChange = (visitType: string) => {
    setSelectedVisitType(visitType)
    setSelectedSubjectId('')
    setSelectedVisitId('')
    setSummary(null)
    setPendingFiles([])
    setFormData({})

    const typeSubjects = getVisitTypeSubjects(visitType)
    if (typeSubjects.length > 0) {
      const firstSubject = typeSubjects[0]
      setSelectedSubjectId(firstSubject.id.toString())
      const visit = getSubjectVisitByType(firstSubject.id.toString(), visitType)
      if (visit) {
        setSelectedVisitId(visit.id.toString())
        router.push(`/studies/${studyId}/enter?visit_id=${visit.id}`)
      }
    }
  }

  const handleSubjectChange = (subjectId: string) => {
    setSelectedSubjectId(subjectId)
    setFormData({})
    const visit = getSubjectVisitByType(subjectId, selectedVisitType)
    if (visit) {
      setSelectedVisitId(visit.id.toString())
      router.push(`/studies/${studyId}/enter?visit_id=${visit.id}`)
    }
  }

  const handleInputChange = (fieldName: string, value: any) => {
    setFormData(prev => ({ ...prev, [fieldName]: value }))
  }

  const handleSubmit = async () => {
    const currentVisitId = summary?.visit?.id || parseInt(selectedVisitId)
    if (!currentVisitId || !selectedTemplate) {
      toast.error('请选择随访记录和检测类型')
      return
    }

    const template = templates.find(t => t.template_name === selectedTemplate)
    if (!template) return

    // 验证必填字段
    for (const field of template.fields) {
      if (field.required && (formData[field.field_name] === undefined || formData[field.field_name] === '' || formData[field.field_name] === null)) {
        toast.error(`请填写必填项：${field.field_label}`)
        return
      }
    }

    try {
      await apiRequest('/assessments/manual', {
        method: 'POST',
        body: JSON.stringify({
          visit_id: currentVisitId,
          assessment_type: selectedTemplate,
          extracted_data: formData,
          sample_time: sampleTime || undefined,
        }),
      })

      toast.success('数据保存成功')
      setFormData({})
      setSampleTime('')
      setSelectedTemplate('')
      loadVisitSummary(currentVisitId)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存失败')
    }
  }

  const handleVerify = async (assessmentId: number) => {
    setVerifying(assessmentId)
    try {
      await assessmentsApi.update(assessmentId, { is_verified: true })
      toast.success('已确认入库')
      const visitIdNum = summary?.visit?.id
      if (visitIdNum) {
        loadVisitSummary(visitIdNum)
      }
    } catch (error) {
      toast.error('操作失败')
    } finally {
      setVerifying(null)
    }
  }

  const handleDelete = async (assessmentId: number) => {
    if (!confirm('确定要删除这条数据吗？此操作不可恢复。')) return

    try {
      await apiRequest(`/assessments/${assessmentId}`, { method: 'DELETE' })
      toast.success('删除成功')
      const visitIdNum = summary?.visit?.id
      if (visitIdNum) {
        loadVisitSummary(visitIdNum)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '删除失败')
    }
  }

  const handleExpandFile = (fileId: number, fileType: string, aiData: Record<string, any>) => {
    if (expandedFileId === fileId) {
      setExpandedFileId(null)
    } else {
      const template = templates.find(t => t.template_name === fileType)
      const initialData: Record<string, any> = {}

      if (template) {
        template.fields.forEach(field => {
          const value = aiData[field.field_name]
          if (field.field_type === 'number' && value !== undefined && value !== null && value !== '') {
            initialData[field.field_name] = parseFloat(value)
          } else {
            initialData[field.field_name] = value ?? null
          }
        })
      }

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

  const handleEditInputChange = (fileId: number, fieldName: string, value: any) => {
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
      const visitIdNum = summary?.visit?.id
      if (visitIdNum) {
        loadVisitSummary(visitIdNum)
        loadPendingFiles(visitIdNum)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '确认失败')
    }
  }

  const validateValue = (fieldName: string, value: number, template: AssessmentTemplate | undefined): string | null => {
    const field = template?.fields.find(f => f.field_name === fieldName)
    if (!field) return null

    if (field.min_value !== undefined && value < field.min_value) {
      return `低于最小值 ${field.min_value}${field.unit || ''}`
    }
    if (field.max_value !== undefined && value > field.max_value) {
      return `高于最大值 ${field.max_value}${field.unit || ''}`
    }
    return null
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">录入与审核</h1>
          <p className="text-sm text-gray-500">研究 ID: {studyId}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>选择随访记录</CardTitle>
                <CardDescription>先选择随访类型，再选择受试者</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="visit-type-select">随访类型</Label>
                  <select
                    id="visit-type-select"
                    value={selectedVisitType}
                    onChange={(e) => handleVisitTypeChange(e.target.value)}
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
                    onChange={(e) => handleSubjectChange(e.target.value)}
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
              </CardContent>
            </Card>
          </div>

          {/* 右侧：待审核、已录入、手动录入 */}
          <div className="lg:col-span-3 space-y-6">
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
                    const state = editingStates[file.id] || { data: {}, sampleTime: '' }

                    return (
                      <Card key={file.id} className="bg-blue-50 border-blue-200">
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <CardTitle className="text-lg">{file.file_type}</CardTitle>
                              <CardDescription>{file.original_filename}</CardDescription>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm">待审核</span>
                              <Button size="sm" variant="outline" onClick={() => handleExpandFile(file.id, file.file_type, file.ai_extracted_data as Record<string, any>)}>
                                {isExpanded ? '收起' : '展开'}
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        {isExpanded && (
                          <CardContent className="space-y-4">
                            <div className="grid gap-2">
                              <Label htmlFor={`${file.id}-sample-time`}>采样时间</Label>
                              <Input
                                id={`${file.id}-sample-time`}
                                type="datetime-local"
                                value={state.sampleTime ? String(state.sampleTime).replace(' ', 'T') : ''}
                                onChange={(e) => handleSampleTimeChange(file.id, e.target.value)}
                              />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 bg-white p-4 rounded border">
                              {fields.length > 0 ? (
                                fields.sort((a, b) => a.sort_order - b.sort_order).map((field) => {
                                  const value = state.data[field.field_name]
                                  const warning = field.field_type === 'number' && value !== null && value !== undefined && value !== ''
                                    ? validateValue(field.field_name, parseFloat(value), template)
                                    : null

                                  return (
                                    <div key={field.field_name} className="space-y-1">
                                      <Label htmlFor={`${file.id}-${field.field_name}`} className="text-xs">
                                        {field.field_label}
                                        {field.required && <span className="text-red-500">*</span>}
                                        {field.unit && <span className="text-gray-500 text-xs">({field.unit})</span>}
                                      </Label>
                                      <div className="relative">
                                        <Input
                                          id={`${file.id}-${field.field_name}`}
                                          type={field.field_type === 'number' ? 'number' : 'text'}
                                          step={field.field_type === 'number' ? '0.01' : undefined}
                                          value={value === null || value === undefined || value === '' ? '' : value}
                                          onChange={(e) => {
                                            if (field.field_type === 'number') {
                                              const val = e.target.value === '' ? null : parseFloat(e.target.value)
                                              handleEditInputChange(file.id, field.field_name, isNaN(val) ? null : val)
                                            } else {
                                              handleEditInputChange(file.id, field.field_name, e.target.value)
                                            }
                                          }}
                                          className={warning ? 'border-yellow-500' : ''}
                                        />
                                        {warning && (
                                          <p className="text-xs text-yellow-600 mt-1">{warning}</p>
                                        )}
                                      </div>
                                    </div>
                                  )
                                })
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
                              <Button size="sm" onClick={() => handleConfirmFile(file.id, file.file_type)}>
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
                                    const displayValue = value === null || value === undefined || value === '' ? '-' : String(value)
                                    return (
                                      <div key={field.field_name}>
                                        <div className="text-xs text-gray-500">{field.field_label}</div>
                                        <div className="font-mono text-sm">{displayValue}{field.unit ? ` ${field.unit}` : ''}</div>
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
                              <Button size="sm" onClick={() => handleExpandFile(file.id, file.file_type, file.ai_extracted_data as Record<string, any>)}>
                                编辑
                              </Button>
                              <Button size="sm" onClick={() => handleConfirmFile(file.id, file.file_type)}>
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

            {/* 已录入数据审核 */}
            {summary && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>已录入数据</CardTitle>
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
                              <Button size="sm" variant="destructive" onClick={() => handleDelete(assessment.id)}>
                                删除
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="bg-white rounded-lg p-4 border">
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                              {Object.entries(assessment.extracted_data).map(([key, value]) => (
                                <div key={key}>
                                  <div className="text-xs text-gray-500 capitalize">{key}</div>
                                  <div className="font-mono text-sm">{String(value)}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </CardContent>
              </Card>
            )}

            {/* 手动录入数据 */}
            <Card>
              <CardHeader>
                <CardTitle>手动录入数据</CardTitle>
                <CardDescription>填写检测指标或补充数据</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!summary && !selectedVisitId ? (
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
                                  onChange={(e) => handleInputChange(field.field_name, e.target.value === '' ? null : parseFloat(e.target.value))}
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
                          <Button variant="outline" onClick={() => setFormData({})}>
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
      </div>
    </div>
  )
}
