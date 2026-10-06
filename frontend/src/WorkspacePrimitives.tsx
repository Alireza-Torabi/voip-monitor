import {
  Box,
  Flex,
  HStack,
  Input,
  NativeSelect,
  Spinner,
  Text,
  type BoxProps,
} from '@chakra-ui/react';
import type { ReactNode } from 'react';
import { NocPanel, SectionHeader, StatusIndicator, type OperationalTone } from './NocPrimitives.js';

export function WorkspaceHeader({
  title,
  description,
  status,
  actions,
}: {
  title: string | ReactNode;
  description?: string | undefined;
  status?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <Flex
      align={{ base: 'stretch', lg: 'center' }}
      justify="space-between"
      direction={{ base: 'column', lg: 'row' }}
      gap="4"
      minW="0"
    >
      <Box minW="0">
        <SectionHeader title={title} {...(description ? { description } : {})} />
        {status ? <Box mt="2">{status}</Box> : null}
      </Box>
      {actions ? <Box flex="0 0 auto">{actions}</Box> : null}
    </Flex>
  );
}

export function WorkspaceToolbar({ children }: { children: ReactNode }) {
  return (
    <NocPanel p="3">
      <Flex gap="3" align={{ base: 'stretch', md: 'end' }} flexWrap="wrap">
        {children}
      </Flex>
    </NocPanel>
  );
}

export function WorkspaceField({
  label,
  children,
  grow = true,
}: {
  label: ReactNode;
  children: ReactNode;
  grow?: boolean;
}) {
  return (
    <Box minW={{ base: '100%', sm: '190px' }} flex={grow ? '1 1 220px' : '0 0 auto'}>
      <Text
        fontSize="10px"
        color="noc.textSubtle"
        fontWeight="700"
        letterSpacing=".06em"
        textTransform="uppercase"
        mb="1.5"
      >
        {label}
      </Text>
      {children}
    </Box>
  );
}

export function WorkspaceSearch({
  value,
  onChange,
  placeholder,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  ariaLabel?: string | undefined;
}) {
  return (
    <Input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      aria-label={ariaLabel}
      bg="noc.surface2"
      borderColor="noc.border"
      borderRadius="nocControl"
      h="38px"
      fontSize="12px"
      _focus={{ borderColor: 'noc.accent', boxShadow: '0 0 0 1px var(--chakra-colors-noc-accent)' }}
    />
  );
}

export function WorkspaceSelect({
  value,
  onChange,
  children,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  ariaLabel?: string | undefined;
}) {
  return (
    <NativeSelect.Root>
      <NativeSelect.Field
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={ariaLabel}
        bg="noc.surface2"
        borderColor="noc.border"
        borderRadius="nocControl"
        h="38px"
        fontSize="12px"
      >
        {children}
      </NativeSelect.Field>
      <NativeSelect.Indicator />
    </NativeSelect.Root>
  );
}

export function WorkspaceState({
  tone = 'unknown',
  title,
  detail,
  loading = false,
  role,
}: {
  tone?: OperationalTone;
  title: ReactNode;
  detail?: ReactNode;
  loading?: boolean;
  role?: 'alert' | 'status' | undefined;
}) {
  return (
    <NocPanel p="4" role={role}>
      <Flex align="center" gap="3">
        {loading ? (
          <Spinner size="sm" color="noc.accent" />
        ) : (
          <StatusIndicator tone={tone} label={title} />
        )}
        {detail ? (
          <Text fontSize="12px" color="noc.textMuted">
            {detail}
          </Text>
        ) : null}
      </Flex>
    </NocPanel>
  );
}

export function DataSurface({
  title,
  meta,
  children,
  footer,
  ...props
}: BoxProps & {
  title?: ReactNode;
  meta?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <NocPanel overflow="hidden" {...props}>
      {title || meta ? (
        <Flex
          px="4"
          py="3"
          justify="space-between"
          align="center"
          gap="3"
          borderBottomWidth="1px"
          borderColor="noc.border"
        >
          <Text fontSize="12px" color="noc.text" fontWeight="600">
            {title}
          </Text>
          {meta ? (
            <Text fontSize="11px" color="noc.textSubtle">
              {meta}
            </Text>
          ) : null}
        </Flex>
      ) : null}
      <Box minW="0">{children}</Box>
      {footer ? (
        <Flex
          px="4"
          py="3"
          borderTopWidth="1px"
          borderColor="noc.border"
          justify="space-between"
          align="center"
          gap="3"
        >
          {footer}
        </Flex>
      ) : null}
    </NocPanel>
  );
}

export function WorkspaceStatusPills({
  items,
}: {
  items: Array<{ label: ReactNode; tone: OperationalTone }>;
}) {
  return (
    <HStack gap="3" flexWrap="wrap">
      {items.map((item, index) => (
        <StatusIndicator key={index} tone={item.tone} label={item.label} />
      ))}
    </HStack>
  );
}
