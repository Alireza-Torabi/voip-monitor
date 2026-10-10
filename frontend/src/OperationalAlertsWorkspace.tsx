import { Box, Card, Heading, HStack, NativeSelect, Stack, Text } from '@chakra-ui/react';
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
      {!items.length ? (
        <Text>{fa ? 'هشدار عملیاتی وجود ندارد.' : 'No operational alerts.'}</Text>
      ) : null}
      {items.map((a) => (
        <Card.Root key={a.fingerprint}>
          <Card.Body>
            <Stack gap="2">
              <HStack justify="space-between" flexWrap="wrap">
                <Text fontWeight="bold" dir="ltr">
                  {a.observation.ruleId}
                </Text>
                <Text>
                  {labels[a.state]} — {a.observation.severity}
                </Text>
              </HStack>
              <Text fontSize="sm" dir="ltr">
                {a.observation.entity.kind}: {a.observation.entity.id}
              </Text>
              <Text fontSize="sm">
                {fa ? 'مقدار' : 'Value'}: {a.observation.evidence.value ?? '—'}{' '}
                {a.observation.evidence.unit ?? ''}
              </Text>
              <Text fontSize="xs" color="fg.muted">
                {fa ? 'تعداد مشاهده' : 'Observations'}: {a.occurrences}
              </Text>
              {a.state !== 'RESOLVED' ? (
                <HStack flexWrap="wrap" gap="2">
                  <button
                    type="button"
                    disabled={!!pending}
                    onClick={() => void act(a, 'ACKNOWLEDGE')}
                  >
                    {fa ? 'تأیید' : 'Acknowledge'}
                  </button>
                  <button
                    type="button"
                    disabled={!!pending}
                    onClick={() => void act(a, a.state === 'SILENCED' ? 'UNSILENCE' : 'SILENCE')}
                  >
                    {a.state === 'SILENCED'
                      ? fa
                        ? 'لغو سکوت'
                        : 'Unsilence'
                      : fa
                        ? 'سکوت ۳۰ دقیقه‌ای'
                        : 'Silence 30 min'}
                  </button>
                </HStack>
              ) : null}
            </Stack>
          </Card.Body>
        </Card.Root>
      ))}
    </Stack>
  );
}
