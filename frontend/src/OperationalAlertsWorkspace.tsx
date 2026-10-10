import {
  Badge,
  Box,
  Button,
  Card,
  Heading,
  HStack,
  NativeSelect,
  Stack,
  Text,
} from '@chakra-ui/react';
import { useCallback, useEffect, useState } from 'react';
import type { PbxProfile } from './api.js';
import type { Language } from './i18n.js';

type Alert = {
  fingerprint: string;
  state: 'ACTIVE' | 'ACKNOWLEDGED' | 'SILENCED' | 'RESOLVED';
  observation: {
    ruleId: string;
    severity: string;
    entity: { kind: string; id: string };
    evidence: { value?: number; unit?: string };
  };
  firstSeenAt: string;
  lastSeenAt: string;
  occurrences: number;
  silencedUntil?: string;
};
const titles: Record<string, { fa: string; en: string }> = {
  QUEUE_WAITING: { fa: 'تماس‌های منتظر در صف', en: 'Calls waiting in queue' },
  QUEUE_PRESSURE_HIGH: { fa: 'افزایش تماس‌های منتظر صف', en: 'High queue pressure' },
  QUEUE_PRESSURE_CRITICAL: { fa: 'فشار بحرانی صف تماس', en: 'Critical queue pressure' },
  ENDPOINT_FLAPPING: { fa: 'قطع و وصل مکرر داخلی', en: 'Endpoint repeatedly disconnecting' },
  PBX_DISCONNECTED: { fa: 'قطع ارتباط سیستم تلفنی', en: 'PBX disconnected' },
  PBX_CONNECTION_ERROR: { fa: 'خطای ارتباط سیستم تلفنی', en: 'PBX connection error' },
  CALL_PACKET_LOSS_HIGH: { fa: 'افت بسته در تماس', en: 'High call packet loss' },
  CALL_RTT_HIGH: { fa: 'تأخیر بالای تماس', en: 'High call round-trip time' },
};
function humanTitle(code: string, fa: boolean) {
  return titles[code]?.[fa ? 'fa' : 'en'] ?? code.replaceAll('_', ' ');
}
function meaningfulValue(a: Alert, fa: boolean): string {
  const value = a.observation.evidence.value;
  if (value === undefined) return fa ? 'داده ناموجود' : 'Unavailable';
  const rule = a.observation.ruleId;
  if (rule === 'ENDPOINT_FLAPPING')
    return fa
      ? `${value} بار تغییر وضعیت در ۵ دقیقه اخیر`
      : `${value} state changes in the last 5 minutes`;
  if (rule === 'QUEUE_WAITING' || rule.startsWith('QUEUE_PRESSURE_'))
    return fa ? `${value} تماس منتظر` : `${value} waiting calls`;
  if (a.observation.evidence.unit === 'PERCENT') return `${value}%`;
  if (a.observation.evidence.unit === 'MILLISECONDS')
    return fa ? `${value} میلی‌ثانیه` : `${value} ms`;
  if (a.observation.evidence.unit === 'COUNT') return fa ? `${value} مورد` : `${value} items`;
  return `${value} ${a.observation.evidence.unit ?? ''}`.trim();
}
export function OperationalAlertsWorkspace({
  profiles,
  language,
  onUnauthorized,
}: {
  profiles: PbxProfile[];
  language: Language;
  onUnauthorized: () => void;
}) {
  const fa = language === 'fa';
  const [id, setId] = useState(profiles[0]?.id ?? '');
  const [items, setItems] = useState<Alert[]>([]);
  const [error, setError] = useState('');
  const [pending, setPending] = useState('');
  const load = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`/api/pbx-instances/${encodeURIComponent(id)}/operational-alerts`, {
        credentials: 'same-origin',
      });
      if (res.status === 401) {
        onUnauthorized();
        return;
      }
      if (!res.ok) throw new Error('load');
      const data = (await res.json()) as { items: Alert[] };
      setItems(data.items);
      setError('');
    } catch {
      setError(fa ? 'دریافت هشدارها ناموفق بود' : 'Could not load operational alerts');
    }
  }, [id, fa, onUnauthorized]);
  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 5000);
    return () => clearInterval(timer);
  }, [load]);
  async function act(item: Alert, action: 'ACKNOWLEDGE' | 'SILENCE' | 'UNSILENCE') {
    setPending(item.fingerprint);
    try {
      const res = await fetch(
        `/api/pbx-instances/${encodeURIComponent(id)}/operational-alerts/actions`,
        {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            fingerprint: item.fingerprint,
            action,
            ...(action === 'SILENCE' ? { minutes: 30 } : {}),
          }),
        },
      );
      if (res.status === 401) {
        onUnauthorized();
        return;
      }
      if (!res.ok) throw new Error('action');
      await load();
    } catch {
      setError(fa ? 'تغییر وضعیت هشدار ناموفق بود' : 'Alert update failed');
    } finally {
      setPending('');
    }
  }
  const labels: Record<Alert['state'], string> = fa
    ? { ACTIVE: 'فعال', ACKNOWLEDGED: 'تأییدشده', SILENCED: 'بی‌صدا', RESOLVED: 'رفع‌شده' }
    : {
        ACTIVE: 'Active',
        ACKNOWLEDGED: 'Acknowledged',
        SILENCED: 'Silenced',
        RESOLVED: 'Resolved',
      };
  const current = items.filter((a) => a.state !== 'RESOLVED');
  const resolved = items.filter((a) => a.state === 'RESOLVED');
  const chosen = profiles.find((p) => p.id === id)?.displayName ?? id;
  function renderAlert(a: Alert) {
    const severity = a.observation.severity;
    return (
      <Card.Root key={a.fingerprint} variant="outline" bg="noc.surface1" borderRadius="lg">
        <Card.Body px="4" py="3">
          <Stack gap="3">
            <HStack justify="space-between" flexWrap="wrap" gap="2">
              <Box>
                <Text fontWeight="semibold">{humanTitle(a.observation.ruleId, fa)}</Text>
                <Text fontSize="xs" color="fg.muted">
                  {fa ? 'سیستم' : 'PBX'}: {chosen}
                  {a.observation.entity.kind !== 'PBX' && a.observation.entity.kind !== 'HOST'
                    ? ` · ${a.observation.entity.kind}: ${a.observation.entity.id}`
                    : ''}
                </Text>
              </Box>
              <HStack gap="2">
                <Badge colorPalette={severity === 'CRITICAL' ? 'red' : 'orange'}>
                  {severity === 'CRITICAL'
                    ? fa
                      ? 'بحرانی'
                      : 'Critical'
                    : fa
                      ? 'هشدار'
                      : 'Warning'}
                </Badge>
                <Badge
                  colorPalette={
                    a.state === 'RESOLVED' ? 'green' : a.state === 'SILENCED' ? 'purple' : 'blue'
                  }
                >
                  {labels[a.state]}
                </Badge>
              </HStack>
            </HStack>
            <HStack gap="4" flexWrap="wrap">
              <Text fontSize="sm">
                {fa ? 'مقدار ثبت‌شده' : 'Observed value'}:{' '}
                <Text as="span" fontWeight="semibold">
                  {meaningfulValue(a, fa)}
                </Text>
              </Text>
              <Text fontSize="xs" color="fg.muted">
                {fa
                  ? 'دفعات نمونه‌برداری (نه تعداد رخداد)'
                  : 'Polling observations (not incidents)'}
                : {a.occurrences}
              </Text>
            </HStack>
            <HStack gap="2" flexWrap="wrap">
              {a.state !== 'RESOLVED' && a.state !== 'ACKNOWLEDGED' ? (
                <Button
                  size="sm"
                  colorPalette="blue"
                  disabled={!!pending}
                  loading={pending === a.fingerprint}
                  onClick={() => void act(a, 'ACKNOWLEDGE')}
                >
                  {fa ? 'تأیید هشدار' : 'Acknowledge'}
                </Button>
              ) : null}
              {a.state !== 'RESOLVED' ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!!pending}
                  loading={pending === a.fingerprint}
                  onClick={() => void act(a, a.state === 'SILENCED' ? 'UNSILENCE' : 'SILENCE')}
                >
                  {a.state === 'SILENCED'
                    ? fa
                      ? 'لغو سکوت'
                      : 'Unsilence'
                    : fa
                      ? 'سکوت ۳۰ دقیقه‌ای'
                      : 'Silence 30 min'}
                </Button>
              ) : null}
            </HStack>
          </Stack>
        </Card.Body>
      </Card.Root>
    );
  }
  return (
    <Stack gap="4" data-workspace="operational-alerts" dir={fa ? 'rtl' : 'ltr'}>
      <HStack justify="space-between" flexWrap="wrap">
        <Box>
          <Heading size="lg">{fa ? 'هشدارهای عملیاتی' : 'Operational Alerts'}</Heading>
          <Text fontSize="sm" color="fg.muted">
            {fa
              ? 'وضعیت‌های موقت در حافظه؛ با راه‌اندازی مجدد پاک می‌شوند'
              : 'In-memory states; reset on service restart'}
          </Text>
        </Box>
        <NativeSelect.Root maxW="260px">
          <NativeSelect.Field
            aria-label={fa ? 'انتخاب سیستم تلفنی' : 'Select PBX'}
            value={id}
            onChange={(e) => setId(e.target.value)}
          >
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.displayName}
              </option>
            ))}
          </NativeSelect.Field>
          <NativeSelect.Indicator />
        </NativeSelect.Root>
      </HStack>
      {error ? (
        <Text color="red.500" role="alert">
          {error}
        </Text>
      ) : null}
      <Stack gap="3">
        <Heading size="sm">
          {fa ? 'هشدارهای جاری' : 'Current alerts'} ({current.length})
        </Heading>
        {!current.length ? (
          <Text color="fg.muted">{fa ? 'هشدار جاری وجود ندارد.' : 'No current alerts.'}</Text>
        ) : (
          current.map(renderAlert)
        )}
      </Stack>
      {resolved.length ? (
        <Stack gap="3">
          <Heading size="sm">
            {fa ? 'هشدارهای رفع‌شده' : 'Resolved alerts'} ({resolved.length})
          </Heading>
          {resolved.map(renderAlert)}
        </Stack>
      ) : null}
    </Stack>
  );
}
