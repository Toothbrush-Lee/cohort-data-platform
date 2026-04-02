import { apiRequest } from './api'
import type { RawFile, FileUploadResponse, AssessmentData } from '@/types'

export const filesApi = {
  list: async (params?: {
    visit_id?: number
    status?: string
    file_type?: string
  }): Promise<RawFile[]> => {
    const queryParams = new URLSearchParams()
    if (params?.visit_id) queryParams.append('visit_id', String(params.visit_id))
    if (params?.status) queryParams.append('status', params.status)
    if (params?.file_type) queryParams.append('file_type', params.file_type)

    const query = queryParams.toString()
    return apiRequest<RawFile[]>(`/files/${query ? `?${queryParams}` : ''}`)
  },

  get: async (id: number): Promise<RawFile> => {
    return apiRequest<RawFile>(`/files/${id}`)
  },

  upload: async (
    file: File,
    visitId: number,
    fileType?: string
  ): Promise<FileUploadResponse> => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('visit_id', String(visitId))
    if (fileType) {
      formData.append('file_type', fileType)
    }

    // 注意：上传文件时不设置 Content-Type，让浏览器自动设置
    const token = localStorage.getItem('token')
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'}/files/upload?visit_id=${visitId}${fileType ? `&file_type=${fileType}` : ''}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      }
    )

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: '上传失败' }))
      throw new Error(error.detail || '上传失败')
    }

    return response.json()
  },

  download: async (id: number): Promise<Blob> => {
    const token = localStorage.getItem('token')
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'}/files/${id}/download`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    )

    if (!response.ok) {
      throw new Error('下载失败')
    }

    return response.blob()
  },

  delete: async (id: number): Promise<void> => {
    return apiRequest<void>(`/files/${id}`, {
      method: 'DELETE',
    })
  },
}

export const assessmentsApi = {
  list: async (params?: {
    visit_id?: number
    assessment_type?: string
    is_verified?: boolean
  }): Promise<AssessmentData[]> => {
    const queryParams = new URLSearchParams()
    if (params?.visit_id) queryParams.append('visit_id', String(params.visit_id))
    if (params?.assessment_type) queryParams.append('assessment_type', params.assessment_type)
    if (params?.is_verified !== undefined) queryParams.append('is_verified', String(params.is_verified))

    const query = queryParams.toString()
    return apiRequest<AssessmentData[]>(`/assessments/${query ? `?${queryParams}` : ''}`)
  },

  get: async (id: number): Promise<AssessmentData> => {
    return apiRequest<AssessmentData>(`/assessments/${id}`)
  },

  update: async (id: number, data: Partial<AssessmentData>): Promise<AssessmentData> => {
    return apiRequest<AssessmentData>(`/assessments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },

  getVisitSummary: async (visitId: number): Promise<{
    visit: { id: number; visit_name: string; visit_date: string }
    subject: { id: number; subject_code: string; name_pinyin: string; gender: string }
    assessments: Array<{
      id: number
      assessment_type: string
      extracted_data: Record<string, unknown>
      is_verified: boolean
      file_id?: number
    }>
  }> => {
    return apiRequest(`/assessments/visit/${visitId}/summary`)
  },
}
