import { apiRequest } from './api'
import type { AssessmentTemplate } from '@/types'

export const templatesApi = {
  list: async (): Promise<AssessmentTemplate[]> => {
    return apiRequest<AssessmentTemplate[]>('/templates/')
  },

  get: async (id: number): Promise<AssessmentTemplate> => {
    return apiRequest<AssessmentTemplate>(`/templates/${id}`)
  },
}
