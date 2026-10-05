import {
  Badge,
  Box,
  Button,
  Card,
  Flex,
  Heading,
  HStack,
  Input,
  NativeSelect,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
} from '@chakra-ui/react';
import { useEffect, useState, type FormEvent } from 'react';
import {
  api,
  ApiError,
  type PbxProfile,
  type SafeSshConfiguration,
  type SshAuthMethod,
} from './api.js';
import { messages, type Language } from './i18n.js';

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
      setStatus(text.sshSaved);
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) onUnauthorized();
      else setError(text.sshSaveFailed);
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
    return (
      <Card.Root variant="outline">
        <Card.Body>{text.dashboardNoPbx}</Card.Body>
      </Card.Root>
    );
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
          <Heading size="xl">{text.sshMetricsTitle}</Heading>
          <Text color="fg.muted" mt="1">
            {text.sshMetricsHint}
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
          <Flex justify="space-between" align="center" gap="3" flexWrap="wrap">
            <Box>
              <Card.Title>{text.sshConfiguration}</Card.Title>
              <Card.Description>{text.sshWriteOnlyHint}</Card.Description>
            </Box>
            <Badge colorPalette={current?.hasCredential ? 'green' : 'gray'}>
              {current?.hasCredential ? text.sshConfigured : text.sshNotConfigured}
            </Badge>
          </Flex>
        </Card.Header>
        <Card.Body>
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

              <Box>
                <Text fontSize="sm" fontWeight="semibold" mb="1.5">
                  {text.sshFingerprint}
                </Text>
                <Input
                  name="ssh-fingerprint"
                  value={form.hostKeyFingerprint}
                  onChange={(event) => setForm({ ...form, hostKeyFingerprint: event.target.value })}
                  placeholder="SHA256:..."
                  required
                  dir="ltr"
                />
                <Text fontSize="xs" color="fg.muted" mt="1.5">
                  {text.sshFingerprintHint}
                </Text>
              </Box>

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

              <Card.Root variant="subtle" bg="blue.50">
                <Card.Body gap="1">
                  <Text fontWeight="semibold">{text.sshNoProbeTitle}</Text>
                  <Text fontSize="sm" color="fg.muted">
                    {text.sshNoProbeHint}
                  </Text>
                </Card.Body>
              </Card.Root>

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

              <HStack gap="2" flexWrap="wrap">
                <Button type="submit" colorPalette="blue" disabled={pending}>
                  {text.sshSave}
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
        </Card.Body>
      </Card.Root>
    </Stack>
  );
}
