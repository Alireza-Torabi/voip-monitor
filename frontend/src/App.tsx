import {
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  Flex,
  Heading,
  HStack,
  Input,
  NativeSelect,
  SimpleGrid,
  Spinner,
  Stack,
  Text,
} from '@chakra-ui/react';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { api, ApiError, type PbxConnectionState, type PbxProfile, type Principal } from './api.js';
import { messages, type Language } from './i18n.js';
import { SecurityWorkspace } from './SecurityWorkspace.js';
import { SshMetricsWorkspace } from './SshMetricsWorkspace.js';
import { DatabaseSourceWorkspace } from './DatabaseSourceWorkspace.js';
import { HistoryWorkspace } from './HistoryWorkspace.js';
import { DashboardStorageWorkspace } from './DashboardStorageWorkspace.js';
import { DashboardRefreshWorkspace } from './DashboardRefreshWorkspace.js';
import { ServiceMonitoringWorkspace } from './ServiceMonitoringWorkspace.js';
import { AccountsWorkspace } from './AccountsWorkspace.js';
import type { OperatorDestination } from './OperatorDashboard.js';
import { DashboardBuilder } from './DashboardBuilder.js';
import { FleetOverviewWorkspace } from './FleetOverviewWorkspace.js';
import { TelephonyWorkspace, type TelephonyPage } from './TelephonyWorkspace.js';
import { AppShell, type ShellDestination } from './AppShell.js';
import { NocPanel, StatusIndicator } from './NocPrimitives.js';
import { WorkspaceHeader } from './WorkspacePrimitives.js';

type TextMap = (typeof messages)[Language];
type Phase = 'loading' | 'setup' | 'login' | 'ready' | 'error';
type Workspace = 'dashboard' | 'fleet' | 'telephony' | 'history' | 'settings';
type SettingsPage =
  | 'pbx'
  | 'database-source'
  | 'ssh-metrics'
  | 'service-monitoring'
  | 'storage'
  | 'dashboard-refresh'
  | 'security'
  | 'accounts';

function FormField({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <Stack gap="1.5">
      <Text fontSize="sm" fontWeight="semibold" color="fg">
        {label}
      </Text>
      {children}
      {hint ? (
        <Text fontSize="xs" color="fg.muted">
          {hint}
        </Text>
      ) : null}
    </Stack>
  );
}

function InlineMessage({
  children,
  tone = 'error',
}: {
  children: ReactNode;
  tone?: 'error' | 'status';
}) {
  return (
    <Box
      role={tone === 'error' ? 'alert' : 'status'}
      borderWidth="1px"
      borderColor={tone === 'error' ? 'red.200' : 'blue.200'}
      bg={tone === 'error' ? 'red.50' : 'blue.50'}
      color={tone === 'error' ? 'red.800' : 'blue.800'}
      borderRadius="lg"
      px="3"
      py="2"
      fontSize="sm"
    >
      {children}
    </Box>
  );
}

export function FirstAdminForm({ text, onCreated }: { text: TextMap; onCreated: () => void }) {
  const [bootstrapToken, setBootstrapToken] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirmation) {
      setError(text.passwordMismatch);
      return;
    }
    setPending(true);
    setError('');
    try {
      await api.createAdmin(username, password, bootstrapToken);
      setUsername('');
      setBootstrapToken('');
      setPassword('');
      setConfirmation('');
      onCreated();
    } catch {
      setError(text.setupFailed);
    } finally {
      setBootstrapToken('');
      setPassword('');
      setConfirmation('');
      setPending(false);
    }
  }

  return (
    <Card.Root variant="outline" maxW="lg" w="full" shadow="sm">
      <Card.Header>
        <Card.Title id="setup-title" fontSize="xl">
          {text.setupTitle}
        </Card.Title>
        <Card.Description>{text.setupHint}</Card.Description>
      </Card.Header>
      <Card.Body>
        <form
          onSubmit={(event) => {
            void submit(event);
          }}
          autoComplete="off"
          aria-labelledby="setup-title"
        >
          <Stack gap="4">
            <FormField label={text.token}>
              <Input
                name="bootstrap-token"
                value={bootstrapToken}
                onChange={(event) => setBootstrapToken(event.target.value)}
                required
                autoComplete="off"
                dir="ltr"
              />
            </FormField>
            <FormField label={text.username}>
              <Input
                name="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
                autoComplete="username"
                dir="ltr"
              />
            </FormField>
            <FormField label={text.password}>
              <Input
                name="new-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={12}
                autoComplete="new-password"
                dir="ltr"
              />
            </FormField>
            <FormField label={text.confirmPassword}>
              <Input
                name="confirm-password"
                type="password"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                required
                autoComplete="new-password"
                dir="ltr"
              />
            </FormField>
            {error ? <InlineMessage>{error}</InlineMessage> : null}
            <Button disabled={pending} type="submit" colorPalette="blue">
              {text.createAdmin}
            </Button>
          </Stack>
        </form>
      </Card.Body>
    </Card.Root>
  );
}

export function LoginForm({
  text,
  onLoggedIn,
}: {
  text: TextMap;
  onLoggedIn: (principal: Principal) => Promise<void>;
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError('');
    try {
      await api.login(username, password);
      const principal = await api.me();
      setPassword('');
      await onLoggedIn(principal);
    } catch {
      setError(text.loginFailed);
    } finally {
      setPassword('');
      setPending(false);
    }
  }

  return (
    <Card.Root variant="outline" maxW="md" w="full" shadow="md">
      <Card.Header>
        <Card.Title id="login-title" fontSize="2xl">
          {text.loginTitle}
        </Card.Title>
      </Card.Header>
      <Card.Body>
        <form
          onSubmit={(event) => {
            void submit(event);
          }}
          aria-labelledby="login-title"
        >
          <Stack gap="4">
            <FormField label={text.username}>
              <Input
                name="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
                autoComplete="username"
                dir="ltr"
              />
            </FormField>
            <FormField label={text.password}>
              <Input
                name="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                autoComplete="current-password"
                dir="ltr"
              />
            </FormField>
            {error ? <InlineMessage>{error}</InlineMessage> : null}
            <Button disabled={pending} type="submit" colorPalette="blue">
              {text.login}
            </Button>
          </Stack>
        </form>
      </Card.Body>
    </Card.Root>
  );
}

interface PbxFormState {
  displayName: string;
  amiHost: string;
  amiPort: string;
  amiUsername: string;
  amiPassword: string;
  enabled: boolean;
}

const emptyForm = (): PbxFormState => ({
  displayName: '',
  amiHost: '',
  amiPort: '5038',
  amiUsername: '',
  amiPassword: '',
  enabled: false,
});

export function PbxWorkspace({
  text,
  profiles,
  onRefresh,
  onUnauthorized,
}: {
  text: TextMap;
  profiles: PbxProfile[];
  onRefresh: () => Promise<void>;
  onUnauthorized: () => void;
}) {
  const [editingId, setEditingId] = useState<string>();
  const [showForm, setShowForm] = useState(profiles.length === 0);
  const [form, setForm] = useState<PbxFormState>(emptyForm);
  const [error, setError] = useState('');
  const [testResult, setTestResult] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  function handleFailure(failure: unknown, message: string) {
    if (failure instanceof ApiError && failure.status === 401) {
      setForm(emptyForm());
      onUnauthorized();
    } else setError(message);
  }

  function edit(profile: PbxProfile) {
    setEditingId(profile.id);
    setForm({
      displayName: profile.displayName,
      amiHost: profile.amiHost,
      amiPort: String(profile.amiPort),
      amiUsername: profile.amiUsername,
      amiPassword: '',
      enabled: profile.enabled,
    });
    setError('');
    setShowForm(true);
  }

  function resetForm() {
    setForm(emptyForm());
    setEditingId(undefined);
    setShowForm(false);
    setError('');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingId && !form.amiPassword) {
      setError(text.requiredPassword);
      return;
    }
    setPending(true);
    setError('');
    const data = {
      displayName: form.displayName,
      amiHost: form.amiHost,
      amiPort: Number(form.amiPort),
      amiUsername: form.amiUsername,
      enabled: form.enabled,
      ...(editingId ? {} : { providerType: 'ASTERISK' }),
      ...(form.amiPassword ? { amiPassword: form.amiPassword } : {}),
    };
    try {
      if (editingId) await api.updatePbx(editingId, data);
      else await api.createPbx(data);
      await onRefresh();
      resetForm();
    } catch (failure) {
      handleFailure(failure, text.pbxFailed);
    } finally {
      setForm((value) => ({ ...value, amiPassword: '' }));
      setPending(false);
    }
  }

  async function change(id: string, value: object) {
    setPending(true);
    setError('');
    try {
      await api.updatePbx(id, value);
      await onRefresh();
    } catch (failure) {
      handleFailure(failure, text.pbxFailed);
    } finally {
      setPending(false);
    }
  }

  async function remove(id: string) {
    setPending(true);
    setError('');
    try {
      await api.deletePbx(id);
      await onRefresh();
      if (editingId === id) resetForm();
      if (profiles.length === 1) {
        setForm(emptyForm());
        setEditingId(undefined);
        setShowForm(true);
      }
    } catch (failure) {
      handleFailure(failure, text.deleteFailed);
    } finally {
      setPending(false);
    }
  }

  function connectionLabel(state: PbxConnectionState) {
    if (state === 'CONNECTED') return text.connected;
    if (state === 'CONNECTING') return text.connecting;
    if (state === 'DISCONNECTED') return text.disconnected;
    if (state === 'DEGRADED') return text.degraded;
    if (state === 'ERROR') return text.connectionError;
    return text.unverified;
  }

  async function testConnection(profile: PbxProfile) {
    setPending(true);
    setError('');
    setTestResult((current) => ({ ...current, [profile.id]: '' }));
    try {
      const result = await api.testPbxConnection(profile.id);
      const version = result.discovery.metadata.version;
      setTestResult((current) => ({
        ...current,
        [profile.id]: version
          ? `${text.connectionVerified}: ${result.discovery.metadata.product ?? 'Asterisk'} ${version}`
          : text.connectionVerified,
      }));
      await onRefresh();
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) {
        onUnauthorized();
      } else if (failure instanceof ApiError && failure.code === 'pbx_network_disabled') {
        setTestResult((current) => ({ ...current, [profile.id]: text.networkDisabled }));
      } else {
        setTestResult((current) => ({ ...current, [profile.id]: text.connectionTestFailed }));
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <Box as="section" aria-labelledby="pbx-title" data-workspace="pbx-settings">
      <Stack gap="5">
        <WorkspaceHeader
          title={
            <Box as="span" id="pbx-title">
              {text.pbxTitle}
            </Box>
          }
          description={text.connectionHint}
          actions={
            !showForm ? (
              <Button
                size="sm"
                colorPalette="blue"
                onClick={() => {
                  setForm(emptyForm());
                  setEditingId(undefined);
                  setShowForm(true);
                }}
              >
                {text.addPbx}
              </Button>
            ) : undefined
          }
        />

        {profiles.length > 0 ? (
          <SimpleGrid columns={{ base: 1, lg: 2 }} gap="4">
            {profiles.map((profile) => (
              <NocPanel key={profile.id} p="4">
                <Flex justify="space-between" align="start" gap="3">
                  <Box minW="0">
                    <Text fontSize="14px" fontWeight="600" color="noc.text">
                      {profile.displayName}
                    </Text>
                    <Text
                      mt="1"
                      fontSize="10px"
                      color="noc.textSubtle"
                      dir="ltr"
                      overflowWrap="anywhere"
                    >
                      {profile.amiHost}:{profile.amiPort} · {profile.amiUsername}
                    </Text>
                  </Box>
                  <StatusIndicator
                    tone={
                      profile.connectionStatus === 'CONNECTED'
                        ? 'healthy'
                        : profile.connectionStatus === 'DEGRADED' ||
                            profile.connectionStatus === 'CONNECTING'
                          ? 'warning'
                          : profile.connectionStatus === 'ERROR' ||
                              profile.connectionStatus === 'DISCONNECTED'
                            ? 'critical'
                            : 'unknown'
                    }
                    label={connectionLabel(profile.connectionStatus)}
                  />
                </Flex>
                <Stack gap="3" mt="3">
                  <HStack gap="2" flexWrap="wrap">
                    <Badge variant="subtle">{text.asterisk}</Badge>
                    <Badge colorPalette={profile.enabled ? 'green' : 'gray'}>
                      {profile.enabled ? text.enabled : text.disabled}
                    </Badge>
                    <Badge colorPalette={profile.hasAmiPassword ? 'blue' : 'red'}>
                      {profile.hasAmiPassword ? text.passwordConfigured : text.passwordMissing}
                    </Badge>
                  </HStack>
                  {profile.lastVerifiedAt ? (
                    <Text fontSize="sm" color="fg.muted">
                      {text.lastVerified}: <span dir="ltr">{profile.lastVerifiedAt}</span>
                    </Text>
                  ) : null}
                  {testResult[profile.id] ? (
                    <InlineMessage tone="status">{testResult[profile.id]}</InlineMessage>
                  ) : null}
                </Stack>
                <Box mt="3">
                  <HStack gap="2" flexWrap="wrap">
                    {profile.hasAmiPassword ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() => {
                          void testConnection(profile);
                        }}
                      >
                        {text.testConnection}
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() => edit(profile)}
                    >
                      {text.editPbx}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() => {
                        void change(profile.id, { enabled: !profile.enabled });
                      }}
                    >
                      {profile.enabled ? text.disable : text.enable}
                    </Button>
                    {profile.hasAmiPassword ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() => {
                          void change(profile.id, { removeAmiPassword: true });
                        }}
                      >
                        {text.removePassword}
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="outline"
                      colorPalette="red"
                      disabled={pending}
                      onClick={() => {
                        void remove(profile.id);
                      }}
                    >
                      {text.deletePbx}
                    </Button>
                  </HStack>
                </Box>
              </NocPanel>
            ))}
          </SimpleGrid>
        ) : null}

        {showForm ? (
          <Card.Root variant="outline">
            <Card.Header>
              <Card.Title>
                {editingId ? text.editPbx : profiles.length === 0 ? text.firstPbx : text.addPbx}
              </Card.Title>
            </Card.Header>
            <Card.Body>
              <form
                onSubmit={(event) => {
                  void submit(event);
                }}
                autoComplete="off"
              >
                <Stack gap="4">
                  <SimpleGrid columns={{ base: 1, md: 2 }} gap="4">
                    <FormField label={text.provider}>
                      <NativeSelect.Root>
                        <NativeSelect.Field name="provider" defaultValue="ASTERISK">
                          <option value="ASTERISK">{text.asterisk}</option>
                        </NativeSelect.Field>
                        <NativeSelect.Indicator />
                      </NativeSelect.Root>
                    </FormField>
                    <FormField label={text.displayName}>
                      <Input
                        name="display-name"
                        value={form.displayName}
                        onChange={(event) => setForm({ ...form, displayName: event.target.value })}
                        required
                        maxLength={100}
                      />
                    </FormField>
                    <FormField label={text.amiHost}>
                      <Input
                        name="ami-host"
                        value={form.amiHost}
                        onChange={(event) => setForm({ ...form, amiHost: event.target.value })}
                        required
                        maxLength={253}
                        dir="ltr"
                      />
                    </FormField>
                    <FormField label={text.amiPort}>
                      <Input
                        name="ami-port"
                        type="number"
                        min={1}
                        max={65535}
                        value={form.amiPort}
                        onChange={(event) => setForm({ ...form, amiPort: event.target.value })}
                        required
                        dir="ltr"
                      />
                    </FormField>
                    <FormField label={text.amiUsername}>
                      <Input
                        name="ami-username"
                        value={form.amiUsername}
                        onChange={(event) => setForm({ ...form, amiUsername: event.target.value })}
                        required
                        maxLength={128}
                        autoComplete="off"
                        dir="ltr"
                      />
                    </FormField>
                    <FormField
                      label={text.amiPassword}
                      hint={editingId ? text.passwordOptional : undefined}
                    >
                      <Input
                        name="ami-password"
                        type="password"
                        value={form.amiPassword}
                        onChange={(event) => setForm({ ...form, amiPassword: event.target.value })}
                        required={!editingId}
                        maxLength={1024}
                        autoComplete="off"
                        dir="ltr"
                      />
                    </FormField>
                  </SimpleGrid>
                  <Checkbox.Root
                    checked={form.enabled}
                    onCheckedChange={(details) =>
                      setForm({ ...form, enabled: details.checked === true })
                    }
                  >
                    <Checkbox.HiddenInput name="enabled" />
                    <Checkbox.Control>
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                    <Checkbox.Label>{text.enabled}</Checkbox.Label>
                  </Checkbox.Root>
                  {error ? <InlineMessage>{error}</InlineMessage> : null}
                  <HStack gap="2" flexWrap="wrap">
                    <Button disabled={pending} type="submit" colorPalette="blue">
                      {text.savePbx}
                    </Button>
                    {profiles.length > 0 ? (
                      <Button type="button" variant="outline" onClick={resetForm}>
                        {text.cancel}
                      </Button>
                    ) : null}
                  </HStack>
                </Stack>
              </form>
            </Card.Body>
          </Card.Root>
        ) : null}

        {!showForm && error ? <InlineMessage>{error}</InlineMessage> : null}
      </Stack>
    </Box>
  );
}

export function App({
  initialLanguage = 'en',
  initialView,
}: {
  initialLanguage?: Language;
  initialView?: Phase;
}) {
  const [language, setLanguage] = useState<Language>(() => {
    if (typeof window === 'undefined') return initialLanguage;
    try {
      const stored = window.localStorage.getItem('voip-monitor-language');
      return stored === 'en' || stored === 'fa' ? stored : initialLanguage;
    } catch {
      return initialLanguage;
    }
  });
  const [phase, setPhase] = useState<Phase>(initialView ?? 'loading');
  const [principal, setPrincipal] = useState<Principal | undefined>(() =>
    initialView === 'ready' ? { id: 'synthetic-preview', username: 'admin' } : undefined,
  );
  const [profiles, setProfiles] = useState<PbxProfile[]>([]);
  const [workspace, setWorkspace] = useState<Workspace>(
    initialView === 'ready' ? 'settings' : 'dashboard',
  );
  const [telephonyPage, setTelephonyPage] = useState<TelephonyPage>('calls');
  const [settingsPage, setSettingsPage] = useState<SettingsPage>('pbx');
  const [selectedPbxId, setSelectedPbxId] = useState('');
  const [shellError, setShellError] = useState('');
  const direction = language === 'fa' ? 'rtl' : 'ltr';
  const text = messages[language];

  async function refreshProfiles() {
    const result = await api.listPbx();
    setProfiles(result.items);
    setSelectedPbxId((current) =>
      current && result.items.some((item) => item.id === current)
        ? current
        : (result.items[0]?.id ?? ''),
    );
    return result.items;
  }

  async function load() {
    setPhase('loading');
    try {
      const status = await api.setupStatus();
      if (status.adminSetupRequired) {
        setPhase('setup');
        return;
      }
      try {
        const user = await api.me();
        setPrincipal(user);
        const items = await refreshProfiles();
        setWorkspace(items.length > 0 ? 'dashboard' : 'settings');
        if (items.length === 0) setSettingsPage('pbx');
        setPhase('ready');
      } catch {
        setPrincipal(undefined);
        setPhase('login');
      }
    } catch {
      setPhase('error');
    }
  }

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = direction;
    try {
      window.localStorage.setItem('voip-monitor-language', language);
    } catch {
      /* preference storage is optional */
    }
  }, [language, direction]);

  useEffect(() => {
    if (!initialView) void load();
  }, []);

  async function loggedIn(user: Principal) {
    setPrincipal(user);
    const items = await refreshProfiles();
    setWorkspace(items.length > 0 ? 'dashboard' : 'settings');
    if (items.length === 0) setSettingsPage('pbx');
    setPhase('ready');
  }

  function unauthorized() {
    setPrincipal(undefined);
    setProfiles([]);
    setSelectedPbxId('');
    setWorkspace('dashboard');
    setPhase('login');
  }

  function navigate(destination: OperatorDestination | 'dashboard') {
    if (destination === 'dashboard') {
      setWorkspace('dashboard');
      return;
    }
    if (
      destination === 'calls' ||
      destination === 'channels' ||
      destination === 'endpoints' ||
      destination === 'trunks' ||
      destination === 'queues' ||
      destination === 'agents'
    ) {
      setTelephonyPage(destination);
      setWorkspace('telephony');
      return;
    }
    setSettingsPage(destination);
    setWorkspace('settings');
  }

  async function logout() {
    setShellError('');
    try {
      await api.logout();
      unauthorized();
    } catch {
      setShellError(text.unavailable);
    }
  }

  const authPhase =
    phase === 'setup' || phase === 'login' || phase === 'loading' || phase === 'error';

  function handleShellNavigation(destination: ShellDestination) {
    if (destination.workspace === 'dashboard') {
      setWorkspace('dashboard');
      return;
    }
    if (destination.workspace === 'fleet') {
      setWorkspace('fleet');
      return;
    }
    if (destination.workspace === 'history') {
      setWorkspace('history');
      return;
    }
    if (destination.workspace === 'telephony') {
      setTelephonyPage(destination.page);
      setWorkspace('telephony');
      return;
    }
    setSettingsPage(destination.page);
    setWorkspace('settings');
  }

  const readyContent =
    phase === 'ready' && principal ? (
      <AppShell
        language={language}
        username={principal.username}
        profiles={profiles}
        workspace={workspace}
        telephonyPage={telephonyPage}
        settingsPage={settingsPage}
        shellError={shellError ? <InlineMessage>{shellError}</InlineMessage> : undefined}
        onNavigate={handleShellNavigation}
        onToggleLanguage={() => setLanguage(language === 'en' ? 'fa' : 'en')}
        onLogout={() => {
          void logout();
        }}
      >
        <Stack gap={{ base: '5', md: '6' }}>
          {workspace === 'dashboard' ? (
            <DashboardBuilder
              text={text}
              profiles={profiles}
              onUnauthorized={unauthorized}
              onNavigate={navigate}
              selectedInstanceId={selectedPbxId}
              onSelectedInstanceIdChange={setSelectedPbxId}
            />
          ) : null}

          {workspace === 'fleet' ? (
            <FleetOverviewWorkspace
              text={text}
              onUnauthorized={unauthorized}
              onOpenPbx={(instanceId) => {
                setSelectedPbxId(instanceId);
                setWorkspace('dashboard');
              }}
            />
          ) : null}

          {workspace === 'telephony' ? (
            <TelephonyWorkspace
              text={text}
              profiles={profiles}
              page={telephonyPage}
              onUnauthorized={unauthorized}
            />
          ) : null}

          {workspace === 'history' ? (
            <HistoryWorkspace text={text} profiles={profiles} onUnauthorized={unauthorized} />
          ) : null}

          {workspace === 'settings' ? (
            <Box minW="0" data-workspace="settings">
              {settingsPage === 'pbx' ? (
                <PbxWorkspace
                  text={text}
                  profiles={profiles}
                  onRefresh={async () => {
                    await refreshProfiles();
                  }}
                  onUnauthorized={unauthorized}
                />
              ) : null}
              {settingsPage === 'database-source' ? (
                <DatabaseSourceWorkspace
                  text={text}
                  profiles={profiles}
                  onUnauthorized={unauthorized}
                />
              ) : null}
              {settingsPage === 'ssh-metrics' ? (
                <SshMetricsWorkspace
                  text={text}
                  profiles={profiles}
                  onUnauthorized={unauthorized}
                />
              ) : null}
              {settingsPage === 'service-monitoring' ? (
                <ServiceMonitoringWorkspace
                  text={text}
                  profiles={profiles}
                  onUnauthorized={unauthorized}
                />
              ) : null}
              {settingsPage === 'storage' ? (
                <DashboardStorageWorkspace
                  text={text}
                  profiles={profiles}
                  onUnauthorized={unauthorized}
                />
              ) : null}
              {settingsPage === 'dashboard-refresh' ? (
                <DashboardRefreshWorkspace
                  text={text}
                  profiles={profiles}
                  onUnauthorized={unauthorized}
                />
              ) : null}
              {settingsPage === 'security' ? (
                <SecurityWorkspace text={text} profiles={profiles} onUnauthorized={unauthorized} />
              ) : null}
              {settingsPage === 'accounts' ? (
                <AccountsWorkspace
                  text={text}
                  principal={principal}
                  onUnauthorized={unauthorized}
                />
              ) : null}
            </Box>
          ) : null}
        </Stack>
      </AppShell>
    ) : null;

  return (
    <Box
      minH="100vh"
      bg={phase === 'ready' ? 'noc.canvas' : 'gray.50'}
      dir={direction}
      lang={language}
    >
      {readyContent}

      {authPhase ? (
        <>
          <Box as="header" bg="white" borderBottomWidth="1px">
            <Flex
              maxW="960px"
              mx="auto"
              px="5"
              py="4"
              align="center"
              justify="space-between"
              gap="4"
            >
              <Heading size="lg">{text.title}</Heading>
              <Button
                size="sm"
                variant="outline"
                type="button"
                onClick={() => setLanguage(language === 'en' ? 'fa' : 'en')}
                aria-label={text.switchLanguageLabel}
              >
                {text.switchLanguage}
              </Button>
            </Flex>
          </Box>
          <Flex minH="calc(100vh - 69px)" align="center" justify="center" px="5" py="8">
            {phase === 'loading' ? (
              <Stack align="center" gap="3">
                <Spinner size="lg" />
                <Text color="fg.muted">{text.loading}</Text>
              </Stack>
            ) : null}
            {phase === 'error' ? (
              <Card.Root variant="outline" maxW="md" w="full">
                <Card.Body gap="4">
                  <InlineMessage>{text.unavailable}</InlineMessage>
                  <Button
                    colorPalette="blue"
                    onClick={() => {
                      void load();
                    }}
                  >
                    {text.retry}
                  </Button>
                </Card.Body>
              </Card.Root>
            ) : null}
            {phase === 'setup' ? (
              <FirstAdminForm text={text} onCreated={() => setPhase('login')} />
            ) : null}
            {phase === 'login' ? <LoginForm text={text} onLoggedIn={loggedIn} /> : null}
          </Flex>
        </>
      ) : null}
    </Box>
  );
}
