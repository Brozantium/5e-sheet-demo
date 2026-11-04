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

export interface HitDicePool {
  classId: string;
  hitDie: HitDieSize;
  total: number;
  spent: number;
}

export type HitDieSpendIssueCode =
  | "short-rest-requires-positive-hit-points"
  | "unknown-hit-die-pool"
  | "no-hit-dice-remaining";

export interface HitDieSpendIssue {
  code: HitDieSpendIssueCode;
  message: string;
}

export interface ShortRestHitDieSpendInput {
  ruleset: "2014" | "2024";
  hitPoints: HitPointState;
  hitDicePools: readonly HitDicePool[];
  /** The character's HP when this Short Rest began; reused for each die spent. */
  shortRestStartedAtHitPoints: number;
  classId: string;
  roll: number;
  constitutionScore: number;
}

export interface ShortRestHitDieSpendResult {
  canSpend: boolean;
  hitPoints: HitPointState;
  hitDicePools: HitDicePool[];
  classId: string;
  hitDie: HitDieSize | null;
  rollValue: number;
  constitutionModifier: number;
  healingBeforeMaximum: number;
  hitPointsRestored: number;
  issue?: HitDieSpendIssue;
}
