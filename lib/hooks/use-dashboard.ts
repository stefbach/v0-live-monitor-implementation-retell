'use client'

import useSWR from 'swr'
import type { DashboardError, DashboardAssignment } from '@/lib/dashboard'

const fetcher = async <T>(url: string): Promise<T> => {
  const res = await fetch(url)
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || `API error: ${res.status}`)
  return json.data as T
}

export function useDashboardErrors() {
  const { data, error, isLoading, mutate } = useSWR<DashboardError[]>(
    '/api/dashboard/errors',
    fetcher,
    { refreshInterval: 60000, revalidateOnFocus: true }
  )
  return {
    errors: data ?? [],
    isLoading,
    isError: error,
    refresh: mutate,
  }
}

export function useAssignments() {
  const { data, error, isLoading, mutate } = useSWR<DashboardAssignment[]>(
    '/api/dashboard/assignments',
    fetcher,
    { refreshInterval: 60000 }
  )
  return {
    assignments: data ?? [],
    isLoading,
    isError: error,
    refresh: mutate,
  }
}
