import { apiRequest } from './api'
import type { AssessmentTemplate } from '@/types'

export const templatesApi = {
  list: async (studyId: number): Promise<AssessmentTemplate[]> => {
    return apiRequest<AssessmentTemplate[]>(`/templates/?study_id=${studyId}`)
  },

  get: async (id: number): Promise<AssessmentTemplate> => {
    return apiRequest<AssessmentTemplate>(`/templates/${id}`)
  },

  create: async (studyId: number, data: {
    template_name: string
    display_name: string
    description?: string
    fields: Array<{
      field_name: string
      field_label: string
      field_type: string
      unit?: string
      sort_order?: number
      required?: boolean
      min_value?: number
      max_value?: number
    }>
  }): Promise<AssessmentTemplate> => {
    return apiRequest<AssessmentTemplate>(`/templates/?study_id=${studyId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  update: async (id: number, data: {
    display_name?: string
    description?: string
    is_active?: boolean
    fields?: Array<{
      field_name: string
      field_label: string
      field_type: string
      unit?: string
      sort_order?: number
      required?: boolean
      min_value?: number
      max_value?: number
    }>
  }): Promise<AssessmentTemplate> => {
    return apiRequest<AssessmentTemplate>(`/templates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },

  delete: async (id: number): Promise<void> => {
    return apiRequest<void>(`/templates/${id}`, {
      method: 'DELETE',
    })
  },
}
