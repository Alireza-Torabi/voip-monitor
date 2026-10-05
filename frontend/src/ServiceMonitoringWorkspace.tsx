import {
  Badge,
  Box,
  Button,
  Card,
  Flex,
  Heading,
  NativeSelect,
  Stack,
  Text,
  Textarea,
} from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { api, ApiError, type PbxProfile } from './api.js';
import { messages, type Language } from './i18n.js';

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
    <Stack gap="5">
      <Flex
        align={{ base: 'stretch', md: 'end' }}
        justify="space-between"
        direction={{ base: 'column', md: 'row' }}
        gap="4"
      >
        <Box>
          <Heading size="lg">{text.serviceMonitoringTitle}</Heading>
          <Text color="fg.muted" mt="1">
            {text.serviceMonitoringHint}
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
              <Card.Title>{text.serviceMonitoringServices}</Card.Title>
              <Card.Description>{text.serviceMonitoringServicesHint}</Card.Description>
            </Box>
            <Badge colorPalette={serviceIds.length > 0 ? 'green' : 'gray'}>
              {serviceIds.length > 0
                ? serviceIds.length + ' ' + text.serviceMonitoringConfigured
                : text.serviceMonitoringNotConfigured}
            </Badge>
          </Flex>
        </Card.Header>
        <Card.Body gap="4">
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={8}
            dir="ltr"
            fontFamily="mono"
            placeholder={'asterisk.service\\nsshd.service'}
          />
          <Text fontSize="xs" color="fg.muted">
            {text.serviceMonitoringValidationHint}
          </Text>

          {status ? (
            <Box
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

          <Flex gap="2" flexWrap="wrap">
            <Button colorPalette="blue" disabled={pending || !selected} onClick={() => void save()}>
              {text.serviceMonitoringSave}
            </Button>
            <Button variant="outline" disabled={pending || !selected} onClick={() => void reset()}>
              {text.serviceMonitoringReset}
            </Button>
          </Flex>
        </Card.Body>
      </Card.Root>
    </Stack>
  );
}
