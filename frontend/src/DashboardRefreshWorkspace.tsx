import { Button, Flex, SimpleGrid, Stack, Text } from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import {
  DASHBOARD_REFRESH_RATE_OPTIONS,
  DEFAULT_DASHBOARD_REFRESH_RATES,
  type DashboardRefreshRates,
} from '@voip-monitor/shared';
import { api, ApiError, type PbxProfile } from './api.js';
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

export function DashboardRefreshWorkspace({
  text,
  profiles,
  onUnauthorized,
}: {
  text: TextMap;
  profiles: PbxProfile[];
  onUnauthorized: () => void;
}) {
  const [selectedId, setSelectedId] = useState(profiles[0]?.id ?? '');
  const [savedRates, setSavedRates] = useState<DashboardRefreshRates>(
    DEFAULT_DASHBOARD_REFRESH_RATES,
  );
  const [draft, setDraft] = useState<DashboardRefreshRates>(DEFAULT_DASHBOARD_REFRESH_RATES);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  const selected = profiles.find((profile) => profile.id === selectedId) ?? profiles[0];

  useEffect(() => {
    if (!selected && profiles.length > 0) setSelectedId(profiles[0]?.id ?? '');
  }, [profiles, selected]);

  async function load(instanceId = selected?.id) {
    if (!instanceId) {
      setSavedRates(DEFAULT_DASHBOARD_REFRESH_RATES);
      setDraft(DEFAULT_DASHBOARD_REFRESH_RATES);
      return;
    }
    setPending(true);
    setError('');
    setStatus('');
    try {
      const value = await api.dashboardRefresh(instanceId);
      setSavedRates(value.rates);
      setDraft(value.rates);
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) onUnauthorized();
      else setError(text.dashboardRefreshLoadFailed);
    } finally {
      setPending(false);
    }
  }

  useEffect(() => {
    void load(selected?.id);
  }, [selected?.id]);

  async function save() {
    if (!selected) return;
    setPending(true);
    setError('');
    setStatus('');
    try {
      const saved = await api.putDashboardRefresh(selected.id, draft);
      setSavedRates(saved.rates);
      setDraft(saved.rates);
      setStatus(text.dashboardRefreshSaved);
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) onUnauthorized();
      else setError(text.dashboardRefreshSaveFailed);
    } finally {
      setPending(false);
    }
  }

  async function reset() {
    if (!selected) return;
    setPending(true);
    setError('');
    setStatus('');
    try {
      const saved = await api.resetDashboardRefresh(selected.id);
      setSavedRates(saved.rates);
      setDraft(saved.rates);
      setStatus(text.dashboardRefreshResetDone);
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) onUnauthorized();
      else setError(text.dashboardRefreshSaveFailed);
    } finally {
      setPending(false);
    }
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(savedRates);

  return (
    <Stack gap="4" data-workspace="dashboard-refresh">
      <WorkspaceHeader title={text.dashboardRefreshTitle} description={text.dashboardRefreshHint} />

      <WorkspaceToolbar>
        <WorkspaceField label={text.dashboardPbx}>
          <WorkspaceSelect
            value={selected?.id ?? ''}
            onChange={setSelectedId}
            ariaLabel={text.dashboardPbx}
          >
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.displayName}
              </option>
            ))}
          </WorkspaceSelect>
        </WorkspaceField>
        <StatusIndicator
          tone={dirty ? 'warning' : 'healthy'}
          label={dirty ? text.dashboardRefreshUnsavedState : text.dashboardRefreshSavedState}
        />
      </WorkspaceToolbar>

      <NocPanel p="4" data-dashboard-refresh-settings>
        <SectionHeader
          title={text.dashboardRefreshTitle}
          description={text.dashboardRefreshSoftHint}
        />
        <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} gap="3" mt="4">
          {(
            [
              ['activeCallsMs', text.dashboardRefreshActiveCalls],
              ['endpointsMs', text.dashboardRefreshEndpoints],
              ['queuesMs', text.dashboardRefreshQueues],
              ['problemsMs', text.dashboardRefreshProblems],
              ['cpuMemoryMs', text.dashboardRefreshCpuMemory],
              ['storageMs', text.dashboardRefreshStorage],
              ['servicesMs', text.dashboardRefreshServices],
            ] as const
          ).map(([key, label]) => (
            <WorkspaceField key={key} label={label}>
              <Flex
                gap="1.5"
                flexWrap="wrap"
                role="group"
                aria-label={label}
                data-dashboard-cadence-control={key}
              >
                {DASHBOARD_REFRESH_RATE_OPTIONS.map((value) => {
                  const selected = draft[key] === value;
                  return (
                    <Button
                      key={value}
                      type="button"
                      size="xs"
                      minW="48px"
                      variant={selected ? 'solid' : 'outline'}
                      colorPalette={selected ? 'blue' : 'gray'}
                      aria-pressed={selected}
                      disabled={pending || !selectedId}
                      onClick={() => setDraft((current) => ({ ...current, [key]: value }))}
                    >
                      {value < 1000 ? `${value} ms` : `${value / 1000} s`}
                    </Button>
                  );
                })}
              </Flex>
            </WorkspaceField>
          ))}
        </SimpleGrid>
        <NocInset mt="4" p="3">
          <Text fontSize="11px" color="noc.textMuted">
            {text.dashboardRefreshHint}
          </Text>
        </NocInset>
        <Stack gap="3" mt="4">
          {status ? <WorkspaceState tone="healthy" title={status} role="status" /> : null}
          {error ? <WorkspaceState tone="critical" title={error} role="alert" /> : null}
          <Flex gap="2" flexWrap="wrap">
            <Button
              size="sm"
              colorPalette="blue"
              disabled={pending || !selected}
              onClick={() => void save()}
            >
              {text.dashboardRefreshSave}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pending || !selected}
              onClick={() => void reset()}
            >
              {text.dashboardRefreshReset}
            </Button>
          </Flex>
        </Stack>
      </NocPanel>
    </Stack>
  );
}
