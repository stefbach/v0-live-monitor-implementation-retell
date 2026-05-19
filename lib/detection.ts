// Heuristic detectors used across the dashboard.

const ROBOT_AWARENESS_PATTERNS: RegExp[] = [
  /\bare you a ro?bot\b/i,
  /\bis this an? ?ai\b/i,
  /\bis this a bot\b/i,
  /\bare you real\b/i,
  /\bare you (a )?human\b/i,
  /\bare you a (real )?person\b/i,
  /\breal person\b/i,
  /\bautomated\b/i,
  /\bis this automated\b/i,
  /\bare you a machine\b/i,
  /\bsuis-je en train de parler à (un )?robot\b/i,
  /\bc'est (un )?robot\b/i,
  /\bvous êtes (un )?robot\b/i,
]

// Returns true if the caller appears to have realised they're talking to an AI.
// Works on whatever text we have (full transcript when available, otherwise
// the call summary as a best-effort fallback).
export function detectRobotAwareness(text: string | null | undefined): boolean {
  if (!text) return false
  return ROBOT_AWARENESS_PATTERNS.some((p) => p.test(text))
}

// "Undetected voicemail": Retell did NOT flag a voicemail, yet the call was
// very short and the agent hung up — strong signal it actually hit a machine.
export function detectVoicemailSuspected(
  inVoicemail: boolean | null | undefined,
  durationSeconds: number,
  disconnectionReason: string | null | undefined
): boolean {
  if (inVoicemail) return false
  return durationSeconds < 15 && disconnectionReason === 'agent_hangup'
}

// Abnormally short connected call (< 10s) — used for the Live "jaune" alert.
export function isAbnormallyShort(durationSeconds: number): boolean {
  return durationSeconds > 0 && durationSeconds < 10
}
