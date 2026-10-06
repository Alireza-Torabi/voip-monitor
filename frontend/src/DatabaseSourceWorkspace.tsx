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
} from '@chakra-ui/react';
import { useEffect, useState, type FormEvent } from 'react';
import {
  api,
  ApiError,
  type DatabaseDialect,
  type PbxProfile,
  type SafeDatabaseSourceConfiguration,
} from './api.js';
import { messages, type Language } from './i18n.js';

type TextMap = (typeof messages)[Language];

function emptyForm() {
  return {
    dialect: 'MYSQL_MARIADB' as DatabaseDialect,
    host: '',
    port: '3306',
    databaseName: '',
    username: '',
    credential: '',
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
      });
      setCurrent(value);
      setForm((existing) => ({ ...existing, credential: '' }));
      setStatus(text.databaseSourceSaved);
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) onUnauthorized();
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
          <Heading size="xl">{text.databaseSourceTitle}</Heading>
          <Text color="fg.muted" mt="1">
            {text.databaseSourceHint}
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
              <Card.Title>{text.databaseSourceConfiguration}</Card.Title>
              <Card.Description>{text.databaseSourceWriteOnlyHint}</Card.Description>
            </Box>
            <Badge colorPalette={current?.hasCredential ? 'green' : 'gray'}>
              {current?.hasCredential
                ? text.databaseSourceConfigured
                : text.databaseSourceNotConfigured}
            </Badge>
          </Flex>
        </Card.Header>
        <Card.Body>
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

              <Card.Root variant="subtle" bg="blue.50">
                <Card.Body gap="1">
                  <Text fontWeight="semibold">{text.databaseSourceReadOnlyTitle}</Text>
                  <Text fontSize="sm" color="fg.muted">
                    {text.databaseSourceReadOnlyHint}
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
                  {text.databaseSourceSave}
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
        </Card.Body>
      </Card.Root>
    </Stack>
  );
}
