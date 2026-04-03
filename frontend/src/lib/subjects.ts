import { apiRequest } from './api'
import type { Subject, SubjectCreate } from '@/types'

export const subjectsApi = {
  list: async (studyId: number, search?: string): Promise<Subject[]> => {
    const params = search ? `?search=${encodeURIComponent(search)}` : ''
    return apiRequest<Subject[]>(`/subjects/?study_id=${studyId}${params}`)
  },

  get: async (id: number): Promise<Subject> => {
    return apiRequest<Subject>(`/subjects/${id}`)
  },

  create: async (studyId: number, data: SubjectCreate): Promise<Subject> => {
    return apiRequest<Subject>(`/subjects/?study_id=${studyId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  update: async (id: number, data: Partial<SubjectCreate>): Promise<Subject> => {
    return apiRequest<Subject>(`/subjects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },

  delete: async (id: number): Promise<void> => {
    return apiRequest<void>(`/subjects/${id}`, {
      method: 'DELETE',
    })
  },
}
