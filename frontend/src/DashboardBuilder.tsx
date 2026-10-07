import {
  Box,
  Button,
  Card,
  Flex,
  Heading,
  HStack,
  NativeSelect,
  Stack,
  Text,
} from '@chakra-ui/react';
import { useEffect, useRef, useState } from 'react';
import { DEFAULT_DASHBOARD_REFRESH_RATES, type DashboardRefreshRates } from '@voip-monitor/shared';
import {
  api,
  ApiError,
  type PbxConnectionState,
  type PbxProfile,
  type SecurityAlertRecord,
  type SystemMetricsResponse,
  type SystemMetricsSample,
  type TelephonyInstanceState,
} from './api.js';
import type { TelephonyPage } from './TelephonyWorkspace.js';
import { messages, type Language } from './i18n.js';
import { OperatorOverview } from './OperatorOverview.js';

type TextMap = (typeof messages)[Language];
type LiveState = 'connecting' | 'connected' | 'disconnected';
export type DashboardDestination = TelephonyPage | 'security';

export function DashboardBuilder({
  text,
  profiles,
  onUnauthorized,
  onNavigate,
  selectedInstanceId,
  onSelectedInstanceIdChange,
}: {
  text: TextMap;
  profiles: PbxProfile[];
  onUnauthorized: () => void;
  onNavigate?: (destination: DashboardDestination) => void;
  selectedInstanceId?: string | undefined;
  onSelectedInstanceIdChange?: ((instanceId: string) => void) | undefined;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const hideTimer = useRef<number | undefined>(undefined);
  const [selectedId, setSelectedId] = useState(selectedInstanceId ?? profiles[0]?.id ?? '');
  const [connection, setConnection] = useState<PbxConnectionState>(
    profiles[0]?.connectionStatus ?? 'UNVERIFIED',
  );
  const [metrics, setMetrics] = useState<SystemMetricsResponse>();
  const [metricHistory, setMetricHistory] = useState<SystemMetricsSample[]>([]);
  const [selectedFilesystemIds, setSelectedFilesystemIds] = useState<string[] | null>(null);
  const [refreshRates, setRefreshRates] = useState<DashboardRefreshRates>(
    DEFAULT_DASHBOARD_REFRESH_RATES,
  );
  const [alerts, setAlerts] = useState<SecurityAlertRecord[]>([]);
  const [telephony, setTelephony] = useState<TelephonyInstanceState | null>(null);
  const [metricsLive, setMetricsLive] = useState<LiveState>('connecting');
  const [alertsLive, setAlertsLive] = useState<LiveState>('connecting');
  const [telephonyLive, setTelephonyLive] = useState<LiveState>('connecting');
  const [fullscreen, setFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [error, setError] = useState('');

  const selected = profiles.find((profile) => profile.id === selectedId) ?? profiles[0];

  useEffect(() => {
    if (!selected && profiles.length > 0) setSelectedId(profiles[0]?.id ?? '');
  }, [profiles, selected]);

  useEffect(() => {
    if (!selectedInstanceId) return;
    if (
      profiles.some((profile) => profile.id === selectedInstanceId) &&
      selectedId !== selectedInstanceId
    ) {
      setSelectedId(selectedInstanceId);
    }
  }, [profiles, selectedId, selectedInstanceId]);

  function chooseInstance(instanceId: string) {
    setSelectedId(instanceId);
    onSelectedInstanceIdChange?.(instanceId);
  }

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setConnection(selected.connectionStatus);
    setMetrics(undefined);
    setMetricHistory([]);
    setSelectedFilesystemIds(null);
    setRefreshRates(DEFAULT_DASHBOARD_REFRESH_RATES);
    setAlerts([]);
    setTelephony(null);
    setError('');

    const fail = (failure: unknown) => {
      if (failure instanceof ApiError && failure.status === 401) onUnauthorized();
      else if (!cancelled) setError(text.dashboardLoadFailed);
    };

    void Promise.all([
      api
        .providerStatus(selected.id)
        .then((value) => {
          if (!cancelled) setConnection(value.connectionStatus);
        })
        .catch(fail),
      api
        .systemMetrics(selected.id)
        .then((value) => {
          if (!cancelled) setMetrics(value);
        })
        .catch(fail),
      api
        .dashboardStorage(selected.id)
        .then((value) => {
          if (!cancelled) setSelectedFilesystemIds(value.selectedFilesystemIds);
        })
        .catch(fail),
      api
        .dashboardRefresh(selected.id)
        .then((value) => {
          if (!cancelled) setRefreshRates(value.rates);
        })
        .catch(fail),
      api
        .systemMetricsHistory(
          selected.id,
          new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
          new Date().toISOString(),
          120,
        )
        .then((value) => {
          if (!cancelled) setMetricHistory(value.items);
        })
        .catch(fail),
      api
        .listSecurityAlerts(selected.id)
        .then((value) => {
          if (!cancelled) setAlerts(value.current);
        })
        .catch(fail),
      api
        .telephonyState(selected.id)
        .then((value) => {
          if (!cancelled) setTelephony(value.current);
        })
        .catch(fail),
    ]);

    const metricsSource = new EventSource(api.systemMetricsStreamUrl(selected.id));
    metricsSource.onopen = () => setMetricsLive('connected');
    metricsSource.onerror = () => setMetricsLive('disconnected');
    metricsSource.addEventListener('system-metrics', (event) => {
      try {
        const payload = JSON.parse(
          (event as MessageEvent<string>).data,
        ) as Partial<SystemMetricsResponse>;
        if (payload.current) {
          setMetrics((current) => {
            const source = payload.source ?? current?.source;
            return {
              current: payload.current ?? current?.current ?? null,
              ...(source ? { source } : {}),
            };
          });
          setMetricHistory((current) =>
            [
              ...current.filter((sample) => sample.observedAt !== payload.current!.observedAt),
              payload.current!,
            ]
              .sort((a, b) => a.observedAt.localeCompare(b.observedAt))
              .slice(-120),
          );
        }
      } catch {
        setMetricsLive('disconnected');
      }
    });
    metricsSource.addEventListener('system-metrics-health', (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent<string>).data) as {
          source?: SystemMetricsResponse['source'];
        };
        const source = payload.source;
        if (source) {
          setMetrics((current) => ({
            current: current?.current ?? null,
            source,
          }));
        }
      } catch {
        setMetricsLive('disconnected');
      }
    });
    const alertSource = new EventSource(api.securityAlertStreamUrl(selected.id));
    alertSource.onopen = () => setAlertsLive('connected');
    alertSource.onerror = () => setAlertsLive('disconnected');
    alertSource.addEventListener('security-alert', (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent<string>).data) as {
          current?: SecurityAlertRecord[];
          alert?: SecurityAlertRecord;
        };
        if (payload.current) setAlerts(payload.current);
        else if (payload.alert)
          setAlerts((current) => [
            payload.alert!,
            ...current.filter((item) => item.ruleId !== payload.alert!.ruleId),
          ]);
      } catch {
        setAlertsLive('disconnected');
      }
    });
    const refreshTelephony = async () => {
      try {
        const value = await api.telephonyState(selected.id);
        if (!cancelled) setTelephony(value.current);
      } catch (failure) {
        if (failure instanceof ApiError && failure.status === 401) onUnauthorized();
      }
    };
    const telephonyFallbackTimer = window.setInterval(() => void refreshTelephony(), 10_000);

    const telephonySource = new EventSource(api.telephonyStateStreamUrl(selected.id));
    telephonySource.onopen = () => setTelephonyLive('connected');
    telephonySource.onerror = () => {
      setTelephonyLive('disconnected');
      void refreshTelephony();
    };
    telephonySource.addEventListener('telephony-state', (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent<string>).data) as {
          current?: TelephonyInstanceState | null;
        };
        if ('current' in payload) setTelephony(payload.current ?? null);
      } catch {
        setTelephonyLive('disconnected');
      }
    });
    return () => {
      cancelled = true;
      metricsSource.close();
      alertSource.close();
      window.clearInterval(telephonyFallbackTimer);
      telephonySource.close();
    };
  }, [selected?.id]);

  useEffect(() => {
    const handler = () => {
      const isFullscreen = document.fullscreenElement === rootRef.current;
      setFullscreen(isFullscreen);
      setControlsVisible(isFullscreen);
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
      if (isFullscreen) {
        hideTimer.current = window.setTimeout(() => setControlsVisible(false), 3000);
      }
    };
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  function showControls() {
    if (!fullscreen) return;
    setControlsVisible(true);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setControlsVisible(false), 3000);
  }

  const currentMetrics =
    metrics?.source?.health.freshness === 'CURRENT' ? (metrics.current ?? null) : null;
  const visibleFilesystems = (currentMetrics?.filesystems ?? []).filter(
    (filesystem) =>
      selectedFilesystemIds === null || selectedFilesystemIds.includes(filesystem.filesystemId),
  );

  if (profiles.length === 0)
    return (
      <Card.Root variant="outline">
        <Card.Body>{text.dashboardNoPbx}</Card.Body>
      </Card.Root>
    );

  return (
    <Box
      ref={rootRef}
      data-dashboard-root
      data-fullscreen-dashboard={fullscreen ? 'true' : 'false'}
      role={fullscreen ? 'region' : undefined}
      aria-label={fullscreen ? text.fullscreen : undefined}
      bg={fullscreen ? 'noc.canvas' : 'transparent'}
      minH={fullscreen ? '100dvh' : undefined}
      h={fullscreen ? '100dvh' : undefined}
      p={fullscreen ? { base: '2', md: '3', xl: '4' } : '0'}
      overflow={fullscreen ? 'hidden' : undefined}
      onMouseMove={showControls}
      onKeyDown={showControls}
      onFocusCapture={showControls}
    >
      <Stack gap={fullscreen ? '2' : '4'} h={fullscreen ? 'full' : undefined}>
        {!fullscreen ? (
          <Flex
            data-dashboard-toolbar
            align={{ base: 'stretch', xl: 'center' }}
            justify="space-between"
            direction={{ base: 'column', xl: 'row' }}
            gap="4"
            pb="1"
          >
            <Box minW="0">
              <Heading size="xl" color="noc.text" letterSpacing="-0.02em">
                {text.dashboardTitle}
              </Heading>
              <Text color="noc.textMuted" mt="1" fontSize="12px">
                {text.dashboardHint}
              </Text>
            </Box>
            <HStack gap="2" flexWrap="wrap" justify={{ base: 'flex-start', xl: 'flex-end' }}>
              <Box minW={{ base: '180px', md: '220px' }}>
                <NativeSelect.Root>
                  <NativeSelect.Field
                    aria-label={text.dashboardPbx}
                    value={selected?.id ?? ''}
                    onChange={(event) => chooseInstance(event.target.value)}
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
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (document.fullscreenElement) void document.exitFullscreen();
                  else if (rootRef.current?.requestFullscreen)
                    void rootRef.current.requestFullscreen();
                }}
              >
                {fullscreen ? text.exitFullscreen : text.fullscreen}
              </Button>
            </HStack>
          </Flex>
        ) : null}

        {fullscreen ? (
          <Button
            data-dashboard-fullscreen-exit
            aria-label={text.exitFullscreen}
            size="xs"
            variant="solid"
            position="fixed"
            top="3"
            right="3"
            zIndex="overlay"
            opacity={controlsVisible ? 0.9 : 0}
            pointerEvents={controlsVisible ? 'auto' : 'none'}
            transition="opacity 180ms ease"
            boxShadow="sm"
            onClick={() => {
              if (document.fullscreenElement) void document.exitFullscreen();
            }}
          >
            {text.exitFullscreen}
          </Button>
        ) : null}

        <OperatorOverview
          text={text}
          instanceId={selected?.id ?? ''}
          connection={connection}
          metrics={metrics}
          metricHistory={metricHistory}
          alerts={alerts}
          telephony={telephony}
          metricsLive={metricsLive}
          alertsLive={alertsLive}
          telephonyLive={telephonyLive}
          visibleFilesystems={visibleFilesystems}
          refreshRates={refreshRates}
          onNavigate={onNavigate}
          wallboard={fullscreen}
        />

        {error ? (
          <Box
            role="alert"
            borderWidth="1px"
            borderColor="red.200"
            bg="red.50"
            color="red.800"
            borderRadius="lg"
            p="3"
          >
            {error}
          </Box>
        ) : null}
      </Stack>
    </Box>
  );
}
