import {
  Badge,
  Box,
  Button,
  Checkbox,
  Flex,
  Input,
  SimpleGrid,
  Stack,
  Text,
} from '@chakra-ui/react';
import { useEffect, useState, type ReactNode } from 'react';
import { api, ApiError, type AdministratorAccount, type Principal } from './api.js';
import { messages, type Language } from './i18n.js';
import { NocInset, NocPanel, SectionHeader, StatusIndicator } from './NocPrimitives.js';
import { WorkspaceField, WorkspaceHeader, WorkspaceState } from './WorkspacePrimitives.js';

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
    <Stack gap="4" data-workspace="accounts">
      <WorkspaceHeader title={text.accountsTitle} description={text.accountsHint} />

      <NocPanel p="4">
        <SectionHeader title={text.accountCreateTitle} description={text.accountCreateHint} />
        <SimpleGrid columns={{ base: 1, md: 2 }} gap="3" mt="4">
          <WorkspaceField label={text.username}>
            <Input
              value={newUsername}
              onChange={(event) => setNewUsername(event.target.value)}
              autoComplete="off"
              dir="ltr"
              bg="noc.surface2"
              borderColor="noc.border"
            />
          </WorkspaceField>
          <WorkspaceField label={text.password}>
            <Input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              dir="ltr"
              bg="noc.surface2"
              borderColor="noc.border"
            />
          </WorkspaceField>
        </SimpleGrid>
        <Flex mt="4">
          <Button
            size="sm"
            colorPalette="blue"
            disabled={pending}
            onClick={() => void createAccount()}
          >
            {text.accountCreate}
          </Button>
        </Flex>
      </NocPanel>

      {status ? <WorkspaceState tone="healthy" title={status} role="status" /> : null}
      {error ? <WorkspaceState tone="critical" title={error} role="alert" /> : null}

      <Stack gap="3">
        {accounts.map((account) => {
          const self = account.id === principal.id;
          return (
            <NocPanel key={account.id} p="4">
              <Flex
                justify="space-between"
                align={{ base: 'flex-start', md: 'center' }}
                direction={{ base: 'column', md: 'row' }}
                gap="3"
              >
                <Box minW="0">
                  <HStackCompat>
                    <Text fontSize="14px" fontWeight="600" color="noc.text" dir="ltr">
                      {account.username}
                    </Text>
                    {self ? <Badge colorPalette="blue">{text.currentAccount}</Badge> : null}
                    <StatusIndicator
                      tone={account.enabled ? 'healthy' : 'unknown'}
                      label={account.enabled ? text.enabled : text.disabled}
                    />
                  </HStackCompat>
                  <Text mt="1" fontSize="10px" color="noc.textSubtle">
                    {text.accountRole}: {text.administratorRole}
                  </Text>
                </Box>
                <Text fontSize="10px" color="noc.textSubtle">
                  {text.lastLogin}: {localDate(account.lastLoginAt)}
                </Text>
              </Flex>

              <SimpleGrid columns={{ base: 1, lg: 3 }} gap="3" mt="4">
                <WorkspaceField label={text.username}>
                  <Input
                    value={draftUsernames[account.id] ?? account.username}
                    onChange={(event) =>
                      setDraftUsernames((current) => ({
                        ...current,
                        [account.id]: event.target.value,
                      }))
                    }
                    dir="ltr"
                    bg="noc.surface2"
                    borderColor="noc.border"
                  />
                </WorkspaceField>
                <WorkspaceField label={text.accountStatus}>
                  <NocInset h="40px" px="3" display="flex" alignItems="center">
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
                  </NocInset>
                </WorkspaceField>
                <WorkspaceField label={text.createdAt}>
                  <NocInset h="40px" px="3" display="flex" alignItems="center">
                    <Text fontSize="12px" color="noc.textMuted">
                      {localDate(account.createdAt)}
                    </Text>
                  </NocInset>
                </WorkspaceField>
              </SimpleGrid>

              <Flex gap="2" flexWrap="wrap" mt="4">
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

              <Box borderTopWidth="1px" borderColor="noc.border" mt="4" pt="4">
                <Text fontSize="11px" fontWeight="600" color="noc.text" mb="2">
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
                    bg="noc.surface2"
                    borderColor="noc.border"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => void resetPassword(account)}
                  >
                    {text.accountPasswordReset}
                  </Button>
                </Flex>
              </Box>
            </NocPanel>
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
