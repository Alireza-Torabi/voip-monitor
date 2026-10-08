import { Box, HStack, SimpleGrid, Stack, Text } from '@chakra-ui/react';
import type { HistoricalQueueAbandonmentAnalytics } from '@voip-monitor/shared';
import type { messages } from './i18n.js';

type TextMap = (typeof messages)['en'] | (typeof messages)['fa'];

interface Slice {
  label: string;
  value: number;
  color: string;
}

function percent(value: number, total: number): string {
  if (total <= 0) return '0.0%';
  return `${((value / total) * 100).toFixed(1)}%`;
}

export function QueueOutcomeChart({
  analytics,
  text,
}: {
  analytics: HistoricalQueueAbandonmentAnalytics;
  text: TextMap;
}) {
  const knownOutcomes =
    analytics.connectedCalls + analytics.abandonedCalls + analytics.timedOutCalls;
  const otherCalls = Math.max(0, analytics.enteredCalls - knownOutcomes);
  const slices: Slice[] = [
    { label: text.historyQueueConnected, value: analytics.connectedCalls, color: '#38A0FF' },
    { label: text.historyQueueAbandoned, value: analytics.abandonedCalls, color: '#FF5C8A' },
    { label: text.historyQueueTimedOut, value: analytics.timedOutCalls, color: '#F6B94A' },
    { label: text.historyQueueChartOther, value: otherCalls, color: '#72849D' },
  ].filter((slice) => slice.value > 0);
  const chartTotal = slices.reduce((total, slice) => total + slice.value, 0);
  let offset = 0;

  return (
    <Box
      borderWidth="1px"
      borderColor="noc.border"
      borderRadius="nocControl"
      bg="rgba(6, 19, 34, .44)"
      p={{ base: '4', md: '5' }}
    >
      <Stack gap="1" mb="4">
        <Text fontSize="13px" fontWeight="800" color="noc.text">
          {text.historyQueueChartTitle}
        </Text>
        <Text fontSize="10px" color="noc.textSubtle">
          {text.historyQueueChartHint}
        </Text>
      </Stack>
      <SimpleGrid columns={{ base: 1, lg: 2 }} gap={{ base: '5', lg: '8' }} alignItems="center">
        <Box position="relative" w="240px" h="240px" mx="auto">
          <svg
            viewBox="0 0 240 240"
            width="240"
            height="240"
            role="img"
            aria-label={text.historyQueueChartTitle}
          >
            <defs>
              <filter id="queue-donut-glow" x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <circle
              cx="120"
              cy="120"
              r="82"
              fill="none"
              stroke="rgba(133, 159, 190, .14)"
              strokeWidth="28"
            />
            {chartTotal > 0
              ? slices.map((slice) => {
                  const share = (slice.value / chartTotal) * 100;
                  const gap = Math.min(0.8, share * 0.25);
                  const visibleShare = Math.max(share - gap, 0);
                  const dashOffset = -offset;
                  offset += share;
                  return (
                    <circle
                      key={slice.label}
                      cx="120"
                      cy="120"
                      r="82"
                      pathLength="100"
                      fill="none"
                      stroke={slice.color}
                      strokeWidth="28"
                      strokeLinecap="round"
                      strokeDasharray={`${visibleShare} ${100 - visibleShare}`}
                      strokeDashoffset={dashOffset}
                      transform="rotate(-90 120 120)"
                      filter="url(#queue-donut-glow)"
                    />
                  );
                })
              : null}
          </svg>
          <Stack
            position="absolute"
            inset="0"
            align="center"
            justify="center"
            gap="0"
            pointerEvents="none"
          >
            <Text fontSize="30px" lineHeight="1" fontWeight="900" color="noc.text" dir="ltr">
              {analytics.enteredCalls.toLocaleString()}
            </Text>
            <Text mt="2" fontSize="10px" color="noc.textSubtle" fontWeight="700">
              {text.historyQueueChartTotal}
            </Text>
          </Stack>
        </Box>
        <Stack gap="2.5">
          {slices.map((slice) => (
            <HStack
              key={slice.label}
              justify="space-between"
              gap="3"
              borderWidth="1px"
              borderColor="rgba(130, 158, 190, .14)"
              borderRadius="nocControl"
              bg="rgba(17, 37, 61, .52)"
              px="3"
              py="2.5"
            >
              <HStack gap="2.5" minW="0">
                <Box w="9px" h="9px" borderRadius="full" bg={slice.color} flex="0 0 auto" />
                <Text fontSize="11px" color="noc.textMuted" fontWeight="700" truncate>
                  {slice.label}
                </Text>
              </HStack>
              <HStack gap="3" flex="0 0 auto" dir="ltr">
                <Text fontSize="12px" color="noc.text" fontWeight="800">
                  {slice.value.toLocaleString()}
                </Text>
                <Text minW="48px" textAlign="right" fontSize="10px" color="noc.textSubtle">
                  {percent(slice.value, chartTotal)}
                </Text>
              </HStack>
            </HStack>
          ))}
        </Stack>
      </SimpleGrid>
    </Box>
  );
}
