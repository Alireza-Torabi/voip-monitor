import {
  Badge,
  Box,
  Card,
  Heading,
  HStack,
  NativeSelect,
  SimpleGrid,
  Stack,
  Text,
} from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import {
  api,
  ApiError,
  type LiveQualityResponse,
  type LiveQualityMetric,
  type PbxProfile,
} from './api.js';
import type { Language } from './i18n.js';

function metric(m: LiveQualityMetric) {
  return m.availability === 'AVAILABLE' && Number.isFinite(m.value)
    ? `${m.value} ${m.unit === 'RTP_TICKS' ? 'RTP ticks' : m.unit === 'COUNT' ? 'packets' : (m.unit ?? '')}`
    : 'Unknown';
}
export function CallQualityWorkspace({
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
  const [data, setData] = useState<LiveQualityResponse | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    async function load() {
      if (!id) {
        setData(null);
        return;
      }
      try {
        const result = await api.callQuality(id);
        if (live) {
          setData(result);
          setError('');
        }
      } catch (e) {
        if (live) {
          setData(null);
          setError(fa ? 'دریافت کیفیت تماس ممکن نیست.' : 'Call quality unavailable.');
          if (e instanceof ApiError && e.status === 401) onUnauthorized();
        }
      }
    }
    void load();
    const t = setInterval(() => void load(), 5000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [id, fa, onUnauthorized]);
  const samples = data?.samples ?? [];
  const legs = new Set(samples.map((s) => s.legId));
  const measured = samples.filter((s) => s.jitter.availability === 'AVAILABLE');
  const missing = samples.filter((s) => s.jitter.availability !== 'AVAILABLE');
  return (
    <Stack gap="5" data-workspace="call-quality">
      <HStack justify="space-between" align="start" flexWrap="wrap">
        <Box>
          <Heading size="lg">{fa ? 'کیفیت تماس زنده' : 'Live Call Quality'}</Heading>
          <Text color="fg.muted" fontSize="sm">
            {fa
              ? 'مشاهدات RTCP موقت؛ بدون ذخیره تاریخچه یا برآورد کیفیت'
              : 'Temporary RTCP observations; no historical storage or inferred quality rating'}
          </Text>
        </Box>
        <NativeSelect.Root maxW="260px">
          <NativeSelect.Field
            aria-label={fa ? 'انتخاب PBX' : 'Select PBX'}
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
      <SimpleGrid columns={{ base: 1, md: 3 }} gap="3">
        {[
          { label: fa ? 'کانال‌های دارای گزارش' : 'Reported channel legs', value: legs.size },
          {
            label: fa ? 'گزارش‌های دارای Jitter خام' : 'Reports with raw jitter',
            value: measured.length,
          },
          { label: fa ? 'گزارش‌های بدون Jitter' : 'Reports missing jitter', value: missing.length },
        ].map((card) => (
          <Card.Root key={card.label} variant="outline">
            <Card.Body>
              <Text fontSize="sm" color="fg.muted">
                {card.label}
              </Text>
              <Heading size="2xl">{card.value}</Heading>
            </Card.Body>
          </Card.Root>
        ))}
      </SimpleGrid>
      <HStack gap="2" flexWrap="wrap">
        <Badge colorPalette={samples.length ? 'green' : 'gray'}>
          {samples.length ? 'RTCP observed' : 'UNKNOWN'}
        </Badge>
        <Text fontSize="sm" color="fg.muted">
          {fa
            ? 'تعداد تماس ضعیف، میانگین کیفیت و MOS تا اعتبارسنجی مقیاس‌ها قابل‌محاسبه نیستند.'
            : 'Poor-call count, average quality and MOS are unavailable until source scales are validated.'}
        </Text>
      </HStack>
      {samples.length === 0 ? (
        <Card.Root variant="outline">
          <Card.Body>
            <Text>
              {fa
                ? 'در حال حاضر گزارش RTCP قابل‌تطبیق با کانال فعال موجود نیست. این به معنی کیفیت خوب یا صفر بودن Packet Loss نیست.'
                : 'No RTCP report is currently matched to an active channel. This does not imply good quality or zero packet loss.'}
            </Text>
          </Card.Body>
        </Card.Root>
      ) : (
        <Stack gap="3">
          {samples.map((s, i) => (
            <Card.Root variant="outline" key={`${s.legId}-${s.direction}-${s.reportIndex}-${i}`}>
              <Card.Body>
                <Stack gap="2">
                  <HStack justify="space-between" flexWrap="wrap">
                    <Text fontWeight="semibold">
                      {fa ? 'کانال' : 'Leg'}: {s.legId}
                    </Text>
                    <Badge>{s.direction}</Badge>
                  </HStack>
                  <SimpleGrid columns={{ base: 1, md: 3 }} gap="2">
                    <Text fontSize="sm">Jitter: {metric(s.jitter)}</Text>
                    <Text fontSize="sm">Cumulative loss: {metric(s.cumulativeLostPackets)}</Text>
                    <Text fontSize="sm">Loss %: {metric(s.packetLossPercent)}</Text>
                    <Text fontSize="sm">RTT: {metric(s.rtt)}</Text>
                    <Text fontSize="sm">MOS: {metric(s.mos)}</Text>
                    <Text fontSize="sm">
                      Codec: {s.codec.availability === 'AVAILABLE' ? s.codec.name : 'Unknown'}
                    </Text>
                  </SimpleGrid>
                  <Text fontSize="xs" color="fg.muted">
                    {s.observedAt} {s.reportSourceSsrc ? ` · SSRC ${s.reportSourceSsrc}` : ''}
                  </Text>
                </Stack>
              </Card.Body>
            </Card.Root>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
