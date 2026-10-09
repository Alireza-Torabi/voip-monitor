import {
  Badge,
  Box,
  Checkbox,
  Flex,
  HStack,
  Input,
  NativeSelect,
  SimpleGrid,
  Stack,
  Text,
} from '@chakra-ui/react';
import { HelpButton as Button } from './ContextHelp.js';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
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
import { NocInset, NocPanel, SectionHeader, StatusIndicator } from './NocPrimitives.js';
import {
  WorkspaceField,
  WorkspaceHeader,
  WorkspaceSelect,
  WorkspaceState,
  WorkspaceToolbar,
} from './WorkspacePrimitives.js';

type TextMap = (typeof messages)[Language];

const securityReasons: SecurityAlertReason[] = [
  'INVALID_ACCOUNT',
  'INVALID_PASSWORD',
  'CHALLENGE_RESPONSE_FAILED',
  'ACL_FAILURE',
  'UNEXPECTED_ADDRESS',
  'UNKNOWN',
];

function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Stack gap="1.5">
      <Text
        fontSize="10px"
        color="noc.textSubtle"
        fontWeight="700"
        letterSpacing=".05em"
        textTransform="uppercase"
      >
        {label}
      </Text>
      {children}
    </Stack>
  );
}

function Message({ children, tone = 'error' }: { children: ReactNode; tone?: 'error' | 'status' }) {
  return (
    <WorkspaceState
      tone={tone === 'error' ? 'critical' : 'info'}
      title={children}
      role={tone === 'error' ? 'alert' : 'status'}
    />
  );
}

function AlertCards({
  items,
  text,
  empty,
  history = false,
}: {
  items: SecurityAlertRecord[];
  text: TextMap;
  empty: string;
  history?: boolean;
}) {
  if (items.length === 0) {
    return <WorkspaceState title={empty} />;
  }

  return (
    <Stack gap="0">
      {items.map((alert, index) => (
        <Flex
          key={`${history ? 'history:' : ''}${alert.ruleId}:${alert.observedAt}:${alert.streamSequence ?? ''}`}
          data-security-alert={history ? 'history' : 'current'}
          align={{ base: 'flex-start', md: 'center' }}
          justify="space-between"
          direction={{ base: 'column', md: 'row' }}
          gap="3"
          px="4"
          py="3"
          borderTopWidth={index === 0 ? '0' : '1px'}
          borderColor="noc.border"
          _hover={{ bg: 'rgba(255,255,255,.02)' }}
        >
          <Box minW="0">
            <StatusIndicator
              tone="critical"
              label={
                alert.ruleId === 'AUTHENTICATION_FAILURE_ANY'
                  ? text.anyFailureRule
                  : text.thresholdRule
              }
            />
            <Text mt="1.5" fontSize="10px" color="noc.textSubtle" dir="ltr">
              {alert.observedAt}
            </Text>
          </Box>
          <Flex align="center" gap="2" flex="0 0 auto">
            <Text fontSize="10px" color="noc.textSubtle">
              {text.matchedEvents}: {alert.matchedEventCount}
            </Text>
            <Badge colorPalette="red" variant="subtle">
              {alert.matchedEventCount}
            </Badge>
          </Flex>
        </Flex>
      ))}
    </Stack>
  );
}

export function SecurityWorkspace({
  text,
  profiles,
  onUnauthorized,
}: {
  text: TextMap;
  profiles: PbxProfile[];
  onUnauthorized: () => void;
}) {
  const [selectedId, setSelectedId] = useState(profiles[0]?.id ?? '');
  const [alerts, setAlerts] = useState<SecurityAlertRecord[]>([]);
  const [history, setHistory] = useState<SecurityAlertRecord[]>([]);
  const [liveConnected, setLiveConnected] = useState(false);
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

  function alertKey(alert: SecurityAlertRecord) {
    return `${alert.ruleId}:${alert.observedAt}:${alert.streamGeneration ?? ''}:${alert.streamSequence ?? ''}:${alert.matchedEventCount}`;
  }

  function validAlert(value: unknown, instanceId: string): value is SecurityAlertRecord {
    if (!value || typeof value !== 'object') return false;
    const alert = value as Partial<SecurityAlertRecord>;
    return (
      alert.instanceId === instanceId &&
      (alert.ruleId === 'AUTHENTICATION_FAILURE_ANY' ||
        alert.ruleId === 'AUTHENTICATION_FAILURE_THRESHOLD') &&
      typeof alert.observedAt === 'string' &&
      Number.isSafeInteger(alert.matchedEventCount) &&
      Number(alert.matchedEventCount) > 0
    );
  }

  function mergeRealtimeAlert(alert: SecurityAlertRecord) {
    setAlerts((current) => [alert, ...current.filter((item) => item.ruleId !== alert.ruleId)]);
    setHistory((current) => {
      const key = alertKey(alert);
      if (current.some((item) => alertKey(item) === key)) return current;
      return [alert, ...current].slice(0, 100);
    });
  }

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
      setHistory([]);
      applyRules([]);
      return;
    }
    setPending(true);
    setError('');
    setStatus('');
    try {
      const to = new Date();
      const from = new Date(to.getTime() - 24 * 60 * 60 * 1000);
      const [alertResult, ruleResult, historyResult] = await Promise.all([
        api.listSecurityAlerts(id),
        api.listSecurityAlertRules(id),
        api.listSecurityAlertHistory(id, from.toISOString(), to.toISOString(), 100),
      ]);
      setAlerts(alertResult.current);
      setHistory(historyResult.items);
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
      setHistory([]);
      applyRules([]);
    }
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId || typeof EventSource === 'undefined') {
      setLiveConnected(false);
      return;
    }
    const source = new EventSource(api.securityAlertStreamUrl(selectedId));
    const onAlert = (event: MessageEvent<string>) => {
      try {
        const value = JSON.parse(event.data) as { current?: unknown; alert?: unknown };
        if (Array.isArray(value.current)) {
          setAlerts(value.current.filter((item) => validAlert(item, selectedId)));
        }
        if (validAlert(value.alert, selectedId)) mergeRealtimeAlert(value.alert);
      } catch {
        // Malformed realtime payloads fail closed and do not alter displayed state.
      }
    };
    source.addEventListener('security-alert', onAlert as EventListener);
    source.onopen = () => setLiveConnected(true);
    source.onerror = () => setLiveConnected(false);
    return () => {
      source.removeEventListener('security-alert', onAlert as EventListener);
      source.close();
      setLiveConnected(false);
    };
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
    <Box as="section" aria-labelledby="security-title" data-workspace="security">
      <Stack gap="4">
        <WorkspaceHeader
          title={
            <Box as="span" id="security-title">
              {text.securityTitle}
            </Box>
          }
          description={text.securityHint}
          status={
            <HStack gap="3" flexWrap="wrap">
              <StatusIndicator
                tone={liveConnected ? 'healthy' : 'warning'}
                label={liveConnected ? text.liveConnected : text.liveDisconnected}
              />
              <StatusIndicator
                tone={alerts.length > 0 ? 'critical' : 'healthy'}
                label={text.currentAlerts + ': ' + alerts.length}
              />
            </HStack>
          }
          actions={
            <Button variant="outline" size="sm" disabled={pending} onClick={() => void load()}>
              {text.refreshSecurity}
            </Button>
          }
        />

        <WorkspaceToolbar>
          <WorkspaceField label={text.securityPbx}>
            <WorkspaceSelect
              value={selectedId}
              onChange={setSelectedId}
              ariaLabel={text.securityPbx}
            >
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.displayName}
                </option>
              ))}
            </WorkspaceSelect>
          </WorkspaceField>
          <Box flex="1 1 260px" minW="220px">
            <Text
              fontSize="10px"
              color="noc.textSubtle"
              fontWeight="700"
              letterSpacing=".05em"
              textTransform="uppercase"
              mb="1.5"
            >
              {text.providerConnection}
            </Text>
            <NocInset px="3" h="38px" display="flex" alignItems="center">
              <Text fontSize="12px" color="noc.textMuted" truncate>
                {selectedProfile?.displayName ?? '—'}
              </Text>
            </NocInset>
          </Box>
        </WorkspaceToolbar>

        <SimpleGrid columns={{ base: 1, xl: 2 }} gap="4">
          <NocPanel overflow="hidden">
            <Box px="4" py="3" borderBottomWidth="1px" borderColor="noc.border">
              <SectionHeader
                title={text.currentAlerts}
                description={text.securityCurrentAlertsHint}
              />
            </Box>
            <AlertCards items={alerts} text={text} empty={text.noAlerts} />
          </NocPanel>

          <NocPanel overflow="hidden">
            <Box px="4" py="3" borderBottomWidth="1px" borderColor="noc.border">
              <SectionHeader
                title={text.recentAlerts}
                description={text.securityRecentAlertsHint}
              />
            </Box>
            <AlertCards items={history} text={text} empty={text.noRecentAlerts} history />
          </NocPanel>
        </SimpleGrid>

        <NocPanel p="4">
          <SectionHeader title={text.rulesTitle} description={text.securityRulesHint} />
          <SimpleGrid columns={{ base: 1, lg: 2 }} gap="4" mt="4">
            <NocInset p="4">
              <form
                onSubmit={(event: FormEvent<HTMLFormElement>) => {
                  event.preventDefault();
                  void saveRule('AUTHENTICATION_FAILURE_ANY');
                }}
              >
                <Stack gap="4">
                  <Flex align="center" justify="space-between" gap="3">
                    <Text fontSize="13px" fontWeight="600" color="noc.text">
                      {text.anyFailureRule}
                    </Text>
                    <StatusIndicator
                      tone={anyEnabled ? 'healthy' : 'unknown'}
                      label={anyEnabled ? text.enabled : text.disabled}
                    />
                  </Flex>
                  <Checkbox.Root
                    checked={anyEnabled}
                    onCheckedChange={(details) => setAnyEnabled(details.checked === true)}
                  >
                    <Checkbox.HiddenInput name="rule-any-enabled" />
                    <Checkbox.Control>
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                    <Checkbox.Label>{text.ruleEnabled}</Checkbox.Label>
                  </Checkbox.Root>
                  <HStack gap="2" flexWrap="wrap">
                    <Button size="sm" type="submit" disabled={pending} colorPalette="blue">
                      {text.saveRule}
                    </Button>
                    {anyConfigured ? (
                      <Button
                        size="sm"
                        type="button"
                        variant="outline"
                        colorPalette="red"
                        disabled={pending}
                        onClick={() => void removeRule('AUTHENTICATION_FAILURE_ANY')}
                      >
                        {text.removeRule}
                      </Button>
                    ) : null}
                  </HStack>
                </Stack>
              </form>
            </NocInset>

            <NocInset p="4">
              <form
                onSubmit={(event: FormEvent<HTMLFormElement>) => {
                  event.preventDefault();
                  void saveRule('AUTHENTICATION_FAILURE_THRESHOLD');
                }}
              >
                <Stack gap="4">
                  <Flex align="center" justify="space-between" gap="3">
                    <Text fontSize="13px" fontWeight="600" color="noc.text">
                      {text.thresholdRule}
                    </Text>
                    <StatusIndicator
                      tone={thresholdEnabled ? 'healthy' : 'unknown'}
                      label={thresholdEnabled ? text.enabled : text.disabled}
                    />
                  </Flex>
                  <Checkbox.Root
                    checked={thresholdEnabled}
                    onCheckedChange={(details) => setThresholdEnabled(details.checked === true)}
                  >
                    <Checkbox.HiddenInput name="rule-threshold-enabled" />
                    <Checkbox.Control>
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                    <Checkbox.Label>{text.ruleEnabled}</Checkbox.Label>
                  </Checkbox.Root>
                  <SimpleGrid columns={{ base: 1, sm: 2 }} gap="3">
                    <FormField label={text.threshold}>
                      <Input
                        name="rule-threshold"
                        type="number"
                        min={1}
                        max={100}
                        value={threshold}
                        onChange={(event) => setThreshold(event.target.value)}
                        required
                        dir="ltr"
                        bg="noc.surface3"
                        borderColor="noc.border"
                      />
                    </FormField>
                    <FormField label={text.windowSeconds}>
                      <Input
                        name="rule-window-seconds"
                        type="number"
                        min={1}
                        max={3600}
                        value={windowSeconds}
                        onChange={(event) => setWindowSeconds(event.target.value)}
                        required
                        dir="ltr"
                        bg="noc.surface3"
                        borderColor="noc.border"
                      />
                    </FormField>
                  </SimpleGrid>
                  <FormField label={text.reason}>
                    <NativeSelect.Root>
                      <NativeSelect.Field
                        name="rule-reason"
                        value={reason}
                        onChange={(event) =>
                          setReason(event.target.value as SecurityAlertReason | '')
                        }
                        bg="noc.surface3"
                        borderColor="noc.border"
                      >
                        <option value="">{text.anyReason}</option>
                        {securityReasons.map((value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </NativeSelect.Field>
                      <NativeSelect.Indicator />
                    </NativeSelect.Root>
                  </FormField>
                  <HStack gap="2" flexWrap="wrap">
                    <Button size="sm" type="submit" disabled={pending} colorPalette="blue">
                      {text.saveRule}
                    </Button>
                    {thresholdConfigured ? (
                      <Button
                        size="sm"
                        type="button"
                        variant="outline"
                        colorPalette="red"
                        disabled={pending}
                        onClick={() => void removeRule('AUTHENTICATION_FAILURE_THRESHOLD')}
                      >
                        {text.removeRule}
                      </Button>
                    ) : null}
                  </HStack>
                </Stack>
              </form>
            </NocInset>
          </SimpleGrid>
        </NocPanel>

        {status ? <Message tone="status">{status}</Message> : null}
        {error ? <Message>{error}</Message> : null}
      </Stack>
    </Box>
  );
}
