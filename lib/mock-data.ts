import type {
  CallLog,
  ActiveCall,
  CallMetrics,
  HourlyCallData,
  DailyCallData,
  DurationBucket,
  HeatmapCell,
  TranscriptSegment,
  CallStatus,
} from '@/lib/types'

// Seeded random for consistent mock data
function seededRandom(seed: number) {
  const x = Math.sin(seed++) * 10000
  return x - Math.floor(x)
}

const agentNames = [
  'Sales Assistant',
  'Support Agent',
  'Booking Agent',
  'Follow-up Agent',
  'Survey Agent',
]

const firstNames = ['John', 'Sarah', 'Mike', 'Emily', 'David', 'Lisa', 'James', 'Anna', 'Robert', 'Maria']
const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Wilson', 'Taylor']

function generatePhoneNumber(seed: number): string {
  const areaCode = 200 + Math.floor(seededRandom(seed) * 800)
  const exchange = 200 + Math.floor(seededRandom(seed + 1) * 800)
  const subscriber = 1000 + Math.floor(seededRandom(seed + 2) * 9000)
  return `+1${areaCode}${exchange}${subscriber}`
}

function generateTranscript(seed: number, duration: number): TranscriptSegment[] {
  const segments: TranscriptSegment[] = []
  const avgSegmentDuration = 8 // seconds
  const numSegments = Math.max(2, Math.floor(duration / avgSegmentDuration))
  
  const agentPhrases = [
    "Hello! Thank you for calling. How can I assist you today?",
    "I understand. Let me help you with that.",
    "Could you please provide me with your account number?",
    "Thank you for that information. I'm looking into it now.",
    "Is there anything else I can help you with?",
    "Great! I've updated your account accordingly.",
    "I'll send you a confirmation email shortly.",
    "Thank you for calling. Have a great day!",
  ]
  
  const userPhrases = [
    "Hi, I'm calling about my recent order.",
    "Yes, my account number is 12345.",
    "I'd like to schedule an appointment for next week.",
    "That would be great, thank you.",
    "Actually, I have one more question.",
    "No, that's all. Thanks for your help!",
    "Can you check the status of my delivery?",
    "Perfect, I appreciate your assistance.",
  ]
  
  let currentTime = 0
  for (let i = 0; i < numSegments; i++) {
    const speaker = i % 2 === 0 ? 'agent' : 'user'
    const phrases = speaker === 'agent' ? agentPhrases : userPhrases
    const phraseIndex = Math.floor(seededRandom(seed + i * 3) * phrases.length)
    const segmentDuration = 4 + seededRandom(seed + i * 5) * 10
    
    segments.push({
      id: `seg-${i}`,
      speaker,
      text: phrases[phraseIndex],
      startTime: currentTime,
      endTime: currentTime + segmentDuration,
    })
    
    currentTime += segmentDuration + seededRandom(seed + i * 7) * 2
  }
  
  return segments
}

function getStatusFromRandom(rand: number): CallStatus {
  if (rand < 0.65) return 'completed'
  if (rand < 0.80) return 'failed'
  if (rand < 0.92) return 'no-answer'
  return 'busy'
}

export function generateCallLogs(count: number = 800, baseSeed: number = 42): CallLog[] {
  const calls: CallLog[] = []
  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
  
  // Generate calls throughout the day with realistic distribution
  for (let i = 0; i < count; i++) {
    const seed = baseSeed + i
    const rand = seededRandom(seed)
    
    // Peak hours: 9-12 and 14-17
    let hourWeight = seededRandom(seed + 100)
    let hour: number
    if (hourWeight < 0.35) {
      hour = 9 + Math.floor(seededRandom(seed + 101) * 3) // 9-11
    } else if (hourWeight < 0.70) {
      hour = 14 + Math.floor(seededRandom(seed + 102) * 3) // 14-16
    } else if (hourWeight < 0.85) {
      hour = 8 + Math.floor(seededRandom(seed + 103) * 2) // 8-9 or early
    } else {
      hour = Math.floor(seededRandom(seed + 104) * 24) // any hour
    }
    
    const minute = Math.floor(seededRandom(seed + 200) * 60)
    const second = Math.floor(seededRandom(seed + 201) * 60)
    
    const callTime = new Date(startOfDay)
    callTime.setHours(hour, minute, second)
    
    // Only include calls that have already happened
    if (callTime > now) {
      callTime.setDate(callTime.getDate() - 1)
    }
    
    const status = getStatusFromRandom(seededRandom(seed + 300))
    const duration = status === 'completed' 
      ? 30 + Math.floor(seededRandom(seed + 400) * 270) // 30-300 seconds
      : status === 'failed'
        ? 5 + Math.floor(seededRandom(seed + 401) * 25) // 5-30 seconds
        : Math.floor(seededRandom(seed + 402) * 15) // 0-15 seconds
    
    const agentIndex = Math.floor(seededRandom(seed + 500) * agentNames.length)
    const firstNameIndex = Math.floor(seededRandom(seed + 600) * firstNames.length)
    const lastNameIndex = Math.floor(seededRandom(seed + 601) * lastNames.length)
    
    const endTime = new Date(callTime.getTime() + duration * 1000)
    
    const sentimentRand = seededRandom(seed + 700)
    const sentiment = status === 'completed'
      ? sentimentRand < 0.6 ? 'positive' : sentimentRand < 0.85 ? 'neutral' : 'negative'
      : undefined
    
    calls.push({
      id: `call-${i.toString().padStart(4, '0')}`,
      callId: `retell-${seed.toString(16).padStart(8, '0')}`,
      agentId: `agent-${agentIndex + 1}`,
      agentName: agentNames[agentIndex],
      status,
      direction: seededRandom(seed + 800) > 0.3 ? 'outbound' : 'inbound',
      duration,
      startTime: callTime.toISOString(),
      endTime: status !== 'active' ? endTime.toISOString() : null,
      fromNumber: generatePhoneNumber(seed + 900),
      toNumber: generatePhoneNumber(seed + 1000),
      userId: `user-${i}`,
      userName: `${firstNames[firstNameIndex]} ${lastNames[lastNameIndex]}`,
      sentiment,
      transcript: status === 'completed' ? generateTranscript(seed + 1100, duration) : undefined,
      recordingUrl: status === 'completed' 
        ? `https://example.com/recordings/${seed.toString(16)}.mp3`
        : undefined,
      summary: status === 'completed'
        ? 'Customer inquiry handled successfully. Follow-up scheduled if needed.'
        : undefined,
    })
  }
  
  // Sort by start time descending (most recent first)
  return calls.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
}

export function generateActiveCalls(count: number = 3, baseSeed: number = 999): ActiveCall[] {
  const calls: ActiveCall[] = []
  const now = new Date()
  
  for (let i = 0; i < count; i++) {
    const seed = baseSeed + i
    const agentIndex = Math.floor(seededRandom(seed) * agentNames.length)
    const startOffset = Math.floor(seededRandom(seed + 1) * 300) // 0-5 minutes ago
    const startTime = new Date(now.getTime() - startOffset * 1000)
    
    calls.push({
      id: `active-${i}`,
      callId: `retell-active-${seed.toString(16)}`,
      agentId: `agent-${agentIndex + 1}`,
      agentName: agentNames[agentIndex],
      direction: seededRandom(seed + 2) > 0.3 ? 'outbound' : 'inbound',
      startTime: startTime.toISOString(),
      fromNumber: generatePhoneNumber(seed + 3),
      toNumber: generatePhoneNumber(seed + 4),
      currentDuration: startOffset,
      status: 'active',
    })
  }
  
  return calls
}

export function calculateMetrics(calls: CallLog[]): CallMetrics {
  const completed = calls.filter(c => c.status === 'completed')
  const failed = calls.filter(c => c.status === 'failed')
  const noAnswer = calls.filter(c => c.status === 'no-answer')
  const busy = calls.filter(c => c.status === 'busy')
  
  const totalDuration = completed.reduce((sum, c) => sum + c.duration, 0)
  
  return {
    totalCalls: calls.length,
    successfulCalls: completed.length,
    failedCalls: failed.length,
    noAnswerCalls: noAnswer.length,
    busyCalls: busy.length,
    successRate: calls.length > 0 ? (completed.length / calls.length) * 100 : 0,
    averageDuration: completed.length > 0 ? totalDuration / completed.length : 0,
    totalDuration,
    activeCalls: 0, // Updated separately
  }
}

export function generateHourlyData(calls: CallLog[]): HourlyCallData[] {
  const hourlyMap = new Map<number, { calls: number; successful: number; failed: number }>()
  
  // Initialize all hours
  for (let h = 0; h < 24; h++) {
    hourlyMap.set(h, { calls: 0, successful: 0, failed: 0 })
  }
  
  calls.forEach(call => {
    const hour = new Date(call.startTime).getHours()
    const data = hourlyMap.get(hour)!
    data.calls++
    if (call.status === 'completed') data.successful++
    if (call.status === 'failed') data.failed++
  })
  
  return Array.from(hourlyMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([hour, data]) => ({
      hour: `${hour.toString().padStart(2, '0')}:00`,
      ...data,
    }))
}

export function generateDailyData(calls: CallLog[], days: number = 7): DailyCallData[] {
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const dailyMap = new Map<string, { calls: number; successful: number; failed: number; totalDuration: number }>()
  
  // Initialize last N days
  const now = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)
    const key = date.toISOString().split('T')[0]
    dailyMap.set(key, { calls: 0, successful: 0, failed: 0, totalDuration: 0 })
  }
  
  calls.forEach(call => {
    const key = call.startTime.split('T')[0]
    if (dailyMap.has(key)) {
      const data = dailyMap.get(key)!
      data.calls++
      if (call.status === 'completed') {
        data.successful++
        data.totalDuration += call.duration
      }
      if (call.status === 'failed') data.failed++
    }
  })
  
  return Array.from(dailyMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([dateStr, data]) => {
      const date = new Date(dateStr)
      return {
        date: dayNames[date.getDay()],
        calls: data.calls,
        successful: data.successful,
        failed: data.failed,
        avgDuration: data.successful > 0 ? data.totalDuration / data.successful : 0,
      }
    })
}

export function generateDurationBuckets(calls: CallLog[]): DurationBucket[] {
  const buckets = [
    { range: '0-30s', min: 0, max: 30, count: 0 },
    { range: '30-60s', min: 30, max: 60, count: 0 },
    { range: '1-2m', min: 60, max: 120, count: 0 },
    { range: '2-5m', min: 120, max: 300, count: 0 },
    { range: '5-10m', min: 300, max: 600, count: 0 },
    { range: '10m+', min: 600, max: Infinity, count: 0 },
  ]
  
  calls.filter(c => c.status === 'completed').forEach(call => {
    const bucket = buckets.find(b => call.duration >= b.min && call.duration < b.max)
    if (bucket) bucket.count++
  })
  
  return buckets.map(({ range, count }) => ({ range, count }))
}

export function generateHeatmapData(calls: CallLog[]): HeatmapCell[] {
  const heatmap: HeatmapCell[] = []
  const countMap = new Map<string, number>()
  
  // Initialize all cells
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      countMap.set(`${day}-${hour}`, 0)
    }
  }
  
  calls.forEach(call => {
    const date = new Date(call.startTime)
    const day = date.getDay()
    const hour = date.getHours()
    const key = `${day}-${hour}`
    countMap.set(key, (countMap.get(key) || 0) + 1)
  })
  
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      heatmap.push({
        day,
        hour,
        value: countMap.get(`${day}-${hour}`) || 0,
      })
    }
  }
  
  return heatmap
}

// Pre-generate mock data for consistent results
let cachedCallLogs: CallLog[] | null = null
let cachedActiveCalls: ActiveCall[] | null = null

export function getMockCallLogs(): CallLog[] {
  if (!cachedCallLogs) {
    cachedCallLogs = generateCallLogs(800)
  }
  return cachedCallLogs
}

export function getMockActiveCalls(): ActiveCall[] {
  // Don't cache active calls - they should update
  return generateActiveCalls(Math.floor(Math.random() * 4) + 1)
}

export function getMockCallById(id: string): CallLog | undefined {
  const calls = getMockCallLogs()
  return calls.find(c => c.id === id || c.callId === id)
}
