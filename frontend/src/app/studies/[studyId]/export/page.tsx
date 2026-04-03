'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { subjectsApi } from '@/lib/subjects'
import { visitsApi } from '@/lib/visits'
import type { Subject, Visit } from '@/types'

const ASSESSMENT_TYPES = [
  { value: 'EndoPAT', label: 'EndoPAT' },
  { value: 'TCD', label: 'TCD' },
  { value: 'Vicorder', label: 'Vicorder' },
  { value: 'BloodTest', label: '血检' },
  { value: 'CGM', label: 'CGM' },
  { value: 'Wearable', label: '可穿戴设备' },
]

export default function StudyExportPage() {
  const params = useParams()
  const studyId = parseInt(params.studyId as string)

  const [subjects, setSubjects] = useState<Subject[]>([])
  const [visits, setVisits] = useState<Visit[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  // 筛选条件
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([])
  const [selectedVisitTypes, setSelectedVisitTypes] = useState<string[]>([])
  const [selectedAssessmentTypes, setSelectedAssessmentTypes] = useState<string[]>([])

  useEffect(() => {
    loadData()
  }, [studyId])

  const loadData = async () => {
    try {
      setLoading(true)
      const [subjectsData, visitsData] = await Promise.all([
        subjectsApi.list(studyId),
        visitsApi.list(studyId),
      ])
      setSubjects(subjectsData)
      setVisits(visitsData)
    } catch (error) {
      toast.error('加载失败')
    } finally {
      setLoading(false)
    }
  }

  const visitTypes = [...new Set(visits.map(v => v.visit_name))]

  const handleExportCSV = async () => {
    await doExport('csv')
  }

  const handleExportExcel = async () => {
    await doExport('excel')
  }

  const doExport = async (format: 'csv' | 'excel') => {
    if (selectedSubjects.length === 0 && selectedVisitTypes.length === 0 && selectedAssessmentTypes.length === 0) {
      if (!confirm('未设置任何筛选条件，将导出全部数据。确定继续？')) {
        return
      }
    }

    setExporting(true)

    try {
      const params = new URLSearchParams({
        study_id: studyId.toString(),
      })

      if (selectedSubjects.length > 0) {
        params.append('subject_codes', selectedSubjects.join(','))
      }
      if (selectedVisitTypes.length > 0) {
        params.append('visit_names', selectedVisitTypes.join(','))
      }
      if (selectedAssessmentTypes.length > 0) {
        params.append('assessment_types', selectedAssessmentTypes.join(','))
      }

      const endpoint = format === 'csv' ? 'csv' : 'excel'
      const url = `/api/v1/export/${endpoint}?${params.toString()}`

      const response = await fetch(url)
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || '导出失败')
      }

      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
      a.download = `cohort_export_${studyId}_${timestamp}.${format === 'csv' ? 'csv' : 'xlsx'}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(downloadUrl)

      toast.success('导出成功')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '导出失败')
    } finally {
      setExporting(false)
    }
  }

  const handleSelectAllSubjects = () => {
    if (selectedSubjects.length === subjects.length) {
      setSelectedSubjects([])
    } else {
      setSelectedSubjects(subjects.map(s => s.subject_code))
    }
  }

  const handleSelectAllVisitTypes = () => {
    if (selectedVisitTypes.length === visitTypes.length) {
      setSelectedVisitTypes([])
    } else {
      setSelectedVisitTypes(visitTypes)
    }
  }

  const handleSelectAllAssessmentTypes = () => {
    if (selectedAssessmentTypes.length === ASSESSMENT_TYPES.length) {
      setSelectedAssessmentTypes([])
    } else {
      setSelectedAssessmentTypes(ASSESSMENT_TYPES.map(t => t.value))
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">数据导出</h1>
          <p className="text-sm text-gray-500 mt-1">研究 ID: {studyId}</p>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>筛选条件</CardTitle>
              <CardDescription>选择要导出的数据范围（不选表示导出全部）</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>受试者</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSelectAllSubjects}
                    disabled={subjects.length === 0}
                  >
                    {selectedSubjects.length === subjects.length && subjects.length > 0 ? '取消全选' : '全选'}
                  </Button>
                </div>
                <div className="max-h-32 overflow-y-auto border rounded-md p-2 space-y-1">
                  {subjects.length === 0 ? (
                    <p className="text-sm text-gray-500 py-2">暂无受试者</p>
                  ) : (
                    subjects.map((s) => (
                      <label
                        key={s.id}
                        className="flex items-center gap-2 cursor-pointer hover:bg-accent p-1 rounded"
                      >
                        <input
                          type="checkbox"
                          checked={selectedSubjects.includes(s.subject_code)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedSubjects([...selectedSubjects, s.subject_code])
                            } else {
                              setSelectedSubjects(selectedSubjects.filter(c => c !== s.subject_code))
                            }
                          }}
                          className="h-4 w-4"
                        />
                        <span className="text-sm">{s.subject_code} - {s.name_pinyin}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>随访类型</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSelectAllVisitTypes}
                    disabled={visitTypes.length === 0}
                  >
                    {selectedVisitTypes.length === visitTypes.length && visitTypes.length > 0 ? '取消全选' : '全选'}
                  </Button>
                </div>
                <div className="max-h-32 overflow-y-auto border rounded-md p-2 space-y-1">
                  {visitTypes.length === 0 ? (
                    <p className="text-sm text-gray-500 py-2">暂无随访类型</p>
                  ) : (
                    visitTypes.map((vt) => (
                      <label
                        key={vt}
                        className="flex items-center gap-2 cursor-pointer hover:bg-accent p-1 rounded"
                      >
                        <input
                          type="checkbox"
                          checked={selectedVisitTypes.includes(vt)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedVisitTypes([...selectedVisitTypes, vt])
                            } else {
                              setSelectedVisitTypes(selectedVisitTypes.filter(t => t !== vt))
                            }
                          }}
                          className="h-4 w-4"
                        />
                        <span className="text-sm">{vt}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>检测类型</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSelectAllAssessmentTypes}
                  >
                    {selectedAssessmentTypes.length === ASSESSMENT_TYPES.length ? '取消全选' : '全选'}
                  </Button>
                </div>
                <div className="max-h-32 overflow-y-auto border rounded-md p-2 space-y-1">
                  {ASSESSMENT_TYPES.map((t) => (
                    <label
                      key={t.value}
                      className="flex items-center gap-2 cursor-pointer hover:bg-accent p-1 rounded"
                    >
                      <input
                        type="checkbox"
                        checked={selectedAssessmentTypes.includes(t.value)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedAssessmentTypes([...selectedAssessmentTypes, t.value])
                          } else {
                            setSelectedAssessmentTypes(selectedAssessmentTypes.filter(v => v !== t.value))
                          }
                        }}
                        className="h-4 w-4"
                      />
                      <span className="text-sm">{t.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>导出格式</CardTitle>
              <CardDescription>选择导出文件格式</CardDescription>
            </CardHeader>
            <CardContent className="flex gap-4">
              <Button
                onClick={handleExportCSV}
                disabled={exporting || loading}
                className="flex-1"
              >
                导出 CSV
              </Button>
              <Button
                onClick={handleExportExcel}
                disabled={exporting || loading}
                variant="secondary"
                className="flex-1"
              >
                导出 Excel
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
