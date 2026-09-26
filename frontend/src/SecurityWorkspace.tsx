import { useEffect, useState, type FormEvent } from 'react';
import {
  api,
  ApiError,
  type PbxProfile,
  type SecurityAlertReason,
  type SecurityAlertRecord,
  type SecurityAlertRuleConfig,
  type SecurityAlertRuleId,
} from './api.js';
import { messages, type Language } from './i18n.js';

type Text = (typeof messages)[Language];

const securityReasons: SecurityAlertReason[] = [
  'INVALID_ACCOUNT',
  'INVALID_PASSWORD',
  'CHALLENGE_RESPONSE_FAILED',
  'ACL_FAILURE',
  'UNEXPECTED_ADDRESS',
  'UNKNOWN',
];

export function SecurityWorkspace({
  text,
  profiles,
  onUnauthorized,
}: {
  text: Text;
  profiles: PbxProfile[];
  onUnauthorized: () => void;
}) {
  const [selectedId, setSelectedId] = useState(profiles[0]?.id ?? '');
  const [alerts, setAlerts] = useState<SecurityAlertRecord[]>([]);
  const [rules, setRules] = useState<SecurityAlertRuleConfig[]>([]);
  const [anyEnabled, setAnyEnabled] = useState(false);
  const [thresholdEnabled, setThresholdEnabled] = useState(false);
  const [threshold, setThreshold] = useState('3');
  const [windowSeconds, setWindowSeconds] = useState('60');
  const [reason, setReason] = useState<SecurityAlertReason | ''>('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [pending, setPending] = useState(false);

  const selectedProfile = profiles.find((profile) => profile.id === selectedId);

  function applyRules(items: SecurityAlertRuleConfig[]) {
    setRules(items);
    const any = items.find((item) => item.id === 'AUTHENTICATION_FAILURE_ANY');
    const bounded = items.find((item) => item.id === 'AUTHENTICATION_FAILURE_THRESHOLD');
    setAnyEnabled(any?.enabled ?? false);
    if (bounded?.id === 'AUTHENTICATION_FAILURE_THRESHOLD') {
      setThresholdEnabled(bounded.enabled);
      setThreshold(String(bounded.threshold));
      setWindowSeconds(String(bounded.windowSeconds));
      setReason(bounded.reason ?? '');
    } else {
      setThresholdEnabled(false);
      setThreshold('3');
      setWindowSeconds('60');
      setReason('');
    }
  }

  async function load(id = selectedId) {
    if (!id) {
      setAlerts([]);
      applyRules([]);
      return;
    }
    setPending(true);
    setError('');
    setStatus('');
    try {
      const [alertResult, ruleResult] = await Promise.all([
        api.listSecurityAlerts(id),
        api.listSecurityAlertRules(id),
      ]);
      setAlerts(alertResult.current);
      applyRules(ruleResult.items);
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) onUnauthorized();
      else setError(text.securityLoadFailed);
    } finally {
      setPending(false);
    }
  }

  useEffect(() => {
    if (!profiles.some((profile) => profile.id === selectedId)) {
      setSelectedId(profiles[0]?.id ?? '');
    }
  }, [profiles, selectedId]);

  useEffect(() => {
    if (selectedId) void load(selectedId);
    else {
      setAlerts([]);
      applyRules([]);
    }
  }, [selectedId]);

  async function saveRule(ruleId: SecurityAlertRuleId) {
    if (!selectedId) return;
    setPending(true);
    setError('');
    setStatus('');
    try {
      if (ruleId === 'AUTHENTICATION_FAILURE_ANY') {
        await api.putSecurityAlertRule(selectedId, ruleId, { enabled: anyEnabled });
      } else {
        await api.putSecurityAlertRule(selectedId, ruleId, {
          enabled: thresholdEnabled,
          threshold: Number(threshold),
          windowSeconds: Number(windowSeconds),
          ...(reason ? { reason } : {}),
        });
      }
      await load(selectedId);
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) onUnauthorized();
      else setError(text.securityRuleFailed);
    } finally {
      setPending(false);
    }
  }

  async function removeRule(ruleId: SecurityAlertRuleId) {
    if (!selectedId) return;
    setPending(true);
    setError('');
    setStatus('');
    try {
      await api.deleteSecurityAlertRule(selectedId, ruleId);
      await load(selectedId);
      setStatus(text.securityRuleRemoved);
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) onUnauthorized();
      else if (failure instanceof ApiError && failure.status === 404) {
        await load(selectedId);
        setStatus(text.securityRuleRemoved);
      } else setError(text.securityRuleFailed);
    } finally {
      setPending(false);
    }
  }

  if (profiles.length === 0) return null;

  const anyConfigured = rules.some((item) => item.id === 'AUTHENTICATION_FAILURE_ANY');
  const thresholdConfigured = rules.some((item) => item.id === 'AUTHENTICATION_FAILURE_THRESHOLD');

  return (
    <section aria-labelledby="security-title">
      <h2 id="security-title">{text.securityTitle}</h2>
      <p>{text.securityHint}</p>
      <label>
        {text.securityPbx}
        <select
          name="security-pbx"
          value={selectedId}
          onChange={(event) => setSelectedId(event.target.value)}
        >
          {profiles.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.displayName}
            </option>
          ))}
        </select>
      </label>
      {selectedProfile && <h3>{selectedProfile.displayName}</h3>}
      <div className="actions">
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            void load();
          }}
        >
          {text.refreshSecurity}
        </button>
      </div>

      <h3>{text.currentAlerts}</h3>
      {alerts.length === 0 ? (
        <p>{text.noAlerts}</p>
      ) : (
        <ul className="security-alerts">
          {alerts.map((alert) => (
            <li key={`${alert.ruleId}:${alert.observedAt}:${alert.streamSequence ?? ''}`}>
              <strong>
                {alert.ruleId === 'AUTHENTICATION_FAILURE_ANY'
                  ? text.anyFailureRule
                  : text.thresholdRule}
              </strong>
              <div>
                {text.observedAt}: <span dir="ltr">{alert.observedAt}</span>
              </div>
              <div>
                {text.matchedEvents}: {alert.matchedEventCount}
              </div>
            </li>
          ))}
        </ul>
      )}

      <h3>{text.rulesTitle}</h3>
      <div className="rule-grid">
        <form
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            void saveRule('AUTHENTICATION_FAILURE_ANY');
          }}
        >
          <h4>{text.anyFailureRule}</h4>
          <label className="check">
            <input
              name="rule-any-enabled"
              type="checkbox"
              checked={anyEnabled}
              onChange={(event) => setAnyEnabled(event.target.checked)}
            />
            {text.ruleEnabled}
          </label>
          <div className="actions">
            <button type="submit" disabled={pending}>
              {text.saveRule}
            </button>
            {anyConfigured && (
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  void removeRule('AUTHENTICATION_FAILURE_ANY');
                }}
              >
                {text.removeRule}
              </button>
            )}
          </div>
        </form>

        <form
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            void saveRule('AUTHENTICATION_FAILURE_THRESHOLD');
          }}
        >
          <h4>{text.thresholdRule}</h4>
          <label className="check">
            <input
              name="rule-threshold-enabled"
              type="checkbox"
              checked={thresholdEnabled}
              onChange={(event) => setThresholdEnabled(event.target.checked)}
            />
            {text.ruleEnabled}
          </label>
          <label>
            {text.threshold}
            <input
              name="rule-threshold"
              type="number"
              min={1}
              max={100}
              value={threshold}
              onChange={(event) => setThreshold(event.target.value)}
              required
            />
          </label>
          <label>
            {text.windowSeconds}
            <input
              name="rule-window-seconds"
              type="number"
              min={1}
              max={3600}
              value={windowSeconds}
              onChange={(event) => setWindowSeconds(event.target.value)}
              required
            />
          </label>
          <label>
            {text.reason}
            <select
              name="rule-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value as SecurityAlertReason | '')}
            >
              <option value="">{text.anyReason}</option>
              {securityReasons.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <div className="actions">
            <button type="submit" disabled={pending}>
              {text.saveRule}
            </button>
            {thresholdConfigured && (
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  void removeRule('AUTHENTICATION_FAILURE_THRESHOLD');
                }}
              >
                {text.removeRule}
              </button>
            )}
          </div>
        </form>
      </div>
      {status && <p role="status">{status}</p>}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
