import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError, type PbxConnectionState, type PbxProfile, type Principal } from './api.js';
import { messages, type Language } from './i18n.js';
import { SecurityWorkspace } from './SecurityWorkspace.js';

type Text = (typeof messages)[Language];
type Phase = 'loading' | 'setup' | 'login' | 'ready' | 'error';

export function FirstAdminForm({ text, onCreated }: { text: Text; onCreated: () => void }) {
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
    <section aria-labelledby="setup-title">
      <h2 id="setup-title">{text.setupTitle}</h2>
      <p>{text.setupHint}</p>
      <form
        onSubmit={(event) => {
          void submit(event);
        }}
        autoComplete="off"
      >
        <label>
          {text.token}
          <input
            name="bootstrap-token"
            value={bootstrapToken}
            onChange={(event) => setBootstrapToken(event.target.value)}
            required
            autoComplete="off"
          />
        </label>
        <label>
          {text.username}
          <input
            name="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
            autoComplete="username"
          />
        </label>
        <label>
          {text.password}
          <input
            name="new-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={12}
            autoComplete="new-password"
          />
        </label>
        <label>
          {text.confirmPassword}
          <input
            name="confirm-password"
            type="password"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            required
            autoComplete="new-password"
          />
        </label>
        {error && <p role="alert">{error}</p>}
        <button disabled={pending} type="submit">
          {text.createAdmin}
        </button>
      </form>
    </section>
  );
}

export function LoginForm({
  text,
  onLoggedIn,
}: {
  text: Text;
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
    <section aria-labelledby="login-title">
      <h2 id="login-title">{text.loginTitle}</h2>
      <form
        onSubmit={(event) => {
          void submit(event);
        }}
      >
        <label>
          {text.username}
          <input
            name="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
            autoComplete="username"
          />
        </label>
        <label>
          {text.password}
          <input
            name="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            autoComplete="current-password"
          />
        </label>
        {error && <p role="alert">{error}</p>}
        <button disabled={pending} type="submit">
          {text.login}
        </button>
      </form>
    </section>
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
  text: Text;
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
    <section aria-labelledby="pbx-title">
      <h2 id="pbx-title">{text.pbxTitle}</h2>
      <p>{text.connectionHint}</p>
      {profiles.length > 0 && (
        <ul className="profiles">
          {profiles.map((profile) => (
            <li key={profile.id}>
              <h3>{profile.displayName}</h3>
              <p>
                {text.asterisk} · {profile.amiHost}:{profile.amiPort} · {profile.amiUsername}
              </p>
              <p>
                {connectionLabel(profile.connectionStatus)} ·{' '}
                {profile.enabled ? text.enabled : text.disabled} ·{' '}
                {profile.hasAmiPassword ? text.passwordConfigured : text.passwordMissing}
              </p>
              {profile.lastVerifiedAt && (
                <p>
                  {text.lastVerified}: <span dir="ltr">{profile.lastVerifiedAt}</span>
                </p>
              )}
              {testResult[profile.id] && <p role="status">{testResult[profile.id]}</p>}
              <div className="actions">
                {profile.hasAmiPassword && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      void testConnection(profile);
                    }}
                  >
                    {text.testConnection}
                  </button>
                )}
                <button type="button" disabled={pending} onClick={() => edit(profile)}>
                  {text.editPbx}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    void change(profile.id, { enabled: !profile.enabled });
                  }}
                >
                  {profile.enabled ? text.disable : text.enable}
                </button>
                {profile.hasAmiPassword && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      void change(profile.id, { removeAmiPassword: true });
                    }}
                  >
                    {text.removePassword}
                  </button>
                )}
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    void remove(profile.id);
                  }}
                >
                  {text.deletePbx}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {!showForm && (
        <button
          type="button"
          onClick={() => {
            setForm(emptyForm());
            setEditingId(undefined);
            setShowForm(true);
          }}
        >
          {text.addPbx}
        </button>
      )}
      {showForm && (
        <form
          onSubmit={(event) => {
            void submit(event);
          }}
          autoComplete="off"
        >
          <h3>{editingId ? text.editPbx : profiles.length === 0 ? text.firstPbx : text.addPbx}</h3>
          <label>
            {text.provider}
            <select name="provider" defaultValue="ASTERISK">
              <option value="ASTERISK">{text.asterisk}</option>
            </select>
          </label>
          <label>
            {text.displayName}
            <input
              name="display-name"
              value={form.displayName}
              onChange={(event) => setForm({ ...form, displayName: event.target.value })}
              required
              maxLength={100}
            />
          </label>
          <label>
            {text.amiHost}
            <input
              name="ami-host"
              value={form.amiHost}
              onChange={(event) => setForm({ ...form, amiHost: event.target.value })}
              required
              maxLength={253}
              dir="ltr"
            />
          </label>
          <label>
            {text.amiPort}
            <input
              name="ami-port"
              type="number"
              min={1}
              max={65535}
              value={form.amiPort}
              onChange={(event) => setForm({ ...form, amiPort: event.target.value })}
              required
            />
          </label>
          <label>
            {text.amiUsername}
            <input
              name="ami-username"
              value={form.amiUsername}
              onChange={(event) => setForm({ ...form, amiUsername: event.target.value })}
              required
              maxLength={128}
              autoComplete="off"
            />
          </label>
          <label>
            {text.amiPassword}
            <input
              name="ami-password"
              type="password"
              value={form.amiPassword}
              onChange={(event) => setForm({ ...form, amiPassword: event.target.value })}
              required={!editingId}
              maxLength={1024}
              autoComplete="off"
            />
          </label>
          {editingId && <p>{text.passwordOptional}</p>}
          <label className="check">
            <input
              name="enabled"
              type="checkbox"
              checked={form.enabled}
              onChange={(event) => setForm({ ...form, enabled: event.target.checked })}
            />
            {text.enabled}
          </label>
          {error && <p role="alert">{error}</p>}
          <div className="actions">
            <button disabled={pending} type="submit">
              {text.savePbx}
            </button>
            {profiles.length > 0 && (
              <button type="button" onClick={resetForm}>
                {text.cancel}
              </button>
            )}
          </div>
        </form>
      )}
      {!showForm && error && <p role="alert">{error}</p>}
    </section>
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
  const [principal, setPrincipal] = useState<Principal>();
  const [profiles, setProfiles] = useState<PbxProfile[]>([]);
  const [shellError, setShellError] = useState('');
  const direction = language === 'fa' ? 'rtl' : 'ltr';
  const text = messages[language];
  async function refreshProfiles() {
    const result = await api.listPbx();
    setProfiles(result.items);
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
        await refreshProfiles();
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
    await refreshProfiles();
    setPhase('ready');
  }
  function unauthorized() {
    setPrincipal(undefined);
    setProfiles([]);
    setPhase('login');
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
  return (
    <main dir={direction} lang={language}>
      <header>
        <h1>{text.title}</h1>
        <button
          type="button"
          onClick={() => setLanguage(language === 'en' ? 'fa' : 'en')}
          aria-label={text.switchLanguageLabel}
        >
          {text.switchLanguage}
        </button>
      </header>
      {phase === 'loading' && <p>{text.loading}</p>}
      {phase === 'error' && (
        <section>
          <p role="alert">{text.unavailable}</p>
          <button
            type="button"
            onClick={() => {
              void load();
            }}
          >
            {text.retry}
          </button>
        </section>
      )}
      {phase === 'setup' && <FirstAdminForm text={text} onCreated={() => setPhase('login')} />}
      {phase === 'login' && <LoginForm text={text} onLoggedIn={loggedIn} />}
      {phase === 'ready' && (
        <>
          <div className="session">
            <span>
              {text.signedIn} {principal?.username}
            </span>
            <button
              type="button"
              onClick={() => {
                void logout();
              }}
            >
              {text.logout}
            </button>
          </div>
          {shellError && <p role="alert">{shellError}</p>}
          <PbxWorkspace
            text={text}
            profiles={profiles}
            onRefresh={refreshProfiles}
            onUnauthorized={unauthorized}
          />
          <SecurityWorkspace text={text} profiles={profiles} onUnauthorized={unauthorized} />
        </>
      )}
    </main>
  );
}
