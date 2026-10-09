import { Box, Flex, Stack, Text, Textarea } from '@chakra-ui/react';
import { HelpButton as Button } from './ContextHelp.js';
import { useEffect, useState } from 'react';
import { api, ApiError, type PbxProfile } from './api.js';
import { messages, type Language } from './i18n.js';
import { NocPanel, SectionHeader, StatusIndicator } from './NocPrimitives.js';
import {
  WorkspaceField,
  WorkspaceHeader,
  WorkspaceSelect,
  WorkspaceState,
  WorkspaceToolbar,
} from './WorkspacePrimitives.js';

type TextMap = (typeof messages)[Language];

export function ServiceMonitoringWorkspace({
  text,
  profiles,
  onUnauthorized,
}: {
  text: TextMap;
  profiles: PbxProfile[];
  onUnauthorized: () => void;
}) {
  const [selectedId, setSelectedId] = useState(profiles[0]?.id ?? '');
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const selected = profiles.find((profile) => profile.id === selectedId) ?? profiles[0];

  useEffect(() => {
    if (!selected && profiles.length > 0) setSelectedId(profiles[0]?.id ?? '');
  }, [profiles, selected]);

  async function load(instanceId = selected?.id) {
    if (!instanceId) return;
    setPending(true);
    setError('');
    setStatus('');
    try {
      const value = await api.serviceMonitoring(instanceId);
      setServiceIds(value.serviceIds);
      setDraft(value.serviceIds.join('\n'));
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) onUnauthorized();
      else setError(text.serviceMonitoringLoadFailed);
    } finally {
      setPending(false);
    }
  }

  useEffect(() => {
    void load(selected?.id);
  }, [selected?.id]);

  async function save() {
    if (!selected) return;
    const values = draft
      .split(/\r?\n/)
      .map((value) => value.trim())
      .filter(Boolean);
    setPending(true);
    setError('');
    setStatus('');
    try {
      const saved = await api.putServiceMonitoring(selected.id, values);
      setServiceIds(saved.serviceIds);
      setDraft(saved.serviceIds.join('\n'));
      setStatus(text.serviceMonitoringSaved);
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) onUnauthorized();
      else setError(text.serviceMonitoringSaveFailed);
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
      await api.resetServiceMonitoring(selected.id);
      setServiceIds([]);
      setDraft('');
      setStatus(text.serviceMonitoringResetDone);
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) onUnauthorized();
      else setError(text.serviceMonitoringSaveFailed);
    } finally {
      setPending(false);
    }
  }

  return (
    <Stack gap="4" data-workspace="service-monitoring">
      <WorkspaceHeader
        title={text.serviceMonitoringTitle}
        description={text.serviceMonitoringHint}
      />

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
        <Box flex="1 1 220px" minW="220px">
          <Text
            fontSize="10px"
            color="noc.textSubtle"
            fontWeight="700"
            letterSpacing=".05em"
            textTransform="uppercase"
            mb="1.5"
          >
            {text.serviceMonitoringServices}
          </Text>
          <StatusIndicator
            tone={serviceIds.length > 0 ? 'healthy' : 'unknown'}
            label={
              serviceIds.length > 0
                ? serviceIds.length + ' ' + text.serviceMonitoringConfigured
                : text.serviceMonitoringNotConfigured
            }
          />
        </Box>
      </WorkspaceToolbar>

      <NocPanel p="4">
        <SectionHeader
          title={text.serviceMonitoringServices}
          description={text.serviceMonitoringServicesHint}
        />
        <Stack gap="4" mt="4">
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={9}
            dir="ltr"
            fontFamily="mono"
            placeholder={'asterisk.service\\nsshd.service'}
            bg="noc.surface2"
            borderColor="noc.border"
            borderRadius="nocControl"
            fontSize="12px"
          />
          <Text fontSize="10px" color="noc.textSubtle">
            {text.serviceMonitoringValidationHint}
          </Text>

          {status ? <WorkspaceState tone="healthy" title={status} role="status" /> : null}
          {error ? <WorkspaceState tone="critical" title={error} role="alert" /> : null}

          <Flex gap="2" flexWrap="wrap">
            <Button
              size="sm"
              colorPalette="blue"
              disabled={pending || !selected}
              onClick={() => void save()}
            >
              {text.serviceMonitoringSave}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pending || !selected}
              onClick={() => void reset()}
            >
              {text.serviceMonitoringReset}
            </Button>
          </Flex>
        </Stack>
      </NocPanel>
    </Stack>
  );
}
