// Defensive BMI handling for the bariatric-clinic context.
//
// leads_rdv.bmi contains garbage values (~7% of rows: 7200, 39200,
// 41666.7, 50000…) that we cannot reliably back-transform. We just
// validate the range and surface "Non renseigné" otherwise, with the
// raw value kept as a tooltip for audit.

const MIN_BMI = 10
const MAX_BMI = 80

export function isValidBmi(bmi: number | null | undefined): boolean {
  return (
    typeof bmi === 'number' &&
    Number.isFinite(bmi) &&
    bmi >= MIN_BMI &&
    bmi <= MAX_BMI
  )
}

export interface BmiDisplay {
  text: string // ready to render
  valid: boolean
  raw: number | null
  invalidReason?: 'null' | 'too_low' | 'too_high'
}

export function formatBmi(
  bmi: number | null | undefined,
  notSetLabel = 'Non renseigné'
): BmiDisplay {
  if (bmi == null) {
    return { text: notSetLabel, valid: false, raw: null, invalidReason: 'null' }
  }
  if (!Number.isFinite(bmi)) {
    return { text: notSetLabel, valid: false, raw: null, invalidReason: 'null' }
  }
  if (bmi < MIN_BMI) {
    return { text: notSetLabel, valid: false, raw: bmi, invalidReason: 'too_low' }
  }
  if (bmi > MAX_BMI) {
    return { text: notSetLabel, valid: false, raw: bmi, invalidReason: 'too_high' }
  }
  return { text: bmi.toFixed(1), valid: true, raw: bmi }
}

// For eligibility logic — clamp to null when out of range so the S2
// thresholds don't fire on garbage values.
export function bmiOrNull(bmi: number | null | undefined): number | null {
  return isValidBmi(bmi) ? (bmi as number) : null
}
