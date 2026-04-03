import { apiRequest } from './api'

export interface Study {
  id: number
  name: string
  code: string
  description: string
  visit_types: Record<string, string>
  is_active: boolean
  created_at: string
  updated_at: string
  subject_count?: number
  member_count?: number
}

export interface StudyMember {
  id: number
  study_id: number
  user_id: number
  role: string
  created_at: string
  user?: {
    id: number
    username: string
    email: string
    role: string
  }
}

export const studiesApi = {
  // 获取我的研究列表
  listMy: async (): Promise<Study[]> => {
    return apiRequest('/studies/my')
  },

  // 获取所有研究（管理员）
  list: async (): Promise<Study[]> => {
    return apiRequest('/studies/')
  },

  // 获取研究详情
  get: async (studyId: number): Promise<Study> => {
    return apiRequest(`/studies/${studyId}`)
  },

  // 创建研究
  create: async (data: {
    name: string
    code: string
    description?: string
    visit_types?: Record<string, string>
  }): Promise<Study> => {
    return apiRequest('/studies/', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  // 更新研究
  update: async (studyId: number, data: Partial<Study>): Promise<Study> => {
    return apiRequest(`/studies/${studyId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },

  // 删除研究（停用）
  delete: async (studyId: number): Promise<void> => {
    return apiRequest(`/studies/${studyId}`, {
      method: 'DELETE',
    })
  },

  // 获取研究成员列表
  listMembers: async (studyId: number): Promise<StudyMember[]> => {
    return apiRequest(`/studies/${studyId}/members`)
  },

  // 添加研究成员
  addMember: async (studyId: number, userId: number, role: string): Promise<StudyMember> => {
    return apiRequest(`/studies/${studyId}/members`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, role }),
    })
  },

  // 更新研究成员角色
  updateMember: async (studyId: number, userId: number, role: string): Promise<StudyMember> => {
    return apiRequest(`/studies/${studyId}/members/${userId}`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    })
  },

  // 移除研究成员
  removeMember: async (studyId: number, userId: number): Promise<void> => {
    return apiRequest(`/studies/${studyId}/members/${userId}`, {
      method: 'DELETE',
    })
  },
}
