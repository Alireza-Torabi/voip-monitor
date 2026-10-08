import { Box, Button, HStack, Popover, Portal, Stack, Text } from '@chakra-ui/react';
import { createContext, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Language } from './i18n.js';

export interface LocalizedHelpText {
  en: string;
  fa: string;
}

export interface HelpContent {
  title: LocalizedHelpText;
  summary: LocalizedHelpText;
  why?: LocalizedHelpText;
  calculation?: LocalizedHelpText;
}

export type HelpKind =
  'navigation' | 'section' | 'field' | 'metric' | 'action' | 'status' | 'chart' | 'export';

const HelpLanguageContext = createContext<Language>('en');

export function HelpProvider({ language, children }: { language: Language; children: ReactNode }) {
  return <HelpLanguageContext.Provider value={language}>{children}</HelpLanguageContext.Provider>;
}

export function useHelpLanguage(): Language {
  return useContext(HelpLanguageContext);
}

export function localized(value: LocalizedHelpText, language: Language): string {
  return value[language];
}

function genericHelp(subject: string, kind: HelpKind): HelpContent {
  const title = { en: subject, fa: subject };
  const byKind: Record<HelpKind, Omit<HelpContent, 'title'>> = {
    navigation: {
      summary: {
        en: `Opens the “${subject}” area of the application.`,
        fa: `بخش «${subject}» را در برنامه باز می‌کند.`,
      },
      why: {
        en: 'Use navigation help to understand the purpose of a page before changing its controls.',
        fa: 'این راهنما کمک می‌کند قبل از تغییر کنترل‌ها بدانید این صفحه برای چه کاری است.',
      },
    },
    section: {
      summary: {
        en: `This section groups information and controls related to “${subject}”.`,
        fa: `این بخش اطلاعات و کنترل‌های مربوط به «${subject}» را کنار هم قرار می‌دهد.`,
      },
      why: {
        en: 'Read values together with the filters, status and scope shown in this section.',
        fa: 'مقادیر این بخش را همراه با فیلترها، وضعیت و محدوده‌ای که همین‌جا نمایش داده می‌شود تفسیر کنید.',
      },
    },
    field: {
      summary: {
        en: `Controls the value or filter for “${subject}”.`,
        fa: `مقدار یا فیلتر «${subject}» را کنترل می‌کند.`,
      },
      why: {
        en: 'Changing a field changes the current form or report scope; it is not saved unless an explicit save action exists.',
        fa: 'تغییر این فیلد محدوده فرم یا گزارش فعلی را عوض می‌کند و فقط وقتی ذخیره می‌شود که اقدام صریح ذخیره وجود داشته باشد.',
      },
    },
    metric: {
      summary: {
        en: `Shows the current value of “${subject}” for the active scope.`,
        fa: `مقدار فعلی «${subject}» را برای محدوده فعال نشان می‌دهد.`,
      },
      why: {
        en: 'Use it for quick comparison and trend awareness; inspect the page filters and source status before acting on the value.',
        fa: 'برای مقایسه سریع و تشخیص روند استفاده می‌شود؛ قبل از تصمیم‌گیری فیلترهای صفحه و وضعیت منبع را هم بررسی کنید.',
      },
      calculation: {
        en: 'Unless this help card shows a specific formula, the value comes from the normalized source data for the current scope.',
        fa: 'اگر در این راهنما فرمول مشخصی نوشته نشده باشد، مقدار از داده نرمال‌شده منبع در محدوده فعلی می‌آید.',
      },
    },
    action: {
      summary: {
        en: `Runs the “${subject}” action.`,
        fa: `عملیات «${subject}» را اجرا می‌کند.`,
      },
      why: {
        en: 'Use this action only after confirming the current filters and selected scope.',
        fa: 'این عملیات را بعد از بررسی فیلترهای فعلی و محدوده انتخاب‌شده اجرا کنید.',
      },
    },
    status: {
      summary: {
        en: `Explains the current “${subject}” status.`,
        fa: `وضعیت فعلی «${subject}» را توضیح می‌دهد.`,
      },
      why: {
        en: 'Status helps distinguish a healthy value from unavailable, stale or attention-required state.',
        fa: 'وضعیت کمک می‌کند مقدار سالم را از حالت ناموجود، قدیمی یا نیازمند توجه تشخیص دهید.',
      },
    },
    chart: {
      summary: {
        en: `Visualizes “${subject}” so differences and patterns are easier to compare.`,
        fa: `«${subject}» را به‌صورت بصری نمایش می‌دهد تا تفاوت‌ها و الگوها راحت‌تر مقایسه شوند.`,
      },
      why: {
        en: 'Charts support comparison; the exact numeric values remain authoritative.',
        fa: 'نمودار برای مقایسه است و عددهای دقیق همچنان مرجع اصلی هستند.',
      },
    },
    export: {
      summary: {
        en: `Exports “${subject}” using the filters and scope currently selected on the page.`,
        fa: `«${subject}» را با همان فیلترها و محدوده‌ای که الان در صفحه انتخاب شده خروجی می‌گیرد.`,
      },
      why: {
        en: 'Exports are useful for offline review, sharing and audit; sensitive files should be handled according to your organization policy.',
        fa: 'خروجی برای بررسی آفلاین، اشتراک‌گذاری و ممیزی مفید است؛ فایل‌های حساس باید طبق سیاست سازمان نگهداری شوند.',
      },
    },
  };
  return { title, ...byKind[kind] };
}

export function resolveHelp(
  help: HelpContent | undefined,
  subject: string | undefined,
  kind: HelpKind,
): HelpContent | undefined {
  return help ?? (subject ? genericHelp(subject, kind) : undefined);
}

export function HelpHint({
  help,
  subject,
  kind = 'section',
  size = 'sm',
}: {
  help?: HelpContent | undefined;
  subject?: string | undefined;
  kind?: HelpKind | undefined;
  size?: 'xs' | 'sm' | undefined;
}) {
  const language = useHelpLanguage();
  const content = useMemo(() => resolveHelp(help, subject, kind), [help, subject, kind]);
  const [hovered, setHovered] = useState(false);
  const [contentHovered, setContentHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const closeTimer = useRef<number | undefined>(undefined);

  if (!content) return null;

  const open = pinned || hovered || contentHovered;
  const title = localized(content.title, language);
  const summary = localized(content.summary, language);
  const why = content.why ? localized(content.why, language) : undefined;
  const calculation = content.calculation ? localized(content.calculation, language) : undefined;
  const fa = language === 'fa';

  function clearCloseTimer() {
    if (closeTimer.current !== undefined) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = undefined;
    }
  }

  function scheduleClose(target: 'trigger' | 'content') {
    clearCloseTimer();
    closeTimer.current = window.setTimeout(() => {
      if (target === 'trigger') setHovered(false);
      else setContentHovered(false);
    }, 120);
  }

  function closePinned() {
    clearCloseTimer();
    setPinned(false);
    setHovered(false);
    setContentHovered(false);
  }

  return (
    <Popover.Root
      open={open}
      onOpenChange={(details) => {
        if (!details.open) closePinned();
      }}
      positioning={{ placement: 'top', gutter: 8 }}
      lazyMount
      unmountOnExit
    >
      <Popover.Anchor display="inline-flex">
        <Button
          type="button"
          data-help-trigger
          aria-label={fa ? `راهنما: ${title}` : `Help: ${title}`}
          title={fa ? 'برای توضیح بیشتر کلیک یا مکث کنید' : 'Hover or click for help'}
          variant="plain"
          w={size === 'xs' ? '15px' : '17px'}
          h={size === 'xs' ? '15px' : '17px'}
          minW={size === 'xs' ? '15px' : '17px'}
          p="0"
          borderRadius="full"
          borderWidth="1px"
          borderColor={pinned ? 'noc.accent' : 'noc.borderStrong'}
          bg={pinned ? 'rgba(45,140,255,.18)' : 'rgba(255,255,255,.035)'}
          color={pinned ? 'noc.accent' : 'noc.textSubtle'}
          fontSize={size === 'xs' ? '9px' : '10px'}
          fontWeight="900"
          lineHeight="1"
          display="inline-flex"
          alignItems="center"
          justifyContent="center"
          flex="0 0 auto"
          _hover={{ borderColor: 'noc.accent', color: 'noc.accent', bg: 'rgba(45,140,255,.10)' }}
          _focusVisible={{
            outline: '2px solid',
            outlineColor: 'noc.accent',
            outlineOffset: '2px',
          }}
          onMouseEnter={() => {
            clearCloseTimer();
            setHovered(true);
          }}
          onMouseLeave={() => {
            if (!pinned) scheduleClose('trigger');
          }}
          onFocus={() => {
            clearCloseTimer();
            setHovered(true);
          }}
          onBlur={() => {
            if (!pinned) scheduleClose('trigger');
          }}
          onClick={(event) => {
            event.stopPropagation();
            clearCloseTimer();
            setPinned((current) => !current);
            setHovered(true);
          }}
        >
          ?
        </Button>
      </Popover.Anchor>
      <Portal>
        <Popover.Positioner>
          <Popover.Content
            data-help-content
            maxW="360px"
            minW={{ base: '280px', md: '320px' }}
            borderWidth="1px"
            borderColor="noc.borderStrong"
            bg="noc.surface3"
            color="noc.text"
            borderRadius="nocPanel"
            boxShadow="0 18px 48px rgba(0,0,0,.38)"
            overflow="hidden"
            dir={fa ? 'rtl' : 'ltr'}
            textAlign={fa ? 'right' : 'left'}
            onMouseEnter={() => {
              clearCloseTimer();
              setContentHovered(true);
            }}
            onMouseLeave={() => {
              if (!pinned) scheduleClose('content');
            }}
          >
            <Box p="3.5">
              <HStack align="start" justify="space-between" gap="3">
                <Box minW="0">
                  <Popover.Title fontSize="12px" fontWeight="800" color="noc.text">
                    {title}
                  </Popover.Title>
                  <Text mt="1.5" fontSize="11px" lineHeight="1.7" color="noc.textMuted">
                    {summary}
                  </Text>
                </Box>
                {pinned ? (
                  <Button
                    size="xs"
                    variant="ghost"
                    minW="26px"
                    h="26px"
                    p="0"
                    aria-label={fa ? 'بستن راهنما' : 'Close help'}
                    onClick={(event) => {
                      event.stopPropagation();
                      closePinned();
                    }}
                  >
                    ×
                  </Button>
                ) : null}
              </HStack>

              {why || calculation ? (
                <Stack gap="2.5" mt="3">
                  {why ? (
                    <Box>
                      <Text fontSize="9px" fontWeight="800" color="noc.accent" mb=".5">
                        {fa ? 'چرا مهم است؟' : 'Why it matters'}
                      </Text>
                      <Text fontSize="10px" lineHeight="1.7" color="noc.textMuted">
                        {why}
                      </Text>
                    </Box>
                  ) : null}
                  {calculation ? (
                    <Box>
                      <Text fontSize="9px" fontWeight="800" color="noc.warning" mb=".5">
                        {fa ? 'نحوه محاسبه' : 'How it is calculated'}
                      </Text>
                      <Text fontSize="10px" lineHeight="1.7" color="noc.textMuted">
                        {calculation}
                      </Text>
                    </Box>
                  ) : null}
                </Stack>
              ) : null}

              <Text
                mt="3"
                pt="2.5"
                borderTopWidth="1px"
                borderColor="noc.border"
                fontSize="9px"
                color="noc.textSubtle"
              >
                {pinned
                  ? fa
                    ? 'این راهنما ثابت شده است؛ برای بستن روی × یا بیرون آن کلیک کنید.'
                    : 'This help is pinned; click × or outside to close it.'
                  : fa
                    ? 'با Hover نمایش داده می‌شود؛ با کلیک روی ؟ ثابت می‌ماند.'
                    : 'Hover to preview; click ? to keep it open.'}
              </Text>
            </Box>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
}

export function HelpLabel({
  children,
  help,
  subject,
  kind = 'section',
  gap = '1.5',
}: {
  children: ReactNode;
  help?: HelpContent | undefined;
  subject?: string | undefined;
  kind?: HelpKind | undefined;
  gap?: string;
}) {
  return (
    <HStack as="span" gap={gap} align="center" minW="0">
      <Box as="span" minW="0">
        {children}
      </Box>
      <HelpHint help={help} subject={subject} kind={kind} />
    </HStack>
  );
}
