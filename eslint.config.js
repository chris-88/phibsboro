import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules', 'spec'] },

  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,

  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },

  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat['recommended-latest'], reactRefresh.configs.vite],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector: 'MemberExpression[property.name=/^toLocale(String|DateString|TimeString)$/]',
          message: 'Use formatEventTime() from @/lib/time. CLAUDE.md section 3, decision D35.',
        },
        {
          selector:
            "NewExpression[callee.object.name='Intl'][callee.property.name='DateTimeFormat']",
          message: 'Use formatEventTime() from @/lib/time. CLAUDE.md section 3, decision D35.',
        },
        {
          selector: 'Identifier[name=/SERVICE_ROLE/]',
          message: 'The service-role key never appears in the browser bundle. Decision D38.',
        },
      ],
    },
  },

  // Generated shadcn primitives export their cva variants next to the component, which is
  // the library's own shape and what every consuming story imports. Fast refresh is a dev
  // convenience; the rule is off for these files only, and nothing else is relaxed.
  {
    files: ['src/components/ui/**/*.tsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },

  // The one formatter in the codebase is allowed to format. Scoped to the date rules only,
  // so no-explicit-any and everything else still apply here. Must be its own block: an
  // `ignores` entry on the project block would lift no-explicit-any too. Turning off
  // no-restricted-syntax also lifts the SERVICE_ROLE selector for this file, which is why
  // scripts/check-conventions.mjs repeats that check across the whole tree.
  {
    files: ['src/lib/time.ts'],
    rules: { 'no-restricted-syntax': 'off' },
  },

  // Plain JS tooling — eslint.config.js, scripts/*.mjs — is outside both tsconfigs, so the
  // type-aware rules have no program to consult. Lint it without them.
  {
    files: ['**/*.{js,mjs,cjs}'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: globals.node },
  },

  // vite.config.ts and vitest.config.ts run in Node, not the browser.
  {
    files: ['*.config.ts'],
    languageOptions: { globals: globals.node },
  },

  prettier,
)
