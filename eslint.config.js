import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
    { ignores: ['**/dist/**', '**/node_modules/**'] },
    ...tseslint.configs.recommended,
    prettier,
    {
        rules: {
            curly: 'error',
            '@typescript-eslint/no-unused-vars': [
                'error',
                { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
            ],
        },
    },
    {
        // Tests legitimately use `any` (mocks) and keep intentionally-unused setup bindings.
        files: ['**/__tests__/**', '**/*.test.ts'],
        rules: {
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unused-vars': 'off',
        },
    }
);
