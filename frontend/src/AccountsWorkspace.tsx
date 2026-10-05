import {
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  Flex,
  Heading,
  Input,
  SimpleGrid,
  Stack,
  Text,
} from '@chakra-ui/react';
import { useEffect, useState, type ReactNode } from 'react';
import { api, ApiError, type AdministratorAccount, type Principal } from './api.js';
import { messages, type Language } from './i18n.js';

type TextMap = (typeof messages)[Language];

function localDate(value: string | undefined) {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleString();
}

export function AccountsWorkspace({
  text,
  principal,
  onUnauthorized,
}: {
  text: TextMap;
  principal: Principal;
  onUnauthorized: () => void;
}) {
  const [accounts, setAccounts] = useState<AdministratorAccount[]>([]);
  const [draftUsernames, setDraftUsernames] = useState<Record<string, string>>({});
  const [draftEnabled, setDraftEnabled] = useState<Record<string, boolean>>({});
  const [passwords, setPasswords] = useState<Record<string, string>>({});
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  async function load() {
    setPending(true);
    setError('');
    try {
      const value = await api.listAccounts();
      setAccounts(value.items);
      setDraftUsernames(
        Object.fromEntries(value.items.map((account) => [account.id, account.username])),
      );
      setDraftEnabled(
        Object.fromEntries(value.items.map((account) => [account.id, account.enabled])),
      );
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) onUnauthorized();
      else setError(text.accountsLoadFailed);
    } finally {
      setPending(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function createAccount() {
    setPending(true);
    setError('');
    setStatus('');
    try {
      await api.createAccount(newUsername, newPassword);
      setNewUsername('');
      setNewPassword('');
      setStatus(text.accountCreated);
      await load();
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) onUnauthorized();
      else setError(text.accountCreateFailed);
    } finally {
      setPending(false);
    }
  }

  async function saveAccount(account: AdministratorAccount) {
    setPending(true);
    setError('');
    setStatus('');
    try {
      await api.updateAccount(
        account.id,
        draftUsernames[account.id] ?? account.username,
        draftEnabled[account.id] ?? account.enabled,
      );
      setStatus(text.accountSaved);
      await load();
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) onUnauthorized();
      else setError(text.accountSaveFailed);
    } finally {
      setPending(false);
    }
  }

  async function resetPassword(account: AdministratorAccount) {
    const password = passwords[account.id] ?? '';
    setPending(true);
    setError('');
    setStatus('');
    try {
      await api.resetAccountPassword(account.id, password);
      setPasswords((current) => ({ ...current, [account.id]: '' }));
      setStatus(
        account.id === principal.id ? text.accountPasswordChangedSelf : text.accountPasswordChanged,
      );
      if (account.id === principal.id) onUnauthorized();
      else await load();
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) onUnauthorized();
      else setError(text.accountPasswordFailed);
    } finally {
      setPending(false);
    }
  }

  async function removeAccount(account: AdministratorAccount) {
    setPending(true);
    setError('');
    setStatus('');
    try {
      await api.deleteAccount(account.id);
      setStatus(text.accountDeleted);
      await load();
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) onUnauthorized();
      else setError(text.accountDeleteFailed);
    } finally {
      setPending(false);
    }
  }

  return (
    <Stack gap="5">
      <Box>
        <Heading size="lg">{text.accountsTitle}</Heading>
        <Text color="fg.muted" mt="1">
          {text.accountsHint}
        </Text>
      </Box>

      <Card.Root variant="outline">
        <Card.Header>
          <Card.Title>{text.accountCreateTitle}</Card.Title>
          <Card.Description>{text.accountCreateHint}</Card.Description>
        </Card.Header>
        <Card.Body>
          <SimpleGrid columns={{ base: 1, md: 2 }} gap="3">
            <Box>
              <Text fontSize="sm" fontWeight="semibold" mb="1.5">
                {text.username}
              </Text>
              <Input
                value={newUsername}
                onChange={(event) => setNewUsername(event.target.value)}
                autoComplete="off"
                dir="ltr"
              />
            </Box>
            <Box>
              <Text fontSize="sm" fontWeight="semibold" mb="1.5">
                {text.password}
              </Text>
              <Input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
                dir="ltr"
              />
            </Box>
          </SimpleGrid>
          <Flex mt="4">
            <Button colorPalette="blue" disabled={pending} onClick={() => void createAccount()}>
              {text.accountCreate}
            </Button>
          </Flex>
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

      <Stack gap="3">
        {accounts.map((account) => {
          const self = account.id === principal.id;
          return (
            <Card.Root key={account.id} variant="outline">
              <Card.Header pb="2">
                <Flex justify="space-between" align="start" gap="3" flexWrap="wrap">
                  <Box>
                    <HStackCompat>
                      <Card.Title fontSize="md">{account.username}</Card.Title>
                      {self ? <Badge colorPalette="blue">{text.currentAccount}</Badge> : null}
                      <Badge colorPalette={account.enabled ? 'green' : 'gray'}>
                        {account.enabled ? text.enabled : text.disabled}
                      </Badge>
                    </HStackCompat>
                    <Card.Description>
                      {text.accountRole}: {text.administratorRole}
                    </Card.Description>
                  </Box>
                  <Text fontSize="xs" color="fg.muted">
                    {text.lastLogin}: {localDate(account.lastLoginAt)}
                  </Text>
                </Flex>
              </Card.Header>
              <Card.Body gap="4">
                <SimpleGrid columns={{ base: 1, lg: 3 }} gap="3">
                  <Box>
                    <Text fontSize="xs" color="fg.muted" mb="1">
                      {text.username}
                    </Text>
                    <Input
                      value={draftUsernames[account.id] ?? account.username}
                      onChange={(event) =>
                        setDraftUsernames((current) => ({
                          ...current,
                          [account.id]: event.target.value,
                        }))
                      }
                      dir="ltr"
                    />
                  </Box>
                  <Box>
                    <Text fontSize="xs" color="fg.muted" mb="1">
                      {text.accountStatus}
                    </Text>
                    <Checkbox.Root
                      checked={draftEnabled[account.id] ?? account.enabled}
                      disabled={self}
                      onCheckedChange={(details) =>
                        setDraftEnabled((current) => ({
                          ...current,
                          [account.id]: details.checked === true,
                        }))
                      }
                    >
                      <Checkbox.HiddenInput />
                      <Checkbox.Control>
                        <Checkbox.Indicator />
                      </Checkbox.Control>
                      <Checkbox.Label>{text.accountEnabled}</Checkbox.Label>
                    </Checkbox.Root>
                  </Box>
                  <Box>
                    <Text fontSize="xs" color="fg.muted" mb="1">
                      {text.createdAt}
                    </Text>
                    <Text fontSize="sm">{localDate(account.createdAt)}</Text>
                  </Box>
                </SimpleGrid>

                <Flex gap="2" flexWrap="wrap">
                  <Button
                    size="sm"
                    colorPalette="blue"
                    disabled={pending}
                    onClick={() => void saveAccount(account)}
                  >
                    {text.accountSave}
                  </Button>
                  <Button
                    size="sm"
                    colorPalette="red"
                    variant="outline"
                    disabled={pending || self}
                    onClick={() => void removeAccount(account)}
                  >
                    {text.accountDelete}
                  </Button>
                </Flex>

                <Box borderTopWidth="1px" pt="4">
                  <Text fontSize="sm" fontWeight="semibold" mb="2">
                    {text.accountPasswordReset}
                  </Text>
                  <Flex gap="2" direction={{ base: 'column', md: 'row' }}>
                    <Input
                      type="password"
                      value={passwords[account.id] ?? ''}
                      onChange={(event) =>
                        setPasswords((current) => ({
                          ...current,
                          [account.id]: event.target.value,
                        }))
                      }
                      placeholder={text.accountNewPassword}
                      autoComplete="new-password"
                      dir="ltr"
                    />
                    <Button
                      variant="outline"
                      disabled={pending}
                      onClick={() => void resetPassword(account)}
                    >
                      {text.accountPasswordReset}
                    </Button>
                  </Flex>
                </Box>
              </Card.Body>
            </Card.Root>
          );
        })}
      </Stack>
    </Stack>
  );
}

function HStackCompat({ children }: { children: ReactNode }) {
  return (
    <Flex align="center" gap="2" flexWrap="wrap">
      {children}
    </Flex>
  );
}
