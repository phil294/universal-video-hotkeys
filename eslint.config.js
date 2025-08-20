import neostandard from 'neostandard'
import jsdoc from 'eslint-plugin-jsdoc'
import custom__no_jsdoc_cast from './eslint-plugin-no-jsdoc-cast.js'
import custom__snake_case from './eslint-plugin-snake-case.js'

import eslint from '@eslint/js'
import globals from 'globals'
import typescript_eslint from 'typescript-eslint'

/** @type {(import("eslint").Linter.Config<import('eslint/rules').ESLintRules>)[]} */
export default [
	{
		ignores: ['dist*']
	},
	eslint.configs.recommended,
	...neostandard({
		env: ['browser', 'webextensions'],
		globals: ['chrome', 'browser']
	}),
	jsdoc.configs['flat/recommended-typescript-flavor-error'],
	{ languageOptions: { globals: globals.browser } },
	...typescript_eslint.configs.strictTypeChecked,
	...typescript_eslint.configs.stylisticTypeChecked,
	{
		languageOptions: {
			parserOptions: {
				project: true,
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
			},
		},
	},
	{
		plugins: {
			'custom--no-jsdoc-cast': custom__no_jsdoc_cast,
			'custom--snake-case': custom__snake_case
		},
		rules: {
			'@stylistic/indent': ['error', 'tab'],
			'@stylistic/no-tabs': 'off',
			camelcase: 'off',
			'prefer-const': 'off',
			'no-const-assign': 'off',
			'no-restricted-syntax': [
				'error',
				{
					selector: 'VariableDeclaration[kind="const"]',
					message: 'Use "let" instead of "const". Only "let" is allowed.'
				}
			],
			curly: ['error', 'multi'],
			'@stylistic/brace-style': ['error', '1tbs', { allowSingleLine: true }],
			'nonblock-statement-body-position': ['error', 'below'],
			'@stylistic/arrow-parens': ['error', 'as-needed'],
			'jsdoc/require-returns': 'off',
			'jsdoc/require-param': 'off',
			'jsdoc/require-property': 'off',
			'jsdoc/require-jsdoc': 'off',
			'jsdoc/require-param-description': 'off',
			// ...not compatible with JSDoc https://github.com/typescript-eslint/typescript-eslint/issues/9908 https://github.com/typescript-eslint/typescript-eslint/issues/8955#issuecomment-2097518639
			'@typescript-eslint/explicit-function-return-type': 'off',
			'@typescript-eslint/explicit-module-boundary-types': 'off',
			'@typescript-eslint/parameter-properties': 'off',
			'@typescript-eslint/typedef': 'off',
			// ...
			'custom--no-jsdoc-cast/no-jsdoc-cast': 'error',
			'custom--snake-case/snake-case': 'error',
			'no-void': 'off',
			'@typescript-eslint/no-misused-promises': 'off',
			'@typescript-eslint/no-confusing-void-expression': 'off',
		}
	}
]
