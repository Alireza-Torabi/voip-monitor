import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', 'coverage/**'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['backend/src/**/*.ts', 'backend/test/**/*.mjs'],
    languageOptions: {
      globals: {
        process: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        fetch: 'readonly',
      },
    },
  },
  {
    files: ['frontend/src/**/*.{ts,tsx}', 'frontend/test/**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        document: 'readonly',
        navigator: 'readonly',
      },
    },
  },
);
