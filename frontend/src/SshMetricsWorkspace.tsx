import {
  Badge,
  Box,
  Flex,
  HStack,
  Input,
  NativeSelect,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
} from '@chakra-ui/react';
import { HelpButton as Button } from './ContextHelp.js';
import { useEffect, useState, type FormEvent } from 'react';
import {
  api,
  ApiError,
  type PbxProfile,
  type SafeSshConfiguration,
  type SshAuthMethod,
} from './api.js';
import { messages, type Language } from './i18n.js';
import { NocInset, NocPanel, StatusIndicator } from './NocPrimitives.js';
import {
  WorkspaceField,
  WorkspaceHeader,
  WorkspaceSelect,
  WorkspaceState,
  WorkspaceToolbar,
} from './WorkspacePrimitives.js';

type TextMap = (typeof messages)[Language];

function emptyForm() {
  return {
    host: '',
    port: '22',
    username: '',
    authMethod: 'PASSWORD' as SshAuthMethod,
    credential: '',
    keyPassphrase: '',
    hostKeyFingerprint: '',
  };
}

function sshVerificationMessage(text: TextMap, failure: unknown): string {
  if (!(failure instanceof ApiError)) return text.sshVerifyFailed;
  if (failure.code === 'ssh_host_key_mismatch') return text.sshHostKeyMismatch;
  if (failure.code === 'ssh_authentication_failed') return text.sshAuthenticationFailed;
  if (failure.code === 'ssh_timeout') return text.sshVerifyTimeout;
  if (failure.code === 'ssh_target_blocked') return text.sshTargetBlocked;
  if (failure.code === 'ssh_connection_failed') return text.sshConnectionFailed;
  return text.sshVerifyFailed;
}

export function SshMetricsWorkspace({
  text,
  profiles,
  onUnauthorized,
}: {
  text: TextMap;
  profiles: PbxProfile[];
  onUnauthorized: () => void;
}) {
  const [selectedId, setSelectedId] = useState(profiles[0]?.id ?? '');
  const [current, setCurrent] = useState<SafeSshConfiguration | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [pending, setPending] = useState(false);

  const selected = profiles.find((profile) => profile.id === selectedId) ?? profiles[0];

  useEffect(() => {
    if (!selected && profiles.length > 0) setSelectedId(profiles[0]?.id ?? '');
  }, [profiles, selected]);

  async function load(id = selected?.id) {
    if (!id) {
      setCurrent(null);
      setForm(emptyForm());
      return;
    }
    setPending(true);
    setError('');
    setStatus('');
    try {
      const value = await api.sshConfiguration(id);
      setCurrent(value);
      setForm({
        host: value.host,
        port: String(value.port),
        username: value.username,
        authMethod: value.authMethod,
        credential: '',
        keyPassphrase: '',
        hostKeyFingerprint: value.hostKeyFingerprint,
      });
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) {
        onUnauthorized();
      } else if (failure instanceof ApiError && failure.status === 404) {
        setCurrent(null);
        setForm(emptyForm());
      } else {
        setError(text.sshLoadFailed);
      }
    } finally {
      setPending(false);
    }
  }

  useEffect(() => {
    void load(selected?.id);
  }, [selected?.id]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setPending(true);
    setError('');
    setStatus('');
    try {
      const payload =
        form.authMethod === 'PASSWORD'
          ? {
              host: form.host,
              port: Number(form.port),
              username: form.username,
              authMethod: 'PASSWORD' as const,
              credential: form.credential,
              hostKeyPolicy: 'PINNED_SHA256' as const,
              hostKeyFingerprint: form.hostKeyFingerprint,
            }
          : {
              host: form.host,
              port: Number(form.port),
              username: form.username,
              authMethod: 'PRIVATE_KEY' as const,
              credential: form.credential,
              ...(form.keyPassphrase ? { keyPassphrase: form.keyPassphrase } : {}),
              hostKeyPolicy: 'PINNED_SHA256' as const,
              hostKeyFingerprint: form.hostKeyFingerprint,
            };
      const value = await api.putSshConfiguration(selected.id, payload);
      setCurrent(value);
      setForm((existing) => ({
        ...existing,
        credential: '',
        keyPassphrase: '',
      }));
      setStatus(text.sshVerifiedAndSaved);
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) onUnauthorized();
      else setError(sshVerificationMessage(text, failure));
    } finally {
      setPending(false);
    }
  }

  async function remove() {
    if (!selected) return;
    setPending(true);
    setError('');
    setStatus('');
    try {
      await api.deleteSshConfiguration(selected.id);
      setCurrent(null);
      setForm(emptyForm());
      setStatus(text.sshRemoved);
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) onUnauthorized();
      else setError(text.sshRemoveFailed);
    } finally {
      setPending(false);
    }
  }

  if (profiles.length === 0) {
    return <WorkspaceState title={text.dashboardNoPbx} />;
  }

  return (
    <Stack gap="4" data-workspace="sshmetrics">
      <WorkspaceHeader title={text.sshMetricsTitle} description={text.sshMetricsHint} />
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
            {text.sshMetricsTitle}
          </Text>
          <StatusIndicator
            tone={
              current?.lastVerifiedAt ? 'healthy' : current?.hasCredential ? 'warning' : 'unknown'
            }
            label={
              current?.lastVerifiedAt
                ? text.sshConfigured
                : current?.hasCredential
                  ? text.sshUnverified
                  : text.sshNotConfigured
            }
          />
        </Box>
      </WorkspaceToolbar>

      <NocPanel p="4">
        <Box>
          <Flex justify="space-between" align="center" gap="3" flexWrap="wrap">
            <Box>
              <Text fontSize="14px" fontWeight="600" color="noc.text">
                {text.sshConfiguration}
              </Text>
              <Text fontSize="11px" color="noc.textMuted" mt="1">
                {text.sshWriteOnlyHint}
              </Text>
            </Box>
            <Badge
              colorPalette={
                current?.lastVerifiedAt ? 'green' : current?.hasCredential ? 'yellow' : 'gray'
              }
            >
              {current?.lastVerifiedAt
                ? text.sshConfigured
                : current?.hasCredential
                  ? text.sshUnverified
                  : text.sshNotConfigured}
            </Badge>
          </Flex>
        </Box>
        <Box mt="4">
          <form onSubmit={(event) => void save(event)} autoComplete="off">
            <Stack gap="4">
              <SimpleGrid columns={{ base: 1, md: 2 }} gap="4">
                <Box>
                  <Text fontSize="sm" fontWeight="semibold" mb="1.5">
                    {text.sshHost}
                  </Text>
                  <Input
                    name="ssh-host"
                    value={form.host}
                    onChange={(event) => setForm({ ...form, host: event.target.value })}
                    required
                    dir="ltr"
                  />
                </Box>
                <Box>
                  <Text fontSize="sm" fontWeight="semibold" mb="1.5">
                    {text.sshPort}
                  </Text>
                  <Input
                    name="ssh-port"
                    type="number"
                    min={1}
                    max={65535}
                    value={form.port}
                    onChange={(event) => setForm({ ...form, port: event.target.value })}
                    required
                    dir="ltr"
                  />
                </Box>
                <Box>
                  <Text fontSize="sm" fontWeight="semibold" mb="1.5">
                    {text.sshUsername}
                  </Text>
                  <Input
                    name="ssh-username"
                    value={form.username}
                    onChange={(event) => setForm({ ...form, username: event.target.value })}
                    required
                    autoComplete="off"
                    dir="ltr"
                  />
                </Box>
                <Box>
                  <Text fontSize="sm" fontWeight="semibold" mb="1.5">
                    {text.sshAuthMethod}
                  </Text>
                  <NativeSelect.Root>
                    <NativeSelect.Field
                      name="ssh-auth-method"
                      value={form.authMethod}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          authMethod: event.target.value as SshAuthMethod,
                          credential: '',
                          keyPassphrase: '',
                        })
                      }
                    >
                      <option value="PASSWORD">{text.sshPassword}</option>
                      <option value="PRIVATE_KEY">{text.sshPrivateKey}</option>
                    </NativeSelect.Field>
                    <NativeSelect.Indicator />
                  </NativeSelect.Root>
                </Box>
              </SimpleGrid>

              <NocInset p="3">
                <Flex align="center" justify="space-between" gap="3" mb="2">
                  <Text fontSize="sm" fontWeight="700" color="noc.text">
                    {text.sshFingerprint}
                  </Text>
                  <StatusIndicator tone="warning" label={text.sshTrustAnchor} />
                </Flex>
                <Input
                  name="ssh-fingerprint"
                  value={form.hostKeyFingerprint}
                  onChange={(event) => setForm({ ...form, hostKeyFingerprint: event.target.value })}
                  placeholder="SHA256:..."
                  required
                  dir="ltr"
                />
                <Text fontSize="xs" color="noc.textMuted" mt="1.5">
                  {text.sshFingerprintHint}
                </Text>
              </NocInset>

              <Box>
                <Text fontSize="sm" fontWeight="semibold" mb="1.5">
                  {form.authMethod === 'PASSWORD' ? text.sshPassword : text.sshPrivateKey}
                </Text>
                {form.authMethod === 'PASSWORD' ? (
                  <Input
                    name="ssh-credential"
                    type="password"
                    value={form.credential}
                    onChange={(event) => setForm({ ...form, credential: event.target.value })}
                    required
                    autoComplete="new-password"
                    dir="ltr"
                  />
                ) : (
                  <Textarea
                    name="ssh-credential"
                    value={form.credential}
                    onChange={(event) => setForm({ ...form, credential: event.target.value })}
                    required
                    rows={8}
                    fontFamily="mono"
                    dir="ltr"
                  />
                )}
              </Box>

              {form.authMethod === 'PRIVATE_KEY' ? (
                <Box>
                  <Text fontSize="sm" fontWeight="semibold" mb="1.5">
                    {text.sshKeyPassphrase}
                  </Text>
                  <Input
                    name="ssh-key-passphrase"
                    type="password"
                    value={form.keyPassphrase}
                    onChange={(event) => setForm({ ...form, keyPassphrase: event.target.value })}
                    autoComplete="new-password"
                    dir="ltr"
                  />
                </Box>
              ) : null}

              <NocInset p="3">
                <StatusIndicator tone="info" label={text.sshVerificationRequiredTitle} />
                <Text fontSize="11px" color="noc.textMuted" mt="2">
                  {text.sshVerificationRequiredHint}
                </Text>
              </NocInset>

              {status ? <WorkspaceState tone="healthy" title={status} role="status" /> : null}
              {error ? <WorkspaceState tone="critical" title={error} role="alert" /> : null}

              <HStack gap="2" flexWrap="wrap">
                <Button type="submit" colorPalette="blue" disabled={pending}>
                  {pending ? text.sshVerifying : text.sshVerifyAndSave}
                </Button>
                {current ? (
                  <Button
                    type="button"
                    variant="outline"
                    colorPalette="red"
                    disabled={pending}
                    onClick={() => void remove()}
                  >
                    {text.sshRemove}
                  </Button>
                ) : null}
              </HStack>
            </Stack>
          </form>
        </Box>
      </NocPanel>
    </Stack>
  );
}
