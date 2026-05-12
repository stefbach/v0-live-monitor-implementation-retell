// Retell AI Call Types

export type CallStatus = 'active' | 'completed' | 'failed' | 'no-answer' | 'busy'
export type CallDirection = 'inbound' | 'outbound'

export interface TranscriptSegment {
  id: string
  speaker: 'agent' | 'user'
  text: string
  startTime: number // seconds
  endTime: number // seconds
}

export interface CallLog {
  id: string
  callId: string
  agentId: string
  agentName: string
  status: CallStatus
  direction: CallDirection
  duration: number // seconds
  startTime: string // ISO date
  endTime: string | null // ISO date
  fromNumber: string
  toNumber: string
  userId?: string
  userName?: string
  sentiment?: 'positive' | 'neutral' | 'negative'
  transcript?: TranscriptSegment[]
  recordingUrl?: string
  summary?: string
  metadata?: Record<string, unknown>
}

export interface ActiveCall {
  id: string
  callId: string
  agentId: string
  agentName: string
  direction: CallDirection
  startTime: string
  fromNumber: string
  toNumber: string
  currentDuration: number // seconds, calculated
  status: 'active'
}

export interface CallMetrics {
  totalCalls: number
  successfulCalls: number
  failedCalls: number
  noAnswerCalls: number
  busyCalls: number
  successRate: number
  averageDuration: number
  totalDuration: number
  activeCalls: number
}

export interface HourlyCallData {
  hour: string // "00:00", "01:00", etc.
  calls: number
  successful: number
  failed: number
}

export interface DailyCallData {
  date: string // "Mon", "Tue", etc. or full date
  calls: number
  successful: number
  failed: number
  avgDuration: number
}

export interface DurationBucket {
  range: string // "0-30s", "30-60s", etc.
  count: number
}

export interface HeatmapCell {
  day: number // 0-6 (Sunday-Saturday)
  hour: number // 0-23
  value: number // call count
}

export type TimeRange = 'hourly' | 'daily' | 'weekly' | 'monthly'

export interface ApiResponse<T> {
  data: T
  error?: string
  timestamp: string
}

export interface RetellHealthStatus {
  status: 'healthy' | 'degraded' | 'down'
  apiKeyConfigured: boolean
  lastCheck: string
  message?: string
}
