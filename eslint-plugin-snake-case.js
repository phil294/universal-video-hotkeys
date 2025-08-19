/** @file ESLint plugin to enforce snake_case for custom identifiers */

let is_snake_case = (/** @type {string} */ name) => /^[a-z_$][a-z0-9_]*$/.test(name)

let to_snake_case = (/** @type {string} */ name) => {
	return name
		.replace(/([A-Z])/g, '_$1')
		.toLowerCase()
		.replace(/^_/, '')
}

/** @type {import('eslint/lib/types').Rule.RuleModule} */
let rule = {
	meta: {
		type: 'layout',
		docs: {
			description: 'Enforce snake_case for custom variables and parameters'
		},
		fixable: 'code',
		schema: []
	},

	create (context) {
		return {
			Identifier (node) {
				let name = node.name

				// Skip if already snake_case or known DOM API
				if (is_snake_case(name))
					return

				// Skip destructuring of DOM APIs (e.g., { innerHTML } = element)
				if (node.parent.type === 'Property' && node.parent.key === node && node.parent.shorthand)
					return

				// Skip member expressions where we're accessing DOM APIs
				if (node.parent.type === 'MemberExpression' && node.parent.property === node)
					return

				// Skip import/export specifiers
				if (node.parent.type === 'ImportSpecifier' || node.parent.type === 'ExportSpecifier')
					return

				// Only check variable declarations, function parameters, and function names
				let should_check = (
					node.parent.type === 'VariableDeclarator' ||
					node.parent.type === 'FunctionDeclaration' ||
					node.parent.type === 'ArrowFunctionExpression' ||
					node.parent.type === 'FunctionExpression' ||
					(node.parent.type === 'AssignmentPattern' && node.parent.left === node) // Default parameters
				)

				if (should_check)
					context.report({
						node,
						message: `Use snake_case for custom identifier '${name}'. Suggestion: '${to_snake_case(name)}'`,
						fix (fixer) {
							return fixer.replaceText(node, to_snake_case(name))
						}
					})
			}
		}
	}
}

export default {
	rules: {
		'snake-case': rule
	}
}
