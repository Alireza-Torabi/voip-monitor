import { Box, Flex, Heading, Text, type BoxProps, type FlexProps } from '@chakra-ui/react';
import type { ReactNode } from 'react';
import { HelpHint, type HelpContent, type HelpKind } from './ContextHelp.js';

export type OperationalTone = 'healthy' | 'warning' | 'critical' | 'info' | 'unknown';

const toneColor: Record<OperationalTone, string> = {
  healthy: 'noc.healthy',
  warning: 'noc.warning',
  critical: 'noc.critical',
  info: 'noc.info',
  unknown: 'noc.unknown',
};

export function StatusIndicator({ tone, label }: { tone: OperationalTone; label: ReactNode }) {
  return (
    <Flex align="center" gap="2" minW="0">
      <Box w="7px" h="7px" borderRadius="full" bg={toneColor[tone]} flex="0 0 auto" />
      <Text fontSize="12px" color={toneColor[tone]} truncate>
        {label}
      </Text>
      <HelpHint subject={typeof label === 'string' ? label : undefined} kind="status" size="xs" />
    </Flex>
  );
}

export function NocPanel({
  children,
  ...props
}: BoxProps & {
  children: ReactNode;
}) {
  return (
    <Box
      bg="noc.surface"
      borderWidth="1px"
      borderColor="noc.border"
      borderRadius="nocPanel"
      minW="0"
      {...props}
    >
      {children}
    </Box>
  );
}

export function NocInset({
  children,
  ...props
}: BoxProps & {
  children: ReactNode;
}) {
  return (
    <Box
      bg="noc.surface2"
      borderWidth="1px"
      borderColor="noc.border"
      borderRadius="nocControl"
      minW="0"
      {...props}
    >
      {children}
    </Box>
  );
}

export function SectionHeader({
  title,
  description,
  action,
  help,
  helpSubject,
  helpKind = 'section',
  ...props
}: Omit<FlexProps, 'title'> & {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  help?: HelpContent | undefined;
  helpSubject?: string | undefined;
  helpKind?: HelpKind | undefined;
}) {
  return (
    <Flex align="start" justify="space-between" gap="4" minW="0" {...props}>
      <Box minW="0">
        <Flex align="center" gap="1.5" minW="0">
          <Heading size="md" color="noc.text" letterSpacing="-0.01em">
            {title}
          </Heading>
          <HelpHint
            help={help}
            subject={helpSubject ?? (typeof title === 'string' ? title : undefined)}
            kind={helpKind}
          />
        </Flex>
        {description ? (
          <Text mt="1" fontSize="12px" color="noc.textMuted">
            {description}
          </Text>
        ) : null}
      </Box>
      {action ? <Box flex="0 0 auto">{action}</Box> : null}
    </Flex>
  );
}
