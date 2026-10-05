import {
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  Flex,
  Heading,
  HStack,
  Input,
  NativeSelect,
  SimpleGrid,
  Stack,
  Text,
} from '@chakra-ui/react';
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
      <Text fontSize="sm" fontWeight="semibold">
        {label}
      </Text>
      {children}
    </Stack>
  );
}

function Message({ children, tone = 'error' }: { children: ReactNode; tone?: 'error' | 'status' }) {
  return (
    <Box
      role={tone === 'error' ? 'alert' : 'status'}
      borderWidth="1px"
      borderColor={tone === 'error' ? 'red.200' : 'blue.200'}
      bg={tone === 'error' ? 'red.50' : 'blue.50'}
      color={tone === 'error' ? 'red.800' : 'blue.800'}
      borderRadius="lg"
      px="3"
      py="2"
      fontSize="sm"
    >
      {children}
    </Box>
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
    return (
      <Card.Root variant="outline">
        <Card.Body>
          <Text color="fg.muted">{empty}</Text>
        </Card.Body>
      </Card.Root>
    );
  }

  return (
    <SimpleGrid columns={{ base: 1, md: 2 }} gap="3">
      {items.map((alert) => (
        <Card.Root
          key={`${history ? 'history:' : ''}${alert.ruleId}:${alert.observedAt}:${alert.streamSequence ?? ''}`}
          variant="outline"
          data-security-alert={history ? 'history' : 'current'}
        >
          <Card.Body gap="2">
            <Flex justify="space-between" align="start" gap="3">
              <Text fontWeight="semibold">
                {alert.ruleId === 'AUTHENTICATION_FAILURE_ANY'
                  ? text.anyFailureRule
                  : text.thresholdRule}
              </Text>
              <Badge colorPalette="red">{alert.matchedEventCount}</Badge>
            </Flex>
            <Text fontSize="sm" color="fg.muted">
              {text.observedAt}:{' '}
              <Box as="span" dir="ltr">
                {alert.observedAt}
              </Box>
            </Text>
            <Text fontSize="sm" color="fg.muted">
              {text.matchedEvents}: {alert.matchedEventCount}
            </Text>
          </Card.Body>
        </Card.Root>
      ))}
    </SimpleGrid>
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
    <Box as="section" aria-labelledby="security-title">
      <Stack gap="5">
        <Flex
          justify="space-between"
          align={{ base: 'stretch', md: 'end' }}
          direction={{ base: 'column', md: 'row' }}
          gap="4"
        >
          <Box>
            <Heading id="security-title" size="lg">
              {text.securityTitle}
            </Heading>
            <Text color="fg.muted" mt="1">
              {text.securityHint}
            </Text>
          </Box>
          <Box minW={{ base: '100%', md: '260px' }}>
            <Text fontSize="sm" fontWeight="semibold" mb="1.5">
              {text.securityPbx}
            </Text>
            <NativeSelect.Root>
              <NativeSelect.Field
                name="security-pbx"
                value={selectedId}
                onChange={(event) => setSelectedId(event.target.value)}
              >
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.displayName}
                  </option>
                ))}
              </NativeSelect.Field>
              <NativeSelect.Indicator />
            </NativeSelect.Root>
          </Box>
        </Flex>

        <Card.Root variant="outline">
          <Card.Body>
            <Flex justify="space-between" align="center" gap="3" flexWrap="wrap">
              <Box>
                <Text fontWeight="semibold">{selectedProfile?.displayName}</Text>
                <Badge colorPalette={liveConnected ? 'green' : 'gray'} mt="2">
                  {liveConnected ? text.liveConnected : text.liveDisconnected}
                </Badge>
              </Box>
              <Button
                variant="outline"
                disabled={pending}
                onClick={() => {
                  void load();
                }}
              >
                {text.refreshSecurity}
              </Button>
            </Flex>
          </Card.Body>
        </Card.Root>

        <Box>
          <Heading size="md" mb="3">
            {text.currentAlerts}
          </Heading>
          <AlertCards items={alerts} text={text} empty={text.noAlerts} />
        </Box>

        <Box>
          <Heading size="md" mb="3">
            {text.recentAlerts}
          </Heading>
          <AlertCards items={history} text={text} empty={text.noRecentAlerts} history />
        </Box>

        <Box>
          <Heading size="md" mb="3">
            {text.rulesTitle}
          </Heading>
          <SimpleGrid columns={{ base: 1, lg: 2 }} gap="4">
            <Card.Root variant="outline">
              <Card.Header>
                <Card.Title fontSize="md">{text.anyFailureRule}</Card.Title>
              </Card.Header>
              <Card.Body>
                <form
                  onSubmit={(event: FormEvent<HTMLFormElement>) => {
                    event.preventDefault();
                    void saveRule('AUTHENTICATION_FAILURE_ANY');
                  }}
                >
                  <Stack gap="4">
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
                      <Button type="submit" disabled={pending} colorPalette="blue">
                        {text.saveRule}
                      </Button>
                      {anyConfigured ? (
                        <Button
                          type="button"
                          variant="outline"
                          colorPalette="red"
                          disabled={pending}
                          onClick={() => {
                            void removeRule('AUTHENTICATION_FAILURE_ANY');
                          }}
                        >
                          {text.removeRule}
                        </Button>
                      ) : null}
                    </HStack>
                  </Stack>
                </form>
              </Card.Body>
            </Card.Root>

            <Card.Root variant="outline">
              <Card.Header>
                <Card.Title fontSize="md">{text.thresholdRule}</Card.Title>
              </Card.Header>
              <Card.Body>
                <form
                  onSubmit={(event: FormEvent<HTMLFormElement>) => {
                    event.preventDefault();
                    void saveRule('AUTHENTICATION_FAILURE_THRESHOLD');
                  }}
                >
                  <Stack gap="4">
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
                      <Button type="submit" disabled={pending} colorPalette="blue">
                        {text.saveRule}
                      </Button>
                      {thresholdConfigured ? (
                        <Button
                          type="button"
                          variant="outline"
                          colorPalette="red"
                          disabled={pending}
                          onClick={() => {
                            void removeRule('AUTHENTICATION_FAILURE_THRESHOLD');
                          }}
                        >
                          {text.removeRule}
                        </Button>
                      ) : null}
                    </HStack>
                  </Stack>
                </form>
              </Card.Body>
            </Card.Root>
          </SimpleGrid>
        </Box>

        {status ? <Message tone="status">{status}</Message> : null}
        {error ? <Message>{error}</Message> : null}
      </Stack>
    </Box>
  );
}
