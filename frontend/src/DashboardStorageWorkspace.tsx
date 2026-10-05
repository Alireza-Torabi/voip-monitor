import {
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  Flex,
  Heading,
  NativeSelect,
  SimpleGrid,
  Stack,
  Text,
} from '@chakra-ui/react';
import { useEffect, useMemo, useState } from 'react';
import { api, ApiError, type PbxProfile, type SystemMetricsSample } from './api.js';
import { messages, type Language } from './i18n.js';

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
    <Stack gap="5">
      <Flex
        align={{ base: 'stretch', md: 'end' }}
        justify="space-between"
        direction={{ base: 'column', md: 'row' }}
        gap="4"
      >
        <Box>
          <Heading size="lg">{text.dashboardStorageTitle}</Heading>
          <Text color="fg.muted" mt="1">
            {text.dashboardStorageHint}
          </Text>
        </Box>
        <Box minW={{ base: '100%', md: '280px' }}>
          <Text fontSize="sm" fontWeight="semibold" mb="1.5">
            {text.dashboardPbx}
          </Text>
          <NativeSelect.Root>
            <NativeSelect.Field
              value={selected?.id ?? ''}
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
        <Card.Header>
          <Flex justify="space-between" align="start" gap="3" flexWrap="wrap">
            <Box>
              <Card.Title>{text.dashboardStorageAvailable}</Card.Title>
              <Card.Description>{text.dashboardStorageAvailableHint}</Card.Description>
            </Box>
            <Badge colorPalette={selection === null ? 'gray' : 'blue'}>
              {selection === null ? text.dashboardStorageDefaultAll : text.dashboardStorageCustom}
            </Badge>
          </Flex>
        </Card.Header>
        <Card.Body>
          {filesystems.length === 0 ? (
            <Text color="fg.muted">{text.storageNoData}</Text>
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
                    borderRadius="lg"
                    p="3"
                    alignItems="start"
                  >
                    <Checkbox.HiddenInput />
                    <Checkbox.Control mt="0.5">
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                    <Checkbox.Label flex="1">
                      <Stack gap="0.5">
                        <Text fontWeight="semibold" dir="ltr" overflowWrap="anywhere">
                          {filesystem.mountPoint}
                        </Text>
                        <Text fontSize="xs" color="fg.muted" dir="ltr" overflowWrap="anywhere">
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
            <Box
              mt="4"
              borderWidth="1px"
              borderColor="orange.200"
              bg="orange.50"
              borderRadius="lg"
              p="3"
            >
              <Text fontSize="sm" fontWeight="semibold">
                {text.dashboardStorageMissingTitle}
              </Text>
              <Text fontSize="xs" color="fg.muted" mt="1" dir="ltr">
                {missingSelected.join(', ')}
              </Text>
            </Box>
          ) : null}

          {status ? (
            <Box
              mt="4"
              role="status"
              borderWidth="1px"
              borderColor="green.200"
              bg="green.50"
              color="green.800"
              borderRadius="lg"
              p="3"
            >
              {status}
            </Box>
          ) : null}
          {error ? (
            <Box
              mt="4"
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

          <Flex mt="4" gap="2" flexWrap="wrap">
            <Button colorPalette="blue" disabled={pending || !selected} onClick={() => void save()}>
              {text.dashboardStorageSave}
            </Button>
            <Button variant="outline" disabled={pending || !selected} onClick={() => void reset()}>
              {text.dashboardStorageReset}
            </Button>
          </Flex>
        </Card.Body>
      </Card.Root>
    </Stack>
  );
}
