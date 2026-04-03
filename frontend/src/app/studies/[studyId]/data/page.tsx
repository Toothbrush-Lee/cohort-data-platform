'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { assessmentsApi } from '@/lib/assessments'
import { subjectsApi } from '@/lib/subjects'
import { visitsApi } from '@/lib/visits'
import type { AssessmentData, Subject, Visit } from '@/types'

const ASSESSMENT_TYPE_LABELS: Record<string, string> = {
  EndoPAT: 'EndoPAT',
  TCD: 'TCD',
  Vicorder: 'Vicorder',
  BloodTest: '血检',
  CGM: 'CGM',
  Wearable: '可穿戴设备',
}

export default function StudyDataPage() {
  const router = useRouter()
  const params = useParams()
  const studyId = parseInt(params.studyId as string)

  const [assessments, setAssessments] = useState<AssessmentData[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [visits, setVisits] = useState<Visit[]>([])
  const [loading, setLoading] = useState(true)

  // 筛选条件
  const [visitTypeFilter, setVisitTypeFilter] = useState<string>('all')
  const [assessmentTypeFilter, setAssessmentTypeFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [subjectCodeFilter, setSubjectCodeFilter] = useState('')

  useEffect(() => {
    loadData()
  }, [studyId])

  const loadData = async () => {
    try {
      setLoading(true)
      const [assessmentsData, subjectsData, visitsData] = await Promise.all([
        assessmentsApi.list(studyId),
        subjectsApi.list(studyId),
        visitsApi.list(studyId),
      ])
      setAssessments(assessmentsData)
      setSubjects(subjectsData)
      setVisits(visitsData)
    } catch (error) {
      toast.error('加载失败')
    } finally {
      setLoading(false)
    }
  }

  const getSubjectByCode = (code: string) => subjects.find(s => s.subject_code === code)
  const getVisitById = (visitId: number) => visits.find(v => v.id === visitId)

  // 获取所有随访类型（去重）
  const visitTypes = [...new Set(visits.map(v => v.visit_name))]

  // 筛选数据
  const filteredAssessments = assessments.filter(a => {
    const visit = getVisitById(a.visit_id)
    const subject = getSubjectByCode(a.subject_code)

    if (visitTypeFilter !== 'all' && visit?.visit_name !== visitTypeFilter) return false
    if (assessmentTypeFilter !== 'all' && a.assessment_type !== assessmentTypeFilter) return false
    if (statusFilter !== 'all' && a.is_verified !== (statusFilter === 'verified')) return false
    if (subjectCodeFilter && !subject?.subject_code.toLowerCase().includes(subjectCodeFilter.toLowerCase()) &&
        !subject?.name_pinyin.toLowerCase().includes(subjectCodeFilter.toLowerCase())) return false

    return true
  })

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这条记录吗？此操作不可恢复。')) return

    try {
      await assessmentsApi.delete(id)
      toast.success('删除成功')
      loadData()
    } catch (error) {
      toast.error('删除失败')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">已录入数据</h1>
            <p className="text-sm text-gray-500 mt-1">研究 ID: {studyId}</p>
          </div>
          <Link href={`/studies/${studyId}/export`}>
            <Button>导出数据</Button>
          </Link>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>筛选条件</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">随访类型</label>
                <Select value={visitTypeFilter} onValueChange={setVisitTypeFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="全部" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    {visitTypes.map(vt => (
                      <SelectItem key={vt} value={vt}>{vt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">检测类型</label>
                <Select value={assessmentTypeFilter} onValueChange={setAssessmentTypeFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="全部" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    {Object.entries(ASSESSMENT_TYPE_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">状态</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="全部" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    <SelectItem value="verified">已审核</SelectItem>
                    <SelectItem value="unverified">未审核</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">搜索</label>
                <Input
                  placeholder="受试者编号或姓名"
                  value={subjectCodeFilter}
                  onChange={(e) => setSubjectCodeFilter(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>数据列表</CardTitle>
            <CardDescription>
              共 {filteredAssessments.length} 条记录（总计 {assessments.length} 条）
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-gray-500">加载中...</div>
            ) : filteredAssessments.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                暂无数据
                <div className="mt-2">
                  <Link href={`/studies/${studyId}/enter`}>
                    <Button variant="link">去录入数据</Button>
                  </Link>
                </div>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>受试者编号</TableHead>
                    <TableHead>姓名</TableHead>
                    <TableHead>随访类型</TableHead>
                    <TableHead>随访日期</TableHead>
                    <TableHead>检测类型</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>录入时间</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAssessments.map((assessment) => {
                    const visit = getVisitById(assessment.visit_id)
                    const subject = getSubjectByCode(assessment.subject_code)
                    return (
                      <TableRow key={assessment.id}>
                        <TableCell className="font-medium">{assessment.subject_code}</TableCell>
                        <TableCell>{subject?.name_pinyin || '-'}</TableCell>
                        <TableCell>{visit?.visit_name || '-'}</TableCell>
                        <TableCell>{visit?.visit_date ? visit.visit_date.split('T')[0] : '-'}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{ASSESSMENT_TYPE_LABELS[assessment.assessment_type] || assessment.assessment_type}</Badge>
                        </TableCell>
                        <TableCell>
                          {assessment.is_verified ? (
                            <Badge className="bg-green-100 text-green-800 hover:bg-green-100">已审核</Badge>
                          ) : (
                            <Badge variant="secondary">未审核</Badge>
                          )}
                        </TableCell>
                        <TableCell>{assessment.created_at ? new Date(assessment.created_at).toLocaleDateString('zh-CN') : '-'}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Link href={`/studies/${studyId}/enter?visit_id=${assessment.visit_id}&assessment_id=${assessment.id}`}>
                              <Button variant="ghost" size="sm">查看</Button>
                            </Link>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(assessment.id)}
                            >
                              删除
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
