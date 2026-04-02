'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Header } from '@/components/header'
import { visitsApi } from '@/lib/visits'
import { subjectsApi } from '@/lib/subjects'
import type { Visit, Subject } from '@/types'
import { toast } from 'sonner'
import { authApi } from '@/lib/auth'
import { useRouter } from 'next/navigation'

export default function VisitsPage() {
  const router = useRouter()
  const [visits, setVisits] = useState<Visit[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [batchDialogOpen, setBatchDialogOpen] = useState(false)
  const [selectedSubjects, setSelectedSubjects] = useState<number[]>([])
  const [batchFormData, setBatchFormData] = useState({
    visit_name: 'Baseline',
    visit_date: '',
    notes: '',
  })
  const [formData, setFormData] = useState({
    subject_id: '',
    visit_name: 'Baseline',
    visit_date: '',
    notes: '',
  })

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
      const [visitsData, subjectsData] = await Promise.all([
        visitsApi.list(),
        subjectsApi.list(),
      ])
      setVisits(visitsData)
      setSubjects(subjectsData)
    } catch (error) {
      toast.error('加载失败')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    try {
      await visitsApi.create({
        subject_id: parseInt(formData.subject_id),
        visit_name: formData.visit_name,
        visit_date: formData.visit_date,
        notes: formData.notes,
      })
      toast.success('创建成功')
      setDialogOpen(false)
      loadData()
      setFormData({ subject_id: '', visit_name: 'Baseline', visit_date: '', notes: '' })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '操作失败')
    }
  }

  const handleBatchSubmit = async () => {
    if (selectedSubjects.length === 0) {
      toast.error('请至少选择一个受试者')
      return
    }

    try {
      const result = await visitsApi.batchCreate({
        subject_ids: selectedSubjects,
        visit_name: batchFormData.visit_name,
        visit_date: batchFormData.visit_date,
        notes: batchFormData.notes,
      })

      if (result.created.length > 0) {
        toast.success(`成功创建 ${result.created.length} 条随访记录`)
      }
      if (result.failed.length > 0) {
        toast.warning(`创建失败 ${result.failed.length} 条：${result.failed.map(f => f.reason).join(', ')}`)
      }

      setBatchDialogOpen(false)
      setSelectedSubjects([])
      loadData()
      setBatchFormData({ visit_name: 'Baseline', visit_date: '', notes: '' })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '操作失败')
    }
  }

  const handleSelectSubject = (subjectId: number) => {
    setSelectedSubjects(prev =>
      prev.includes(subjectId)
        ? prev.filter(id => id !== subjectId)
        : [...prev, subjectId]
    )
  }

  const handleSelectAll = () => {
    if (selectedSubjects.length === subjects.length) {
      setSelectedSubjects([])
    } else {
      setSelectedSubjects(subjects.map(s => s.id))
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这个随访记录吗？')) return

    try {
      await visitsApi.delete(id)
      toast.success('删除成功')
      loadData()
    } catch (error) {
      toast.error('删除失败')
    }
  }

  const handleLogout = () => {
    authApi.logout()
    router.push('/')
    toast.success('已退出登录')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">随访记录管理</h2>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setBatchDialogOpen(true)}>
              批量创建
            </Button>
            <Button onClick={() => setDialogOpen(true)}>
              新建随访
            </Button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>受试者编号</TableHead>
                <TableHead>姓名</TableHead>
                <TableHead>随访类型</TableHead>
                <TableHead>随访日期</TableHead>
                <TableHead>文件数</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    加载中...
                  </TableCell>
                </TableRow>
              ) : visits.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    暂无数据
                  </TableCell>
                </TableRow>
              ) : (
                visits.map((visit) => (
                  <TableRow key={visit.id}>
                    <TableCell className="font-medium">{visit.subject_code}</TableCell>
                    <TableCell>{visit.subject_code}</TableCell>
                    <TableCell>
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">
                        {visit.visit_name}
                      </span>
                    </TableCell>
                    <TableCell>{visit.visit_date.split('T')[0]}</TableCell>
                    <TableCell>{visit.file_count || 0}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Link href={`/upload?visit_id=${visit.id}`}>
                          <Button variant="ghost" size="sm">上传</Button>
                        </Link>
                        <Link href={`/review?visit_id=${visit.id}`}>
                          <Button variant="ghost" size="sm">审核</Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(visit.id)}
                        >
                          删除
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </main>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建随访记录</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="subject_id">受试者</Label>
              <select
                id="subject_id"
                value={formData.subject_id}
                onChange={(e) => setFormData({ ...formData, subject_id: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">选择受试者</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.subject_code} - {s.name_pinyin}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="visit_name">随访类型</Label>
              <select
                id="visit_name"
                value={formData.visit_name}
                onChange={(e) => setFormData({ ...formData, visit_name: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="Baseline">Baseline (基线)</option>
                <option value="V1">V1 (1 月)</option>
                <option value="V3">V3 (3 月)</option>
                <option value="V6">V6 (6 月)</option>
                <option value="V12">V12 (12 月)</option>
                <option value="Other">Other (其他)</option>
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="visit_date">随访日期</Label>
              <Input
                id="visit_date"
                type="date"
                value={formData.visit_date}
                onChange={(e) => setFormData({ ...formData, visit_date: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notes">备注</Label>
              <Input
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSubmit}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={batchDialogOpen} onOpenChange={setBatchDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>批量创建随访记录</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>选择受试者（已选 {selectedSubjects.length} 人）</Label>
              <div className="max-h-48 overflow-y-auto border rounded-md p-2 space-y-2">
                <div className="flex items-center gap-2 p-2 hover:bg-accent cursor-pointer" onClick={handleSelectAll}>
                  <input
                    type="checkbox"
                    checked={selectedSubjects.length === subjects.length && subjects.length > 0}
                    onChange={() => {}}
                    className="h-4 w-4"
                  />
                  <span className="text-sm font-medium">全选（{subjects.length} 人）</span>
                </div>
                {subjects.map((s) => (
                  <div
                    key={s.id}
                    className={`flex items-center gap-2 p-2 rounded cursor-pointer ${
                      selectedSubjects.includes(s.id) ? 'bg-primary/10' : 'hover:bg-accent'
                    }`}
                    onClick={() => handleSelectSubject(s.id)}
                  >
                    <input
                      type="checkbox"
                      checked={selectedSubjects.includes(s.id)}
                      onChange={() => {}}
                      className="h-4 w-4"
                    />
                    <span className="text-sm">{s.subject_code} - {s.name_pinyin}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="batch_visit_name">随访类型</Label>
              <select
                id="batch_visit_name"
                value={batchFormData.visit_name}
                onChange={(e) => setBatchFormData({ ...batchFormData, visit_name: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="Baseline">Baseline (基线)</option>
                <option value="V1">V1 (1 月)</option>
                <option value="V3">V3 (3 月)</option>
                <option value="V6">V6 (6 月)</option>
                <option value="V12">V12 (12 月)</option>
                <option value="Other">Other (其他)</option>
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="batch_visit_date">随访日期</Label>
              <Input
                id="batch_visit_date"
                type="date"
                value={batchFormData.visit_date}
                onChange={(e) => setBatchFormData({ ...batchFormData, visit_date: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="batch_notes">备注</Label>
              <Input
                id="batch_notes"
                value={batchFormData.notes}
                onChange={(e) => setBatchFormData({ ...batchFormData, notes: e.target.value })}
                placeholder="可选"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleBatchSubmit} disabled={selectedSubjects.length === 0}>
              批量创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
