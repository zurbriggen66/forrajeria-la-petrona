import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type { CrmLead, CrmLeadInput, Paginated } from './types'

export function useLeads(estado?: string) {
  return useQuery({
    queryKey: ['crm-leads', estado],
    queryFn: async () => {
      const { data } = await api.get<Paginated<CrmLead>>('/crm/leads/', {
        params: { page_size: 100, ordering: '-created_at', ...(estado ? { estado } : {}) },
      })
      return data.results
    },
  })
}

export function useCreateLead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CrmLeadInput) => {
      const { data } = await api.post<CrmLead>('/crm/leads/', input)
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['crm-leads'] }),
  })
}

export function useUpdateLead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: Partial<CrmLeadInput> }) => {
      const { data } = await api.patch<CrmLead>(`/crm/leads/${id}/`, input)
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['crm-leads'] }),
  })
}
