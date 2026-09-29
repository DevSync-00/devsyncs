import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';

export default defineConfig([
  ...nextVitals,
  {
    rules: {
      'react/no-unescaped-entities': 'off',
      // These React Compiler rules were added to Next's preset after this
      // codebase was written. Keep the pre-upgrade lint contract while the
      // affected components are migrated incrementally.
      'react-hooks/error-boundaries': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/static-components': 'off',
    },
  },
  globalIgnores([
    '.next/**',
    '.devsync/**',
    '.devsync-projects/**',
    'coverage/**',
    'node_modules/**',
    'out/**',
  ]),
]);
