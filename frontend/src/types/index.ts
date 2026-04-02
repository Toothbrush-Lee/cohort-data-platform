// 受试者
export interface Subject {
  id: number
  subject_code: string
  name_pinyin: string
  gender: string
  birth_date: string
  enrollment_date?: string
  notes?: string
  created_at: string
  updated_at: string
}

// 随访
export interface Visit {
  id: number
  subject_id: number
  subject_code: string
  visit_name: string
  visit_date: string
  notes?: string
  created_at: string
  file_count?: number
}

// 文件
export interface RawFile {
  id: number
  visit_id: number
  file_type: string
  original_filename: string
  stored_filename: string
  oss_url: string
  file_size?: number
  mime_type?: string
  status: string
  uploaded_by?: number
  verified_by?: number
  uploaded_at: string
  verified_at?: string
  ai_extracted_data?: Record<string, unknown>
}

// 检查数据
export interface AssessmentData {
  id: number
  visit_id: number
  file_id?: number
  assessment_type: string
  extracted_data: Record<string, unknown>
  is_verified: boolean
  verified_at?: string
  verified_by?: number
  created_at: string
  updated_at: string
}

// 用户
export interface User {
  id: number
  username: string
  email: string
  role: string
  is_active: boolean
  created_at: string
}

// 登录请求
export interface LoginRequest {
  username: string
  password: string
}

// Token 响应
export interface TokenResponse {
  access_token: string
  token_type: string
}

// 文件上传响应
export interface FileUploadResponse {
  file_id: number
  original_filename: string
  file_type: string
  status: string
  message: string
}

// 受试者创建
export interface SubjectCreate {
  subject_code: string
  name_pinyin: string
  gender: string
  birth_date: string
  enrollment_date?: string
  notes?: string
}

// 随访创建
export interface VisitCreate {
  subject_id: number
  visit_name: string
  visit_date: string
  notes?: string
}

// 检测模板
export interface TemplateField {
  id: number
  field_name: string
  field_label: string
  field_type: string
  unit?: string
  sort_order: number
  required: boolean
  min_value?: number
  max_value?: number
}

export interface AssessmentTemplate {
  id: number
  template_name: string
  display_name: string
  description?: string
  is_active: boolean
  fields: TemplateField[]
}
