import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react';

const config = defineConfig({
  globalCss: {
    'html, body, #root': {
      minHeight: '100%',
      bg: '#07111f',
      color: '#e7eef8',
    },
    body: {
      margin: '0',
      fontFamily:
        'Inter, Vazirmatn, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    },
    '*': {
      borderColor: '#1d2d42',
    },
    '::selection': {
      bg: '#1d4ed8',
      color: '#ffffff',
    },
  },
  theme: {
    semanticTokens: {
      colors: {
        bg: {
          DEFAULT: { value: '{colors.noc.canvas}' },
          subtle: { value: '{colors.noc.sidebar}' },
          muted: { value: '{colors.noc.surface}' },
          emphasized: { value: '{colors.noc.surface2}' },
          panel: { value: '{colors.noc.surface}' },
        },
        fg: {
          DEFAULT: { value: '{colors.noc.text}' },
          muted: { value: '{colors.noc.textMuted}' },
          subtle: { value: '{colors.noc.textSubtle}' },
        },
        border: {
          DEFAULT: { value: '{colors.noc.border}' },
          muted: { value: '{colors.noc.border}' },
          subtle: { value: '{colors.noc.border}' },
          emphasized: { value: '{colors.noc.borderStrong}' },
        },
      },
    },
    tokens: {
      colors: {
        noc: {
          canvas: { value: '#07111f' },
          sidebar: { value: '#091526' },
          surface: { value: '#0e1b2d' },
          surface2: { value: '#122237' },
          surface3: { value: '#162940' },
          border: { value: '#1d2d42' },
          borderStrong: { value: '#29415f' },
          text: { value: '#e7eef8' },
          textMuted: { value: '#8da2bd' },
          textSubtle: { value: '#617894' },
          accent: { value: '#2d8cff' },
          accentStrong: { value: '#1568d6' },
          healthy: { value: '#22c77a' },
          warning: { value: '#f6b73c' },
          critical: { value: '#ff5c6c' },
          info: { value: '#38bdf8' },
          unknown: { value: '#71839b' },
        },
      },
      radii: {
        nocPanel: { value: '12px' },
        nocControl: { value: '9px' },
      },
      shadows: {
        nocOverlay: { value: '0 18px 48px rgba(0, 0, 0, 0.38)' },
      },
    },
  },
});

export const nocSystem = createSystem(defaultConfig, config);

export const nocColors = {
  canvas: '#07111f',
  sidebar: '#091526',
  surface: '#0e1b2d',
  surface2: '#122237',
  surface3: '#162940',
  border: '#1d2d42',
  borderStrong: '#29415f',
  text: '#e7eef8',
  textMuted: '#8da2bd',
  textSubtle: '#617894',
  accent: '#2d8cff',
  accentStrong: '#1568d6',
  healthy: '#22c77a',
  warning: '#f6b73c',
  critical: '#ff5c6c',
  info: '#38bdf8',
  unknown: '#71839b',
} as const;
