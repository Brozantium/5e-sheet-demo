import type { HitPointDamageResult, HitPointHealingResult, HitPointState } from "./hit-points";

export type DeathSaveStatus = "active" | "stable" | "dead";

export interface DeathSaveState {
  /**
   * "active" means the character is alive and not Stable. At 0 HP, an active
   * character is Unconscious and must make Death Saving Throws at turn start.
   */
  status: DeathSaveStatus;
  successes: number;
  failures: number;
}

export type DeathSaveDamageOutcome =
  | "no-damage"
  | "hit-points-remain"
  | "unconscious"
  | "death-save-failure"
  | "stability-ended"
  | "dead";

export type DeathSaveDamageIssueCode = "already-dead";

export interface DeathSaveDamageInput {
  hitPoints: HitPointState;
  deathSaveState: DeathSaveState;
  amount: number;
  isCritical?: boolean;
}

export interface DeathSaveDamageResult {
  applied: boolean;
  hitPoints: HitPointState;
  deathSaveState: DeathSaveState;
  damageResult?: HitPointDamageResult;
  outcome: DeathSaveDamageOutcome;
  issue?: { code: DeathSaveDamageIssueCode; message: string };
}

export type DeathSavingThrowOutcome =
  | "no-roll"
  | "success"
  | "failure"
  | "stable"
  | "dead"
  | "regained-1-hit-point";

export type DeathSavingThrowIssueCode =
  | "not-at-zero-hit-points"
  | "already-stable"
  | "already-dead";

export interface DeathSavingThrowInput {
  hitPoints: HitPointState;
  deathSaveState: DeathSaveState;
  roll: number;
}

export interface DeathSavingThrowResult {
  made: boolean;
  hitPoints: HitPointState;
  deathSaveState: DeathSaveState;
  outcome: DeathSavingThrowOutcome;
  issue?: { code: DeathSavingThrowIssueCode; message: string };
}

export type StabilizationMethod = "medicine-check" | "healer-kit";
export type StabilizationActionType = "action" | "help" | "utilize";

export type StabilizationIssueCode =
  | "not-at-zero-hit-points"
  | "already-stable"
  | "already-dead"
  | "medicine-check-failed"
  | "no-healer-kit-uses";

export interface StabilizationInput {
  ruleset: "2014" | "2024";
  hitPoints: HitPointState;
  deathSaveState: DeathSaveState;
  method: StabilizationMethod;
  /** Final Wisdom (Medicine) check total, after ability and proficiency modifiers. */
  medicineCheckTotal?: number;
  /** Current uses on a 10-use Healer's Kit. Required only for healer-kit. */
  healerKitUsesRemaining?: number;
}

export interface StabilizationResult {
  stabilized: boolean;
  hitPoints: HitPointState;
  deathSaveState: DeathSaveState;
  method: StabilizationMethod;
  actionType: StabilizationActionType;
  healerKitUsesRemaining?: number;
  issue?: { code: StabilizationIssueCode; message: string };
}

export type StableRecoveryIssueCode = "not-stable";

export interface StableRecoveryResult {
  recovered: boolean;
  hitPoints: HitPointState;
  deathSaveState: DeathSaveState;
  hitPointsRestored: number;
  issue?: { code: StableRecoveryIssueCode; message: string };
}

export interface DeathStateHealingResult {
  hitPoints: HitPointState;
  deathSaveState: DeathSaveState;
  healingResult: HitPointHealingResult;
  revived: boolean;
}
