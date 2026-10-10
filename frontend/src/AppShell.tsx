import { Box, Button, Flex, HStack, Input, Link, Stack, Text } from '@chakra-ui/react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { PbxProfile, Principal } from './api.js';
import type { Language } from './i18n.js';
import { HelpHint } from './ContextHelp.js';
import { HELP } from './helpContent.js';
import { useThemeMode } from './ThemeMode.js';

export type ShellWorkspace =
  'dashboard' | 'fleet' | 'telephony' | 'history' | 'quality' | 'alerts' | 'settings';
export type ShellTelephonyPage =
  'calls' | 'channels' | 'endpoints' | 'trunks' | 'queues' | 'agents';
export type ShellSettingsPage =
  | 'pbx'
  | 'database-source'
  | 'ssh-metrics'
  | 'service-monitoring'
  | 'storage'
  | 'dashboard-refresh'
  | 'security'
  | 'accounts';

type ShellDestination =
  | { workspace: 'dashboard' }
  | { workspace: 'fleet' }
  | { workspace: 'history' }
  | { workspace: 'quality' }
  | { workspace: 'alerts' }
  | { workspace: 'telephony'; page: ShellTelephonyPage }
  | { workspace: 'settings'; page: ShellSettingsPage };

interface AppShellProps {
  language: Language;
  username: Principal['username'];
  profiles: PbxProfile[];
  workspace: ShellWorkspace;
  telephonyPage: ShellTelephonyPage;
  settingsPage: ShellSettingsPage;
  shellError?: ReactNode;
  children: ReactNode;
  onNavigate: (destination: ShellDestination) => void;
  onToggleLanguage: () => void;
  onLogout: () => void;
}

type IconName =
  | 'overview'
  | 'pbx'
  | 'calls'
  | 'channels'
  | 'trunks'
  | 'endpoints'
  | 'queues'
  | 'agents'
  | 'history'
  | 'security'
  | 'infra'
  | 'settings';

function NavIcon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    overview: <path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1Z" />,
    pbx: (
      <>
        <rect x="4" y="4" width="16" height="6" rx="2" />
        <rect x="4" y="14" width="16" height="6" rx="2" />
        <path d="M8 7h.01M8 17h.01M12 7h5M12 17h5" />
      </>
    ),
    calls: (
      <path d="M7.4 3.6 10 8l-2.1 2.1a15.5 15.5 0 0 0 6 6L16 14l4.4 2.6-.7 3.1c-.2.8-.9 1.3-1.7 1.3C9.7 21 3 14.3 3 6c0-.8.5-1.5 1.3-1.7Z" />
    ),
    channels: (
      <>
        <path d="M4 7h16M4 12h16M4 17h16" />
        <circle cx="7" cy="7" r="1" />
        <circle cx="15" cy="12" r="1" />
        <circle cx="10" cy="17" r="1" />
      </>
    ),
    trunks: (
      <>
        <path d="M8 12h8" />
        <path d="M12 8v8" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="12" r="3" />
      </>
    ),
    endpoints: (
      <>
        <rect x="6" y="3" width="12" height="18" rx="2" />
        <path d="M10 6h4M10 18h4" />
      </>
    ),
    queues: (
      <>
        <circle cx="7" cy="8" r="3" />
        <circle cx="17" cy="8" r="3" />
        <path d="M2 20c0-4 2-6 5-6s5 2 5 6M12 20c0-4 2-6 5-6s5 2 5 6" />
      </>
    ),
    agents: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-5 3-8 8-8s8 3 8 8" />
        <path d="M18 9v5M20 11h-4" />
      </>
    ),
    history: (
      <>
        <path d="M4 12a8 8 0 1 0 2-5.3L3 10" />
        <path d="M3 4v6h6M12 8v5l3 2" />
      </>
    ),
    security: <path d="M12 3 5 6v5c0 4.6 2.8 8.1 7 10 4.2-1.9 7-5.4 7-10V6Z" />,
    infra: (
      <>
        <path d="M4 18h16M6 18V9h4v9M14 18V5h4v13" />
        <path d="M5 5h6M13 9h6" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a8 8 0 0 0-1.8-1L14.4 3h-4.8l-.4 3.1a8 8 0 0 0-1.8 1l-2.4-1-2 3.4L5 11a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.4-1a8 8 0 0 0 1.8 1l.4 3.1h4.8l.4-3.1a8 8 0 0 0 1.8-1l2.4 1 2-3.4-2-1.5a7 7 0 0 0 .1-1Z" />
      </>
    ),
  };
  return (
    <Box as="span" color="inherit" w="18px" h="18px" flex="0 0 auto">
      <svg
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {paths[name]}
      </svg>
    </Box>
  );
}

function StatusDot({
  tone = 'healthy',
}: {
  tone?: 'healthy' | 'warning' | 'critical' | 'unknown';
}) {
  const color = {
    healthy: 'noc.healthy',
    warning: 'noc.warning',
    critical: 'noc.critical',
    unknown: 'noc.unknown',
  }[tone];
  return <Box w="7px" h="7px" borderRadius="full" bg={color} flex="0 0 auto" />;
}

function useClock(language: Language) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return useMemo(
    () =>
      new Intl.DateTimeFormat(language === 'fa' ? 'fa-IR-u-ca-persian' : 'en-GB', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
      }).format(now),
    [language, now],
  );
}

function navIsActive(
  destination: ShellDestination,
  workspace: ShellWorkspace,
  telephonyPage: ShellTelephonyPage,
  settingsPage: ShellSettingsPage,
) {
  if (destination.workspace !== workspace) return false;
  if (destination.workspace === 'telephony') return destination.page === telephonyPage;
  if (destination.workspace === 'settings') return destination.page === settingsPage;
  return true;
}

export function AppShell({
  language,
  username,
  profiles,
  workspace,
  telephonyPage,
  settingsPage,
  shellError,
  children,
  onNavigate,
  onToggleLanguage,
  onLogout,
}: AppShellProps) {
  const fa = language === 'fa';
  const { mode, setMode } = useThemeMode();
  const clock = useClock(language);
  const connectedCount = profiles.filter(
    (profile) => profile.connectionStatus === 'CONNECTED',
  ).length;
  const degradedCount = profiles.filter((profile) =>
    ['ERROR', 'DEGRADED', 'DISCONNECTED'].includes(profile.connectionStatus),
  ).length;

  const overview = {
    icon: 'overview' as const,
    label: fa ? 'نمای کلی' : 'Overview',
    destination: { workspace: 'dashboard' } as ShellDestination,
    help: HELP.navigation.overview,
  };
  const groups = [
    {
      id: 'operations' as const,
      icon: 'calls' as const,
      label: fa ? 'عملیات' : 'Operations',
      help: HELP.navigation.operations,
      children: [
        {
          icon: 'pbx' as const,
          label: fa ? 'PBXها' : 'PBX Fleet',
          destination: { workspace: 'fleet' } as ShellDestination,
          help: HELP.navigation.fleet,
        },
        {
          icon: 'calls' as const,
          label: fa ? 'تماس‌های زنده' : 'Live Calls',
          destination: { workspace: 'telephony', page: 'calls' } as ShellDestination,
          help: HELP.navigation.liveCalls,
        },
        {
          icon: 'calls' as const,
          label: fa ? 'کیفیت تماس زنده' : 'Live Call Quality',
          destination: { workspace: 'quality' } as ShellDestination,
        },
        {
          icon: 'calls' as const,
          label: fa ? 'هشدارهای عملیاتی' : 'Operational Alerts',
          destination: { workspace: 'alerts' } as ShellDestination,
        },
        {
          icon: 'channels' as const,
          label: fa ? 'Channelها' : 'Channels',
          destination: { workspace: 'telephony', page: 'channels' } as ShellDestination,
          help: HELP.navigation.channels,
        },
        {
          icon: 'trunks' as const,
          label: fa ? 'Trunkها' : 'Trunks',
          destination: { workspace: 'telephony', page: 'trunks' } as ShellDestination,
          help: HELP.navigation.trunks,
        },
        {
          icon: 'endpoints' as const,
          label: fa ? 'Endpointها' : 'Endpoints',
          destination: { workspace: 'telephony', page: 'endpoints' } as ShellDestination,
          help: HELP.navigation.endpoints,
        },
        {
          icon: 'queues' as const,
          label: fa ? 'صف‌ها' : 'Queues',
          destination: { workspace: 'telephony', page: 'queues' } as ShellDestination,
          help: HELP.navigation.queues,
        },
        {
          icon: 'agents' as const,
          label: fa ? 'Agentها' : 'Agents',
          destination: { workspace: 'telephony', page: 'agents' } as ShellDestination,
          help: HELP.navigation.agents,
        },
        {
          icon: 'history' as const,
          label: fa ? 'گزارشات' : 'Reports',
          destination: { workspace: 'history' } as ShellDestination,
          help: HELP.navigation.reports,
        },
      ],
    },
    {
      id: 'settings' as const,
      icon: 'settings' as const,
      label: fa ? 'تنظیمات' : 'Settings',
      help: HELP.navigation.settings,
      children: [
        {
          icon: 'pbx' as const,
          label: fa ? 'تنظیمات PBX' : 'PBX Settings',
          destination: { workspace: 'settings', page: 'pbx' } as ShellDestination,
          help: HELP.navigation.pbxSettings,
        },
        {
          icon: 'settings' as const,
          label: fa ? 'منبع داده' : 'Data Source',
          destination: { workspace: 'settings', page: 'database-source' } as ShellDestination,
          help: HELP.navigation.dataSource,
        },
        {
          icon: 'infra' as const,
          label: fa ? 'زیرساخت' : 'Infrastructure',
          destination: { workspace: 'settings', page: 'ssh-metrics' } as ShellDestination,
          help: HELP.navigation.infrastructure,
        },
        {
          icon: 'infra' as const,
          label: fa ? 'مانیتورینگ سرویس' : 'Service Monitoring',
          destination: { workspace: 'settings', page: 'service-monitoring' } as ShellDestination,
          help: HELP.navigation.serviceMonitoring,
        },
        {
          icon: 'settings' as const,
          label: fa ? 'Storage / Filesystems' : 'Storage / Filesystems',
          destination: { workspace: 'settings', page: 'storage' } as ShellDestination,
          help: HELP.navigation.storage,
        },
        {
          icon: 'settings' as const,
          label: fa ? 'تنظیمات داشبورد' : 'Dashboard Settings',
          destination: { workspace: 'settings', page: 'dashboard-refresh' } as ShellDestination,
          help: HELP.navigation.dashboardSettings,
        },
        {
          icon: 'security' as const,
          label: fa ? 'امنیت' : 'Security',
          destination: { workspace: 'settings', page: 'security' } as ShellDestination,
          help: HELP.navigation.security,
        },
        {
          icon: 'settings' as const,
          label: fa ? 'حساب‌های کاربری' : 'Accounts',
          destination: { workspace: 'settings', page: 'accounts' } as ShellDestination,
          help: HELP.navigation.accounts,
        },
      ],
    },
  ];
  type GroupId = (typeof groups)[number]['id'];
  const activeGroup: GroupId | null =
    workspace === 'settings' ? 'settings' : workspace === 'dashboard' ? null : 'operations';
  const [expandedGroup, setExpandedGroup] = useState<GroupId | null>(activeGroup);

  useEffect(() => {
    setExpandedGroup(activeGroup);
  }, [activeGroup]);

  return (
    <Flex minH="100vh" bg="noc.canvas" color="noc.text" data-app-shell>
      <Link
        href="#main-content"
        data-skip-link
        position="fixed"
        top="2"
        insetInlineStart="2"
        zIndex="tooltip"
        px="3"
        py="2"
        bg="noc.surface3"
        color="white"
        borderWidth="1px"
        borderColor="noc.accent"
        borderRadius="nocControl"
        transform="translateY(-160%)"
        _focusVisible={{ transform: 'translateY(0)' }}
      >
        {fa ? 'رفتن به محتوای اصلی' : 'Skip to main content'}
      </Link>
      <Box
        as="aside"
        data-app-sidebar
        position="fixed"
        top={{ base: 'auto', md: '0' }}
        bottom="0"
        insetInlineStart="0"
        insetInlineEnd={{ base: '0', md: 'auto' }}
        w={{ base: '100%', md: '72px', lg: '232px' }}
        h={{ base: '64px', md: '100vh' }}
        bg="noc.sidebar"
        borderInlineEndWidth="1px"
        borderColor="noc.border"
        zIndex="20"
        display="flex"
        flexDirection={{ base: 'row', md: 'column' }}
      >
        <Flex
          h="60px"
          px={{ base: '3', lg: '4' }}
          display={{ base: 'none', md: 'flex' }}
          align="center"
          gap="3"
          borderBottomWidth="1px"
          borderColor="noc.border"
        >
          <Flex
            w="34px"
            h="34px"
            borderRadius="10px"
            bg="rgba(45,140,255,.16)"
            color="noc.accent"
            align="center"
            justify="center"
            flex="0 0 auto"
          >
            <Box
              w="16px"
              h="16px"
              border="2px solid currentColor"
              borderRadius="6px"
              transform="rotate(45deg)"
            />
          </Flex>
          <Text
            fontSize="18px"
            fontWeight="700"
            letterSpacing="-0.02em"
            display={{ base: 'none', lg: 'block' }}
          >
            VoIP Monitor
          </Text>
        </Flex>

        <Stack
          as="nav"
          aria-label={fa ? 'ناوبری اصلی' : 'Primary navigation'}
          gap="1"
          px={{ base: '2', lg: '3' }}
          py={{ base: '2', md: '3' }}
          overflowX={{ base: 'visible', md: 'visible' }}
          overflowY={{ base: 'visible', md: 'auto' }}
          flex="1"
          direction={{ base: 'row', md: 'column' }}
          align={{ base: 'center', md: 'stretch' }}
          justify={{ base: 'space-around', md: 'flex-start' }}
        >
          <Box position="relative" w={{ base: 'auto', md: 'full' }}>
            <Button
              type="button"
              variant="ghost"
              h={{ base: '46px', md: '40px' }}
              minW={{ base: '64px', md: 'auto' }}
              px={{ base: '2', lg: '3' }}
              justifyContent={{ base: 'center', lg: 'flex-start' }}
              gap="3"
              borderRadius="9px"
              color={workspace === 'dashboard' ? 'white' : 'noc.textMuted'}
              bg={workspace === 'dashboard' ? 'rgba(45,140,255,.18)' : 'transparent'}
              borderWidth="1px"
              borderColor={workspace === 'dashboard' ? 'rgba(45,140,255,.30)' : 'transparent'}
              _hover={{ bg: 'rgba(255,255,255,.045)', color: 'white' }}
              onClick={() => onNavigate(overview.destination)}
              aria-current={workspace === 'dashboard' ? 'page' : undefined}
              aria-label={overview.label}
              title={overview.label}
            >
              <NavIcon name={overview.icon} />
              <Text
                fontSize="13px"
                fontWeight={workspace === 'dashboard' ? '600' : '500'}
                display={{ base: 'none', lg: 'block' }}
              >
                {overview.label}
              </Text>
            </Button>
            <Box
              position="absolute"
              top="11px"
              insetInlineEnd="8px"
              display={{ base: 'none', lg: 'block' }}
            >
              <HelpHint help={overview.help} kind="navigation" size="xs" />
            </Box>
          </Box>

          {groups.map((group) => {
            const expanded = expandedGroup === group.id;
            const groupActive = activeGroup === group.id;
            return (
              <Box key={group.id} minW={{ base: '64px', md: '0' }} position="relative">
                <Button
                  type="button"
                  variant="ghost"
                  w="full"
                  h={{ base: '46px', md: '40px' }}
                  minW={{ base: '64px', md: 'auto' }}
                  px={{ base: '2', lg: '3' }}
                  justifyContent={{ base: 'center', lg: 'flex-start' }}
                  gap="3"
                  borderRadius="9px"
                  color={groupActive ? 'white' : 'noc.textMuted'}
                  bg={groupActive ? 'rgba(45,140,255,.18)' : 'transparent'}
                  borderWidth="1px"
                  borderColor={groupActive ? 'rgba(45,140,255,.30)' : 'transparent'}
                  _hover={{ bg: 'rgba(255,255,255,.045)', color: 'white' }}
                  onClick={() => setExpandedGroup(expanded ? null : group.id)}
                  aria-expanded={expanded}
                  aria-controls={`nav-group-${group.id}`}
                  aria-label={group.label}
                  title={group.label}
                >
                  <NavIcon name={group.icon} />
                  <Text
                    fontSize="13px"
                    fontWeight={groupActive ? '600' : '500'}
                    display={{ base: 'none', lg: 'block' }}
                  >
                    {group.label}
                  </Text>
                  <Text
                    aria-hidden="true"
                    ms="auto"
                    fontSize="15px"
                    display={{ base: 'none', lg: 'block' }}
                  >
                    {expanded ? '−' : '+'}
                  </Text>
                </Button>
                <Box
                  position="absolute"
                  top="12px"
                  insetInlineEnd="30px"
                  display={{ base: 'none', lg: 'block' }}
                  zIndex="2"
                >
                  <HelpHint help={group.help} kind="navigation" size="xs" />
                </Box>

                {expanded ? (
                  <Stack
                    id={`nav-group-${group.id}`}
                    as="ul"
                    listStyleType="none"
                    m="0"
                    mt={{ base: '0', md: '1' }}
                    ms={{ md: '2' }}
                    p={{ base: '2', md: '0' }}
                    gap="1"
                    position={{ base: 'fixed', md: 'static' }}
                    insetInline={{ base: '8px', md: 'auto' }}
                    bottom={{ base: '68px', md: 'auto' }}
                    maxH={{ base: '60vh', md: 'none' }}
                    overflowY={{ base: 'auto', md: 'visible' }}
                    bg={{ base: 'noc.sidebar', md: 'transparent' }}
                    borderWidth={{ base: '1px', md: '0' }}
                    borderColor="noc.border"
                    borderRadius={{ base: 'nocPanel', md: '0' }}
                    boxShadow={{ base: '0 -12px 30px rgba(0,0,0,.32)', md: 'none' }}
                    zIndex="30"
                  >
                    {group.children.map((item) => {
                      const active = navIsActive(
                        item.destination,
                        workspace,
                        telephonyPage,
                        settingsPage,
                      );
                      return (
                        <Box as="li" key={item.label} position="relative">
                          <Button
                            type="button"
                            variant="ghost"
                            w="full"
                            h="36px"
                            px={{ base: '3', md: '2', lg: '3' }}
                            justifyContent="flex-start"
                            gap="3"
                            borderRadius="8px"
                            color={active ? 'white' : 'noc.textMuted'}
                            bg={active ? 'rgba(45,140,255,.14)' : 'transparent'}
                            borderWidth="1px"
                            borderColor={active ? 'rgba(45,140,255,.24)' : 'transparent'}
                            _hover={{ bg: 'rgba(255,255,255,.045)', color: 'white' }}
                            onClick={() => onNavigate(item.destination)}
                            aria-current={active ? 'page' : undefined}
                            aria-label={item.label}
                            title={item.label}
                          >
                            <NavIcon name={item.icon} />
                            <Text
                              fontSize="12px"
                              fontWeight={active ? '600' : '500'}
                              display={{ base: 'block', md: 'none', lg: 'block' }}
                            >
                              {item.label}
                            </Text>
                          </Button>
                          <Box
                            position="absolute"
                            top="10px"
                            insetInlineEnd="8px"
                            display={{ base: 'none', lg: 'block' }}
                            zIndex="2"
                          >
                            <HelpHint help={item.help} kind="navigation" size="xs" />
                          </Box>
                        </Box>
                      );
                    })}
                  </Stack>
                ) : null}
              </Box>
            );
          })}
        </Stack>

        <Box px={{ base: '2', lg: '3' }} pb="3" display={{ base: 'none', md: 'block' }}>
          <Box
            display={{ base: 'none', lg: 'block' }}
            borderWidth="1px"
            borderColor="noc.border"
            borderRadius="10px"
            bg="rgba(255,255,255,.018)"
            p="3"
            mb="2"
          >
            <Flex align="center" justify="space-between" gap="2" mb="2">
              <Text
                fontSize="11px"
                color="noc.textSubtle"
                fontWeight="600"
                textTransform="uppercase"
                letterSpacing=".08em"
              >
                {fa ? 'اتصال‌های PBX' : 'PBX Connections'}
              </Text>
              <Text fontSize="11px" color="noc.textMuted">
                {connectedCount}/{profiles.length}
              </Text>
            </Flex>
            <Stack gap="1.5">
              {profiles.slice(0, 4).map((profile) => (
                <Flex key={profile.id} align="center" gap="2" minW="0">
                  <StatusDot
                    tone={
                      profile.connectionStatus === 'CONNECTED'
                        ? 'healthy'
                        : profile.connectionStatus === 'DEGRADED'
                          ? 'warning'
                          : ['ERROR', 'DISCONNECTED'].includes(profile.connectionStatus)
                            ? 'critical'
                            : 'unknown'
                    }
                  />
                  <Text fontSize="12px" color="noc.textMuted" truncate dir="ltr">
                    {profile.displayName}
                  </Text>
                </Flex>
              ))}
              {profiles.length === 0 ? (
                <Text fontSize="12px" color="noc.textSubtle">
                  {fa ? 'هنوز PBX تعریف نشده' : 'No PBX configured'}
                </Text>
              ) : null}
            </Stack>
          </Box>
          <Flex align="center" justify={{ base: 'center', lg: 'flex-start' }} gap="2" minH="18px">
            <StatusDot tone={degradedCount > 0 ? 'warning' : 'healthy'} />
            <Text fontSize="10px" color="noc.textSubtle" display={{ base: 'none', lg: 'block' }}>
              v1.0.0
            </Text>
          </Flex>
        </Box>
      </Box>

      <Box
        ms={{ base: '0', md: '72px', lg: '232px' }}
        w={{ base: '100%', md: 'calc(100% - 72px)', lg: 'calc(100% - 232px)' }}
        minW="0"
      >
        <Flex
          as="header"
          data-app-topbar
          h="60px"
          px={{ base: '3', md: '5', xl: '6' }}
          align="center"
          justify="space-between"
          gap="4"
          position="sticky"
          top="0"
          zIndex="15"
          bg="noc.canvas"
          backdropFilter="blur(14px)"
          borderBottomWidth="1px"
          borderColor="noc.border"
        >
          <Flex
            align="center"
            gap="2"
            minW="0"
            flex="1"
            maxW="640px"
            h="36px"
            borderWidth="1px"
            borderColor="noc.borderStrong"
            bg="noc.surface"
            borderRadius="9px"
            px="3"
            color="noc.textSubtle"
          >
            <Box as="span" fontSize="16px">
              ⌕
            </Box>
            <Input
              aria-label={fa ? 'جست‌وجوی نمای فعلی' : 'Search current view'}
              placeholder={fa ? 'جست‌وجوی نمای فعلی…' : 'Search current view…'}
              variant="subtle"
              bg="transparent"
              border="0"
              h="32px"
              px="0"
              fontSize="12px"
              color="noc.textMuted"
              disabled
            />
            <Text
              fontSize="10px"
              color="noc.textSubtle"
              whiteSpace="nowrap"
              display={{ base: 'none', md: 'block' }}
            >
              {fa ? 'به‌زودی' : 'Coming soon'}
            </Text>
            <HelpHint
              subject={fa ? 'جست‌وجوی نمای فعلی' : 'Search current view'}
              kind="field"
              size="xs"
            />
          </Flex>

          <HStack gap="2" flex="0 0 auto">
            <Button
              type="button"
              size="sm"
              variant="outline"
              w="36px"
              minW="36px"
              h="36px"
              p="0"
              borderColor="noc.borderStrong"
              bg="noc.surface"
              color="noc.text"
              aria-label={
                mode === 'dark'
                  ? fa
                    ? 'فعال‌کردن حالت روشن'
                    : 'Switch to light mode'
                  : fa
                    ? 'فعال‌کردن حالت تاریک'
                    : 'Switch to dark mode'
              }
              title={
                mode === 'dark'
                  ? fa
                    ? 'حالت روشن'
                    : 'Light mode'
                  : fa
                    ? 'حالت تاریک'
                    : 'Dark mode'
              }
              onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')}
            >
              <Box as="span" fontSize="19px" lineHeight="1" aria-hidden="true">
                {mode === 'dark' ? '☀' : '☾'}
              </Box>
            </Button>
            <Flex
              h="34px"
              align="center"
              gap="2"
              px="3"
              role="status"
              aria-live="polite"
              borderWidth="1px"
              borderColor="noc.border"
              borderRadius="9px"
              bg="noc.surface"
              display={{ base: 'none', md: 'flex' }}
            >
              <Text fontSize="11px" color="noc.textMuted" dir="ltr">
                {clock}
              </Text>
              <StatusDot tone={degradedCount > 0 ? 'warning' : 'healthy'} />
              <Text fontSize="11px" color={degradedCount > 0 ? 'noc.warning' : 'noc.healthy'}>
                {degradedCount > 0 ? (fa ? 'نیازمند توجه' : 'Attention') : fa ? 'زنده' : 'Live'}
              </Text>
              <HelpHint
                subject={fa ? 'وضعیت لحظه‌ای برنامه' : 'Application live status'}
                kind="status"
                size="xs"
              />
            </Flex>
            <Button
              size="sm"
              variant="ghost"
              h="34px"
              minW="42px"
              color="noc.textMuted"
              borderWidth="1px"
              borderColor="noc.border"
              bg="noc.surface"
              onClick={onToggleLanguage}
              aria-label={fa ? 'تغییر زبان' : 'Switch language'}
            >
              {fa ? 'EN' : 'فا'}
            </Button>
            <HelpHint subject={fa ? 'تغییر زبان' : 'Switch language'} kind="action" size="xs" />
            <Flex
              h="34px"
              align="center"
              gap="2"
              px="2.5"
              borderWidth="1px"
              borderColor="noc.border"
              borderRadius="9px"
              bg="noc.surface"
              display={{ base: 'none', sm: 'flex' }}
            >
              <Flex
                w="22px"
                h="22px"
                borderRadius="full"
                align="center"
                justify="center"
                bg="noc.accentStrong"
                color="white"
                fontSize="10px"
                fontWeight="700"
              >
                {username.slice(0, 1).toUpperCase()}
              </Flex>
              <Text fontSize="11px" color="noc.textMuted" dir="ltr" maxW="100px" truncate>
                {username}
              </Text>
              <HelpHint
                subject={fa ? 'حساب کاربری واردشده' : 'Signed-in account'}
                kind="status"
                size="xs"
              />
            </Flex>
            <Button
              size="sm"
              variant="ghost"
              h="34px"
              color="noc.critical"
              borderWidth="1px"
              borderColor="noc.border"
              bg="noc.surface"
              onClick={onLogout}
            >
              {fa ? 'خروج' : 'Log out'}
            </Button>
            <HelpHint subject={fa ? 'خروج از حساب' : 'Log out'} kind="action" size="xs" />
          </HStack>
        </Flex>

        <Box
          as="main"
          id="main-content"
          tabIndex={-1}
          px={{ base: '3', md: '5', xl: '6' }}
          pt={{ base: '4', md: '5' }}
          pb={{ base: '20', md: '5' }}
          minW="0"
        >
          {shellError ? <Box mb="4">{shellError}</Box> : null}
          {children}
        </Box>
      </Box>
    </Flex>
  );
}

export type { ShellDestination };
