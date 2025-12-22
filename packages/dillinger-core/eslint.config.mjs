import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import tseslint from '@typescript-eslint/eslint-plugin';
import react from 'eslint-plugin-react';

export default [
  {
    ignores: ['.next/**', 'out/**', 'node_modules/**'],
  },
  ...nextCoreWebVitals,
  {
    plugins: {
      '@typescript-eslint': tseslint,
      react,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@next/next/no-html-link-for-pages': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'prefer-const': 'warn',
      'no-useless-catch': 'warn',
      'react/no-unescaped-entities': 'warn',
    },
  },
  {
    files: ['lib/services/**/*.ts'],
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'warn',
      'prefer-const': 'off',
      'no-useless-catch': 'off',
    },
  },
];
