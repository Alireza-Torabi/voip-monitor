import { Box, Checkbox, Flex, SimpleGrid, Stack, Text } from '@chakra-ui/react';
import { HelpButton as Button } from './ContextHelp.js';
import { useEffect, useMemo, useState } from 'react';
import { api, ApiError, type PbxProfile, type SystemMetricsSample } from './api.js';
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

export function DashboardStorageWorkspace({
  text,
  profiles,
  onUnauthorized,
}: {
  text: TextMap;
  profiles: PbxProfile[];
  onUnauthorized: () => void;
}) {
  const [selectedId, setSelectedId] = useState(profiles[0]?.id ?? '');
  const [filesystems, setFilesystems] = useState<NonNullable<SystemMetricsSample['filesystems']>>(
    [],
  );
  const [selection, setSelection] = useState<string[] | null>(null);
  const [draft, setDraft] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  const selected = profiles.find((profile) => profile.id === selectedId) ?? profiles[0];

  useEffect(() => {
    if (!selected && profiles.length > 0) setSelectedId(profiles[0]?.id ?? '');
  }, [profiles, selected]);

  async function load(instanceId = selected?.id) {
    if (!instanceId) {
      setFilesystems([]);
      setSelection(null);
      setDraft([]);
      return;
    }
    setPending(true);
    setError('');
    setStatus('');
    try {
      const [metrics, config] = await Promise.all([
        api.systemMetrics(instanceId),
        api.dashboardStorage(instanceId),
      ]);
      const currentFilesystems = metrics.current?.filesystems ?? [];
      setFilesystems(currentFilesystems);
      setSelection(config.selectedFilesystemIds);
      setDraft(
        config.selectedFilesystemIds ??
          currentFilesystems.map((filesystem) => filesystem.filesystemId),
      );
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) onUnauthorized();
      else setError(text.dashboardStorageLoadFailed);
    } finally {
      setPending(false);
    }
  }

  useEffect(() => {
    void load(selected?.id);
  }, [selected?.id]);

  const knownIds = useMemo(
    () => new Set(filesystems.map((filesystem) => filesystem.filesystemId)),
    [filesystems],
  );
  const missingSelected = draft.filter((id) => !knownIds.has(id));

  function toggle(id: string, checked: boolean) {
    setDraft((current) =>
      checked ? [...new Set([...current, id])] : current.filter((value) => value !== id),
    );
  }

  async function save() {
    if (!selected) return;
    setPending(true);
    setError('');
    setStatus('');
    try {
      const saved = await api.putDashboardStorage(selected.id, draft);
      setSelection(saved.selectedFilesystemIds);
      setStatus(text.dashboardStorageSaved);
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) onUnauthorized();
      else setError(text.dashboardStorageSaveFailed);
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
      await api.resetDashboardStorage(selected.id);
      setSelection(null);
      setDraft(filesystems.map((filesystem) => filesystem.filesystemId));
      setStatus(text.dashboardStorageResetDone);
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) onUnauthorized();
      else setError(text.dashboardStorageSaveFailed);
    } finally {
      setPending(false);
    }
  }

  return (
    <Stack gap="4" data-workspace="dashboard-storage">
      <WorkspaceHeader title={text.dashboardStorageTitle} description={text.dashboardStorageHint} />

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
            {text.dashboardStorageAvailable}
          </Text>
          <StatusIndicator
            tone={selection === null ? 'unknown' : 'info'}
            label={
              selection === null ? text.dashboardStorageDefaultAll : text.dashboardStorageCustom
            }
          />
        </Box>
      </WorkspaceToolbar>

      <NocPanel p="4" data-dashboard-storage-settings>
        <SectionHeader
          title={text.dashboardStorageAvailable}
          description={text.dashboardStorageAvailableHint}
        />
        <Box mt="4">
          {filesystems.length === 0 ? (
            <WorkspaceState title={text.storageNoData} />
          ) : (
            <SimpleGrid columns={{ base: 1, md: 2 }} gap="3">
              {filesystems.map((filesystem) => {
                const checked = draft.includes(filesystem.filesystemId);
                return (
                  <Checkbox.Root
                    key={filesystem.filesystemId}
                    data-storage-option={filesystem.filesystemId}
                    checked={checked}
                    onCheckedChange={(details) =>
                      toggle(filesystem.filesystemId, details.checked === true)
                    }
                    borderWidth="1px"
                    borderColor={checked ? 'noc.borderStrong' : 'noc.border'}
                    bg={checked ? 'rgba(45,140,255,.08)' : 'noc.surface2'}
                    borderRadius="nocControl"
                    p="3"
                    alignItems="start"
                    _hover={{ borderColor: 'noc.borderStrong' }}
                  >
                    <Checkbox.HiddenInput />
                    <Checkbox.Control mt="0.5">
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                    <Checkbox.Label flex="1">
                      <Stack gap="0.5">
                        <Text
                          fontWeight="600"
                          fontSize="12px"
                          color="noc.text"
                          dir="ltr"
                          overflowWrap="anywhere"
                        >
                          {filesystem.mountPoint}
                        </Text>
                        <Text
                          fontSize="10px"
                          color="noc.textSubtle"
                          dir="ltr"
                          overflowWrap="anywhere"
                        >
                          {filesystem.filesystemId}
                        </Text>
                      </Stack>
                    </Checkbox.Label>
                  </Checkbox.Root>
                );
              })}
            </SimpleGrid>
          )}

          {missingSelected.length > 0 ? (
            <NocInset mt="4" p="3" borderColor="noc.warning">
              <StatusIndicator tone="warning" label={text.dashboardStorageMissingTitle} />
              <Text fontSize="10px" color="noc.textMuted" mt="2" dir="ltr">
                {missingSelected.join(', ')}
              </Text>
            </NocInset>
          ) : null}

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
                {text.dashboardStorageSave}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={pending || !selected}
                onClick={() => void reset()}
              >
                {text.dashboardStorageReset}
              </Button>
            </Flex>
          </Stack>
        </Box>
      </NocPanel>
    </Stack>
  );
}
