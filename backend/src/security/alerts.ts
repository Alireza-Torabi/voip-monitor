import type { SecurityAuthenticationFailureReason, SecurityEvent } from '@voip-monitor/shared';
import type { SecurityAlertRuleId, SecurityEventRepository } from '../storage/index.js';

export type SecurityAlertRule =
  | { id: 'AUTHENTICATION_FAILURE_ANY'; enabled: boolean }
  | {
      id: 'AUTHENTICATION_FAILURE_THRESHOLD';
      enabled: boolean;
      threshold: number;
      windowSeconds: number;
      reason?: SecurityAuthenticationFailureReason;
    };
export type SecurityAlertEvaluationStatus =
  'MATCHED' | 'NO_MATCH' | 'INVALID_RULE' | 'INVALID_EVENT' | 'EVALUATION_FAILED';
export interface SecurityAlertEvaluation {
  status: SecurityAlertEvaluationStatus;
  ruleId: SecurityAlertRuleId | 'UNKNOWN';
  instanceId: string;
  observedAt: string;
  matchedEventCount: number;
}

const FAILURE_REASONS = new Set<SecurityAuthenticationFailureReason>([
  'INVALID_ACCOUNT',
  'INVALID_PASSWORD',
  'CHALLENGE_RESPONSE_FAILED',
  'ACL_FAILURE',
  'UNEXPECTED_ADDRESS',
  'UNKNOWN',
]);
const MAX_WINDOW_SECONDS = 3600;
const MAX_THRESHOLD = 100;
const MAX_HISTORY_ROWS = 500;

export class SecurityAlertEvaluator {
  constructor(private readonly repository: SecurityEventRepository) {}

  evaluate(event: SecurityEvent, rule: unknown): SecurityAlertEvaluation {
    const base = { instanceId: event?.instanceId ?? '', observedAt: event?.observedAt ?? '' };
    const parsed = parseRule(rule);
    if (!parsed)
      return { ...base, status: 'INVALID_RULE', ruleId: 'UNKNOWN', matchedEventCount: 0 };
    if (!isValidEvent(event))
      return { ...base, status: 'INVALID_EVENT', ruleId: parsed.id, matchedEventCount: 0 };
    if (!parsed.enabled || event.type !== 'AUTHENTICATION_FAILURE')
      return { ...base, status: 'NO_MATCH', ruleId: parsed.id, matchedEventCount: 0 };
    if (parsed.id === 'AUTHENTICATION_FAILURE_ANY')
      return { ...base, status: 'MATCHED', ruleId: parsed.id, matchedEventCount: 1 };
    const from = new Date(Date.parse(event.observedAt) - parsed.windowSeconds * 1000).toISOString();
    try {
      const history = this.repository.listHistory(
        event.instanceId,
        from,
        event.observedAt,
        MAX_HISTORY_ROWS,
      );
      const count = history.filter(
        (candidate) =>
          candidate.type === 'AUTHENTICATION_FAILURE' &&
          (parsed.reason === undefined || candidate.reason === parsed.reason),
      ).length;
      return {
        ...base,
        status: count >= parsed.threshold ? 'MATCHED' : 'NO_MATCH',
        ruleId: parsed.id,
        matchedEventCount: count,
      };
    } catch {
      return { ...base, status: 'EVALUATION_FAILED', ruleId: parsed.id, matchedEventCount: 0 };
    }
  }
}

function parseRule(value: unknown): SecurityAlertRule | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const rule = value as Record<string, unknown>;
  if (rule.enabled !== true && rule.enabled !== false) return undefined;
  if (rule.id === 'AUTHENTICATION_FAILURE_ANY') {
    return Object.keys(rule).every((key) => ['id', 'enabled'].includes(key))
      ? { id: rule.id, enabled: rule.enabled }
      : undefined;
  }
  if (rule.id !== 'AUTHENTICATION_FAILURE_THRESHOLD') return undefined;
  if (
    !Object.keys(rule).every((key) =>
      ['id', 'enabled', 'threshold', 'windowSeconds', 'reason'].includes(key),
    )
  )
    return undefined;
  const threshold = rule.threshold;
  const windowSeconds = rule.windowSeconds;
  if (
    typeof threshold !== 'number' ||
    typeof windowSeconds !== 'number' ||
    !Number.isSafeInteger(threshold) ||
    threshold < 1 ||
    threshold > MAX_THRESHOLD ||
    !Number.isSafeInteger(windowSeconds) ||
    windowSeconds < 1 ||
    windowSeconds > MAX_WINDOW_SECONDS
  )
    return undefined;
  if (
    rule.reason !== undefined &&
    !FAILURE_REASONS.has(rule.reason as SecurityAuthenticationFailureReason)
  )
    return undefined;
  return {
    id: rule.id,
    enabled: rule.enabled,
    threshold,
    windowSeconds,
    ...(rule.reason === undefined
      ? {}
      : { reason: rule.reason as SecurityAuthenticationFailureReason }),
  };
}

function isValidEvent(event: SecurityEvent): boolean {
  if (!event || typeof event !== 'object' || typeof event.instanceId !== 'string') return false;
  if (
    event.source !== 'AMI' ||
    typeof event.observedAt !== 'string' ||
    !event.observedAt.endsWith('Z')
  )
    return false;
  if (!Number.isFinite(Date.parse(event.observedAt))) return false;
  if (event.type === 'AUTHENTICATION_SUCCESS') return true;
  return event.type === 'AUTHENTICATION_FAILURE' && FAILURE_REASONS.has(event.reason);
}
