'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { templatesApi } from '@/lib/templates'
import type { AssessmentTemplate, TemplateField } from '@/types'

interface FieldFormData {
  field_name: string
  field_label: string
  field_type: string
  unit: string
  required: boolean
  min_value: string
  max_value: string
  sort_order: number
}

export default function TemplateManagementPage() {
  const router = useRouter()
  const params = useParams()
  const studyId = parseInt(params.studyId as string)

  const [templates, setTemplates] = useState<AssessmentTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [fieldsDialogOpen, setFieldsDialogOpen] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<AssessmentTemplate | null>(null)

  const [newTemplateData, setNewTemplateData] = useState({
    template_name: '',
    display_name: '',
    description: '',
  })

  const [newFieldData, setNewFieldData] = useState<FieldFormData>({
    field_name: '',
    field_label: '',
    field_type: 'number',
    unit: '',
    required: true,
    min_value: '',
    max_value: '',
    sort_order: 0,
  })

  useEffect(() => {
    loadTemplates()
  }, [studyId])

  const loadTemplates = async () => {
    try {
      setLoading(true)
      const data = await templatesApi.list(studyId)
      setTemplates(data)
    } catch (error) {
      toast.error('加载模板失败')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateTemplate = async () => {
    try {
      await templatesApi.create(studyId, {
        template_name: newTemplateData.template_name,
        display_name: newTemplateData.display_name,
        description: newTemplateData.description,
        fields: getDefaultFields(newTemplateData.template_name),
      })
      toast.success('模板创建成功')
      setCreateDialogOpen(false)
      loadTemplates()
      setNewTemplateData({ template_name: '', display_name: '', description: '' })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '创建失败')
    }
  }

  const handleDeleteTemplate = async (id: number, name: string) => {
    if (!confirm(`确定要删除模板 "${name}" 吗？此操作不可恢复。`)) return

    try {
      await templatesApi.delete(id)
      toast.success('模板已删除')
      loadTemplates()
    } catch (error) {
      toast.error('删除失败')
    }
  }

  const handleToggleActive = async (template: AssessmentTemplate) => {
    try {
      await templatesApi.update(template.id, {
        is_active: !template.is_active,
      })
      toast.success(template.is_active ? '模板已禁用' : '模板已启用')
      loadTemplates()
    } catch (error) {
      toast.error('操作失败')
    }
  }

  const handleAddField = async () => {
    if (!selectedTemplate) return

    try {
      const fieldData = {
        ...newFieldData,
        sort_order: selectedTemplate.fields.length,
        min_value: newFieldData.min_value ? parseFloat(newFieldData.min_value) : undefined,
        max_value: newFieldData.max_value ? parseFloat(newFieldData.max_value) : undefined,
      }

      // 直接更新模板
      const updatedFields = [...selectedTemplate.fields, fieldData]
      await templatesApi.update(selectedTemplate.id, {
        fields: updatedFields.map(f => ({
          field_name: f.field_name,
          field_label: f.field_label,
          field_type: f.field_type,
          unit: f.unit,
          sort_order: f.sort_order,
          required: f.required,
          min_value: f.min_value,
          max_value: f.max_value,
        })),
      })

      toast.success('字段添加成功')
      setFieldsDialogOpen(false)
      loadTemplates()
      setNewFieldData({
        field_name: '',
        field_label: '',
        field_type: 'number',
        unit: '',
        required: true,
        min_value: '',
        max_value: '',
        sort_order: 0,
      })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '添加失败')
    }
  }

  const handleDeleteField = async (fieldId: number, fieldName: string) => {
    if (!selectedTemplate) return
    if (!confirm(`确定要删除字段 "${fieldName}" 吗？`)) return

    try {
      // 从模板中移除该字段
      const updatedFields = selectedTemplate.fields.filter(f => f.id !== fieldId)
      await templatesApi.update(selectedTemplate.id, {
        fields: updatedFields.map(f => ({
          field_name: f.field_name,
          field_label: f.field_label,
          field_type: f.field_type,
          unit: f.unit,
          sort_order: f.sort_order,
          required: f.required,
          min_value: f.min_value,
          max_value: f.max_value,
        })),
      })

      toast.success('字段已删除')
      setFieldsDialogOpen(false)
      loadTemplates()
    } catch (error) {
      toast.error('删除失败')
    }
  }

  const openFieldsDialog = (template: AssessmentTemplate) => {
    setSelectedTemplate(template)
    setFieldsDialogOpen(true)
  }

  const getDefaultFields = (templateName: string): TemplateField[] => {
    const defaultFields: Record<string, TemplateField[]> = {
      EndoPAT: [
        { field_name: 'rhi_value', field_label: 'RHI 值', field_type: 'number', unit: '', sort_order: 0, required: true },
        { field_name: 'ai_value', field_label: 'AI 值', field_type: 'number', unit: '%', sort_order: 1, required: true },
        { field_name: 'ai_at_75bpm', field_label: 'AI@75bpm', field_type: 'number', unit: '%', sort_order: 2, required: false },
        { field_name: 'heart_rate', field_label: '心率', field_type: 'number', unit: 'bpm', sort_order: 3, required: true },
        { field_name: 'systolic_bp', field_label: '收缩压', field_type: 'number', unit: 'mmHg', sort_order: 4, required: true },
        { field_name: 'diastolic_bp', field_label: '舒张压', field_type: 'number', unit: 'mmHg', sort_order: 5, required: true },
      ],
      TCD: [
        { field_name: 'vessel_name', field_label: '血管名称', field_type: 'text', unit: '', sort_order: 0, required: true },
        { field_name: 'vp', field_label: 'Vp (收缩峰流速)', field_type: 'number', unit: 'cm/s', sort_order: 1, required: true },
        { field_name: 'vm', field_label: 'Vm (平均流速)', field_type: 'number', unit: 'cm/s', sort_order: 2, required: true },
        { field_name: 'vd', field_label: 'Vd (舒张末期流速)', field_type: 'number', unit: 'cm/s', sort_order: 3, required: false },
        { field_name: 'pi', field_label: 'PI (搏动指数)', field_type: 'number', unit: '', sort_order: 4, required: true },
        { field_name: 'ri', field_label: 'RI (阻力指数)', field_type: 'number', unit: '', sort_order: 5, required: true },
      ],
      Vicorder: [
        { field_name: 'cf_pwv', field_label: 'cfPWV', field_type: 'number', unit: 'm/s', sort_order: 0, required: true },
        { field_name: 'systolic_bp', field_label: '收缩压', field_type: 'number', unit: 'mmHg', sort_order: 1, required: true },
        { field_name: 'diastolic_bp', field_label: '舒张压', field_type: 'number', unit: 'mmHg', sort_order: 2, required: true },
        { field_name: 'heart_rate', field_label: '心率', field_type: 'number', unit: 'bpm', sort_order: 3, required: true },
      ],
      BloodTest: [
        { field_name: 'test_date', field_label: '检测日期', field_type: 'text', unit: '', sort_order: 0, required: true },
        { field_name: 'glucose', field_label: '血糖', field_type: 'number', unit: 'mmol/L', sort_order: 1, required: false },
        { field_name: 'cholesterol', field_label: '总胆固醇', field_type: 'number', unit: 'mmol/L', sort_order: 2, required: false },
        { field_name: 'triglycerides', field_label: '甘油三酯', field_type: 'number', unit: 'mmol/L', sort_order: 3, required: false },
        { field_name: 'ldl', field_label: 'LDL-C', field_type: 'number', unit: 'mmol/L', sort_order: 4, required: false },
        { field_name: 'hdl', field_label: 'HDL-C', field_type: 'number', unit: 'mmol/L', sort_order: 5, required: false },
      ],
    }

    return defaultFields[templateName] || []
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">检测模板管理</h1>
            <p className="text-sm text-gray-500 mt-1">研究 ID: {studyId}</p>
          </div>
          <div className="flex gap-2">
            <Link href={`/studies/${studyId}`}>
              <Button variant="outline">返回研究</Button>
            </Link>
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>创建模板</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>创建检测模板</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="template_name">模板名称 (英文)</Label>
                    <Input
                      id="template_name"
                      value={newTemplateData.template_name}
                      onChange={(e) => setNewTemplateData({ ...newTemplateData, template_name: e.target.value })}
                      placeholder="例如：EndoPAT, TCD, Vicorder"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="display_name">显示名称</Label>
                    <Input
                      id="display_name"
                      value={newTemplateData.display_name}
                      onChange={(e) => setNewTemplateData({ ...newTemplateData, display_name: e.target.value })}
                      placeholder="例如：EndoPAT 检测"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="description">描述</Label>
                    <Input
                      id="description"
                      value={newTemplateData.description}
                      onChange={(e) => setNewTemplateData({ ...newTemplateData, description: e.target.value })}
                      placeholder="可选"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>取消</Button>
                  <Button onClick={handleCreateTemplate}>创建</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>模板列表</CardTitle>
            <CardDescription>管理检测模板及其字段配置</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-gray-500">加载中...</div>
            ) : templates.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                暂无模板
                <div className="mt-2">
                  <Button variant="link" onClick={() => setCreateDialogOpen(true)}>创建第一个模板</Button>
                </div>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>模板名称</TableHead>
                    <TableHead>显示名称</TableHead>
                    <TableHead>字段数量</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map((template) => (
                    <TableRow key={template.id}>
                      <TableCell className="font-medium">{template.template_name}</TableCell>
                      <TableCell>{template.display_name}</TableCell>
                      <TableCell>{template.fields.length}</TableCell>
                      <TableCell>
                        {template.is_active ? (
                          <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">已启用</span>
                        ) : (
                          <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-sm">已禁用</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openFieldsDialog(template)}
                          >
                            管理字段
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleActive(template)}
                          >
                            {template.is_active ? '禁用' : '启用'}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteTemplate(template.id, template.template_name)}
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

        {/* 字段管理对话框 */}
        <Dialog open={fieldsDialogOpen} onOpenChange={setFieldsDialogOpen}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>
                管理字段 - {selectedTemplate?.display_name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex gap-2">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button>添加字段</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>添加模板字段</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="field_name">字段名称 (英文)</Label>
                        <Input
                          id="field_name"
                          value={newFieldData.field_name}
                          onChange={(e) => setNewFieldData({ ...newFieldData, field_name: e.target.value })}
                          placeholder="例如：rhi_value"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="field_label">显示名称</Label>
                        <Input
                          id="field_label"
                          value={newFieldData.field_label}
                          onChange={(e) => setNewFieldData({ ...newFieldData, field_label: e.target.value })}
                          placeholder="例如：RHI 值"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="field_type">字段类型</Label>
                        <Select value={newFieldData.field_type} onValueChange={(v) => setNewFieldData({ ...newFieldData, field_type: v })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="number">数字</SelectItem>
                            <SelectItem value="text">文本</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="unit">单位</Label>
                        <Input
                          id="unit"
                          value={newFieldData.unit}
                          onChange={(e) => setNewFieldData({ ...newFieldData, unit: e.target.value })}
                          placeholder="可选，例如：mmHg"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="required"
                          checked={newFieldData.required}
                          onChange={(e) => setNewFieldData({ ...newFieldData, required: e.target.checked })}
                          className="h-4 w-4"
                        />
                        <Label htmlFor="required">必填项</Label>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="min_value">最小值</Label>
                          <Input
                            id="min_value"
                            type="number"
                            value={newFieldData.min_value}
                            onChange={(e) => setNewFieldData({ ...newFieldData, min_value: e.target.value })}
                            disabled={newFieldData.field_type === 'text'}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="max_value">最大值</Label>
                          <Input
                            id="max_value"
                            type="number"
                            value={newFieldData.max_value}
                            onChange={(e) => setNewFieldData({ ...newFieldData, max_value: e.target.value })}
                            disabled={newFieldData.field_type === 'text'}
                          />
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setNewFieldData({
                        field_name: '',
                        field_label: '',
                        field_type: 'number',
                        unit: '',
                        required: true,
                        min_value: '',
                        max_value: '',
                        sort_order: 0,
                      })}>重置</Button>
                      <Button onClick={handleAddField}>添加</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>排序</TableHead>
                    <TableHead>字段名称</TableHead>
                    <TableHead>显示名称</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead>单位</TableHead>
                    <TableHead>必填</TableHead>
                    <TableHead>范围</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedTemplate?.fields.sort((a, b) => a.sort_order - b.sort_order).map((field, index) => (
                    <TableRow key={field.id}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell className="font-medium">{field.field_name}</TableCell>
                      <TableCell>{field.field_label}</TableCell>
                      <TableCell>{field.field_type === 'number' ? '数字' : '文本'}</TableCell>
                      <TableCell>{field.unit || '-'}</TableCell>
                      <TableCell>{field.required ? '是' : '否'}</TableCell>
                      <TableCell>
                        {field.min_value !== undefined && field.max_value !== undefined
                          ? `${field.min_value} ~ ${field.max_value}`
                          : '-'}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteField(field.id, field.field_label)}
                        >
                          删除
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setFieldsDialogOpen(false)}>完成</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
