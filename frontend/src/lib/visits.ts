import { apiRequest } from './api'
import type { Visit, VisitCreate } from '@/types'

export const visitsApi = {
  list: async (studyId: number, subjectId?: number): Promise<Visit[]> => {
    const params = subjectId ? `&subject_id=${subjectId}` : ''
    return apiRequest<Visit[]>(`/visits/?study_id=${studyId}${params}`)
  },

  get: async (id: number): Promise<Visit> => {
    return apiRequest<Visit>(`/visits/${id}`)
  },

  create: async (studyId: number, data: VisitCreate): Promise<Visit> => {
    return apiRequest<Visit>(`/visits/?study_id=${studyId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  batchCreate: async (studyId: number, data: {
    subject_ids: number[]
    visit_name: string
    visit_date: string
    notes?: string
  }): Promise<{ created: Visit[]; failed: { subject_id: number; reason: string }[] }> => {
    return apiRequest(`/visits/batch?study_id=${studyId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  update: async (id: number, data: Partial<VisitCreate>): Promise<Visit> => {
    return apiRequest<Visit>(`/visits/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },

  delete: async (id: number): Promise<void> => {
    return apiRequest<void>(`/visits/${id}`, {
      method: 'DELETE',
    })
  },
}
