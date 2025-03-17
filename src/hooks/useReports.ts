import { useState, useCallback } from 'react'

interface Report {
  id: string
  name: string
  description: string
  lobName: string
}

export function useReports() {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null) // Add error state

  const fetchReports = useCallback(async (search: string = '') => {
    try {
      setLoading(true)
      setError(null) // Reset error state
      const queryParams = new URLSearchParams()
      if (search) {
        queryParams.append('search', search)
      }

      const response = await fetch(`/api/reports?${queryParams.toString()}`)
      if (!response.ok) throw new Error('Failed to fetch reports')
      const data = await response.json()
      setReports(data)
    } catch (error) {
      console.error('Error fetching reports:', error)
      setError('Unable to retrieve reports information at this time. Please try again later.')
      setReports([])
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    reports,
    loading,
    error, // Add error to the return object
    fetchReports
  }
}