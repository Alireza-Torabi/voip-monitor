import {
  Badge,
  Box,
  Button,
  Flex,
  HStack,
  Input,
  NativeSelect,
  SimpleGrid,
  Stack,
  Text,
} from '@chakra-ui/react';
import { useEffect, useState, type FormEvent } from 'react';
import {
  api,
  ApiError,
  type DatabaseDialect,
  type DatabaseTlsMode,
  type PbxProfile,
  type SafeDatabaseSourceConfiguration,
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
    dialect: 'MYSQL_MARIADB' as DatabaseDialect,
    host: '',
    port: '3306',
    databaseName: '',
    username: '',
    credential: '',
    tlsMode: 'REQUIRED' as DatabaseTlsMode,
  };
}

export function DatabaseSourceWorkspace({
  text,
  profiles,
  onUnauthorized,
}: {
  text: TextMap;
  profiles: PbxProfile[];
  onUnauthorized: () => void;
}) {
  const [selectedId, setSelectedId] = useState(profiles[0]?.id ?? '');
  const [current, setCurrent] = useState<SafeDatabaseSourceConfiguration | null>(null);
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
      const value = await api.databaseSource(id);
      setCurrent(value);
      setForm({
        dialect: value.dialect,
        host: value.host,
        port: String(value.port),
        databaseName: value.databaseName,
        username: value.username,
        credential: '',
        tlsMode: value.tlsMode,
      });
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) onUnauthorized();
      else if (failure instanceof ApiError && failure.status === 404) {
        setCurrent(null);
        setForm(emptyForm());
      } else setError(text.databaseSourceLoadFailed);
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
      const value = await api.putDatabaseSource(selected.id, {
        dialect: form.dialect,
        host: form.host,
        port: Number(form.port),
        databaseName: form.databaseName,
        username: form.username,
        credential: form.credential,
        accessMode: 'READ_ONLY',
        tlsMode: form.tlsMode,
      });
      setCurrent(value);
      setForm((existing) => ({ ...existing, credential: '' }));
      setStatus(text.databaseSourceSaved);
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) onUnauthorized();
      else if (failure instanceof ApiError && failure.code === 'database_backoff_active')
        setError(text.databaseSourceBackoffActive);
      else if (failure instanceof ApiError && failure.code === 'database_verification_timeout')
        setError(text.databaseSourceVerificationTimeout);
      else if (failure instanceof ApiError && failure.code === 'database_permission_denied')
        setError(text.databaseSourcePermissionDenied);
      else if (failure instanceof ApiError && failure.code === 'database_authentication_failed')
        setError(text.databaseSourceAuthenticationFailed);
      else if (failure instanceof ApiError && failure.code === 'database_not_found')
        setError(text.databaseSourceDatabaseNotFound);
      else if (failure instanceof ApiError && failure.code === 'database_host_blocked')
        setError(text.databaseSourceHostBlocked);
      else if (failure instanceof ApiError && failure.code === 'database_tls_failed')
        setError(text.databaseSourceTlsFailed);
      else if (failure instanceof ApiError && failure.code === 'database_verification_failed')
        setError(text.databaseSourceVerificationFailed);
      else setError(text.databaseSourceSaveFailed);
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
      await api.deleteDatabaseSource(selected.id);
      setCurrent(null);
      setForm(emptyForm());
      setStatus(text.databaseSourceRemoved);
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) onUnauthorized();
      else setError(text.databaseSourceRemoveFailed);
    } finally {
      setPending(false);
    }
  }

  if (profiles.length === 0) {
    return <WorkspaceState title={text.dashboardNoPbx} />;
  }

  return (
    <Stack gap="4" data-workspace="databasesource">
      <WorkspaceHeader title={text.databaseSourceTitle} description={text.databaseSourceHint} />
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
            {text.databaseSourceTitle}
          </Text>
          <StatusIndicator
            tone={current?.hasCredential ? 'healthy' : 'unknown'}
            label={
              current?.hasCredential
                ? text.databaseSourceConfigured
                : text.databaseSourceNotConfigured
            }
          />
        </Box>
      </WorkspaceToolbar>

      <NocPanel p="4">
        <Box>
          <Flex justify="space-between" align="center" gap="3" flexWrap="wrap">
            <Box>
              <Text fontSize="14px" fontWeight="600" color="noc.text">
                {text.databaseSourceConfiguration}
              </Text>
              <Text fontSize="11px" color="noc.textMuted" mt="1">
                {text.databaseSourceWriteOnlyHint}
              </Text>
            </Box>
            <Badge colorPalette={current?.hasCredential ? 'green' : 'gray'}>
              {current?.hasCredential
                ? text.databaseSourceConfigured
                : text.databaseSourceNotConfigured}
            </Badge>
          </Flex>
        </Box>
        <Box mt="4">
          <form onSubmit={(event) => void save(event)} autoComplete="off">
            <Stack gap="4">
              <SimpleGrid columns={{ base: 1, md: 2 }} gap="4">
                <Box>
                  <Text fontSize="sm" fontWeight="semibold" mb="1.5">
                    {text.databaseSourceDialect}
                  </Text>
                  <NativeSelect.Root>
                    <NativeSelect.Field
                      name="database-dialect"
                      value={form.dialect}
                      onChange={(event) => {
                        const dialect = event.target.value as DatabaseDialect;
                        setForm({
                          ...form,
                          dialect,
                          port: dialect === 'POSTGRESQL' ? '5432' : '3306',
                        });
                      }}
                    >
                      <option value="MYSQL_MARIADB">MySQL / MariaDB</option>
                      <option value="POSTGRESQL">PostgreSQL</option>
                    </NativeSelect.Field>
                    <NativeSelect.Indicator />
                  </NativeSelect.Root>
                </Box>
                <Box>
                  <Text fontSize="sm" fontWeight="semibold" mb="1.5">
                    {text.databaseSourceTlsMode}
                  </Text>
                  <NativeSelect.Root>
                    <NativeSelect.Field
                      name="database-tls-mode"
                      value={form.tlsMode}
                      onChange={(event) =>
                        setForm({ ...form, tlsMode: event.target.value as DatabaseTlsMode })
                      }
                    >
                      <option value="REQUIRED">{text.databaseSourceTlsRequired}</option>
                      <option value="DISABLED">{text.databaseSourceTlsDisabled}</option>
                    </NativeSelect.Field>
                    <NativeSelect.Indicator />
                  </NativeSelect.Root>
                </Box>
                <Box>
                  <Text fontSize="sm" fontWeight="semibold" mb="1.5">
                    {text.databaseSourceHost}
                  </Text>
                  <Input
                    name="database-host"
                    value={form.host}
                    onChange={(event) => setForm({ ...form, host: event.target.value })}
                    required
                    dir="ltr"
                  />
                </Box>
                <Box>
                  <Text fontSize="sm" fontWeight="semibold" mb="1.5">
                    {text.databaseSourcePort}
                  </Text>
                  <Input
                    name="database-port"
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
                    {text.databaseSourceDatabaseName}
                  </Text>
                  <Input
                    name="database-name"
                    value={form.databaseName}
                    onChange={(event) => setForm({ ...form, databaseName: event.target.value })}
                    required
                    dir="ltr"
                  />
                </Box>
                <Box>
                  <Text fontSize="sm" fontWeight="semibold" mb="1.5">
                    {text.databaseSourceUsername}
                  </Text>
                  <Input
                    name="database-username"
                    value={form.username}
                    onChange={(event) => setForm({ ...form, username: event.target.value })}
                    required
                    autoComplete="off"
                    dir="ltr"
                  />
                </Box>
                <Box>
                  <Text fontSize="sm" fontWeight="semibold" mb="1.5">
                    {text.databaseSourcePassword}
                  </Text>
                  <Input
                    name="database-credential"
                    type="password"
                    value={form.credential}
                    onChange={(event) => setForm({ ...form, credential: event.target.value })}
                    required
                    autoComplete="new-password"
                    dir="ltr"
                  />
                </Box>
              </SimpleGrid>

              <NocInset p="3">
                <StatusIndicator tone="info" label={text.databaseSourceVerifyBeforeSaveTitle} />
                <Text fontSize="11px" color="noc.textMuted" mt="2">
                  {text.databaseSourceVerifyBeforeSaveHint}
                </Text>
              </NocInset>

              {status ? <WorkspaceState tone="healthy" title={status} role="status" /> : null}
              {error ? <WorkspaceState tone="critical" title={error} role="alert" /> : null}

              <HStack gap="2" flexWrap="wrap">
                <Button type="submit" colorPalette="blue" disabled={pending}>
                  {text.databaseSourceVerifyAndSave}
                </Button>
                {current ? (
                  <Button
                    type="button"
                    variant="outline"
                    colorPalette="red"
                    disabled={pending}
                    onClick={() => void remove()}
                  >
                    {text.databaseSourceRemove}
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
