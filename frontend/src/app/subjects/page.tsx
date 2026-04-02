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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Header } from '@/components/header'
import { subjectsApi } from '@/lib/subjects'
import { visitsApi } from '@/lib/visits'
import type { Subject, Visit } from '@/types'
import { toast } from 'sonner'
import { authApi } from '@/lib/auth'
import { useRouter } from 'next/navigation'

export default function SubjectsPage() {
  const router = useRouter()
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null)
  const [formData, setFormData] = useState({
    subject_code: '',
    name_pinyin: '',
    gender: '男',
    birth_date: '',
    enrollment_date: '',
    notes: '',
  })

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/login')
      return
    }
    loadSubjects()
  }, [])

  const loadSubjects = async () => {
    try {
      setLoading(true)
      const data = await subjectsApi.list(search || undefined)
      setSubjects(data)
    } catch (error) {
      toast.error('加载失败')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    try {
      if (editingSubject) {
        await subjectsApi.update(editingSubject.id, formData)
        toast.success('更新成功')
      } else {
        await subjectsApi.create(formData)
        toast.success('创建成功')
      }
      setDialogOpen(false)
      loadSubjects()
      resetForm()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '操作失败')
    }
  }

  const handleEdit = (subject: Subject) => {
    setEditingSubject(subject)
    setFormData({
      subject_code: subject.subject_code,
      name_pinyin: subject.name_pinyin,
      gender: subject.gender,
      birth_date: subject.birth_date.split('T')[0],
      enrollment_date: subject.enrollment_date?.split('T')[0] || '',
      notes: subject.notes || '',
    })
    setDialogOpen(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这个受试者吗？')) return

    try {
      await subjectsApi.delete(id)
      toast.success('删除成功')
      loadSubjects()
    } catch (error) {
      toast.error('删除失败')
    }
  }

  const resetForm = () => {
    setFormData({
      subject_code: '',
      name_pinyin: '',
      gender: '男',
      birth_date: '',
      enrollment_date: '',
      notes: '',
    })
    setEditingSubject(null)
  }

  const handleLogout = () => {
    authApi.logout()
    router.push('/')
    toast.success('已退出登录')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <Header />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Input
              placeholder="搜索受试者编号或姓名..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64"
              onKeyPress={(e) => e.key === 'Enter' && loadSubjects()}
            />
            <Button onClick={loadSubjects}>搜索</Button>
          </div>
          <Button onClick={() => { resetForm(); setDialogOpen(true) }}>
            新建受试者
          </Button>
        </div>

        <div className="bg-white rounded-lg shadow">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>编号</TableHead>
                <TableHead>姓名拼音</TableHead>
                <TableHead>性别</TableHead>
                <TableHead>出生日期</TableHead>
                <TableHead>入组日期</TableHead>
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
              ) : subjects.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    暂无数据
                  </TableCell>
                </TableRow>
              ) : (
                subjects.map((subject) => (
                  <TableRow key={subject.id}>
                    <TableCell className="font-medium">{subject.subject_code}</TableCell>
                    <TableCell>{subject.name_pinyin}</TableCell>
                    <TableCell>{subject.gender}</TableCell>
                    <TableCell>{subject.birth_date.split('T')[0]}</TableCell>
                    <TableCell>{subject.enrollment_date?.split('T')[0] || '-'}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(subject)}
                        >
                          编辑
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(subject.id)}
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

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingSubject ? '编辑受试者' : '新建受试者'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="subject_code">受试者编号</Label>
              <Input
                id="subject_code"
                value={formData.subject_code}
                onChange={(e) => setFormData({ ...formData, subject_code: e.target.value })}
                disabled={!!editingSubject}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="name_pinyin">姓名拼音</Label>
              <Input
                id="name_pinyin"
                value={formData.name_pinyin}
                onChange={(e) => setFormData({ ...formData, name_pinyin: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="gender">性别</Label>
              <select
                id="gender"
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="男">男</option>
                <option value="女">女</option>
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="birth_date">出生日期</Label>
              <Input
                id="birth_date"
                type="date"
                value={formData.birth_date}
                onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="enrollment_date">入组日期</Label>
              <Input
                id="enrollment_date"
                type="date"
                value={formData.enrollment_date}
                onChange={(e) => setFormData({ ...formData, enrollment_date: e.target.value })}
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
            <Button onClick={handleSubmit}>
              {editingSubject ? '保存' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
