import neostandard from 'neostandard'

/** @type {import("eslint").Linter.Config[]} */
export default [
	...neostandard({
		env: ['browser', 'webextensions'],
		globals: ['chrome', 'browser']
	}),
	{
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
			'nonblock-statement-body-position': ['error', 'beside'],
			'@stylistic/arrow-parens': ['error', 'as-needed'],
		}
	}
]
