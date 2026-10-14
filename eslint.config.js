import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', '.tmp-bolt-source', 'src/app/App.tsx', 'src/components'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "CallExpression[callee.property.name='slice'][callee.object.callee.property.name='toISOString']",
          message:
            '.toISOString().slice(...) para truncar una fecha de calendario cruza por UTC y puede desplazar el día en America/Guatemala (UTC-6). Usa toDtoCalendarDate() de @/shared/types/common.',
        },
      ],
    },
  },
  {
    // toDomainDate/toDtoDate/toDomainCalendarDate/toDtoCalendarDate son los
    // únicos puntos permitidos de conversión Date<->string del contrato de
    // datos (D-010) — todo lo demás pasa por ellos.
    files: ['src/shared/types/common.ts', 'src/shared/utils/date.ts'],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
  {
    // Excepción temporal: estos 3 archivos de front-desk tienen trabajo en
    // vuelo hoy (ver docs/DECISIONES.md D-010) y no se tocan en esta rama
    // para no generar conflictos. Ya tienen el patrón prohibido; se retira
    // esta excepción en cuanto se corrijan.
    files: [
      'src/modules/front-desk/components/workspace/ReceptionContent.tsx',
      'src/modules/front-desk/components/workspace/ReceptionModals.tsx',
      'src/modules/front-desk/components/workspace/ReservationDetail.tsx',
    ],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
);
