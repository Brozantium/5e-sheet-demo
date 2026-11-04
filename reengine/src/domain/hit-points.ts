export type HitDieSize = 6 | 8 | 10 | 12;
export type HitPointLevelMethod = "first-level" | "average" | "roll";
export interface HitPointLevelInput {
  characterLevel: number;
  classId: string;
  classLevel: number;
  hitDie: HitDieSize;
  method: HitPointLevelMethod;
  roll?: number;
}
export interface MaximumHitPointsInput {
  constitutionScore: number;
  levels: readonly HitPointLevelInput[];
  additionalHitPoints?: number;
}
export interface HitPointLevelCalculation {
  characterLevel: number;
  classId: string;
  classLevel: number;
  hitDie: HitDieSize;
  rollValue: number;
  constitutionModifier: number;
  gainedHitPoints: number;
}
export interface MaximumHitPointsResult {
  maximumHitPoints: number;
  constitutionModifier: number;
  additionalHitPoints: number;
  levels: HitPointLevelCalculation[];
}
export interface HitPointState {
  currentHitPoints: number;
  maximumHitPoints: number;
  temporaryHitPoints: number;
}
export interface HitPointDamageResult {
  state: HitPointState;
  damageAppliedToTemporaryHitPoints: number;
  damageAppliedToHitPoints: number;
  excessDamage: number;
  reachedZeroHitPoints: boolean;
}
export interface HitPointHealingResult {
  state: HitPointState;
  hitPointsRestored: number;
}
export interface TemporaryHitPointResult {
  state: HitPointState;
  temporaryHitPointsGained: number;
  replacedExistingTemporaryHitPoints: boolean;
}
