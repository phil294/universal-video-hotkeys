/* eslint-disable custom--no-jsdoc-cast/no-jsdoc-cast */

/** @type {import('@eslint/core').RuleDefinition} */
let rule = {
	meta: {
		type: 'problem',
		docs: {
			description: 'Disallow JSDoc type casting /** @type {x} */ (something)',
			category: 'Best Practices'
		},
		messages: {
			noJSDocCast: 'JSDoc type casting /** @type {x} */ (something) is forbidden. Use proper TypeScript types instead.'
		}
	},
	create (context) {
		let source_code = context.sourceCode || context.getSourceCode()
		let text = source_code.getText()

		return {
			Program () {
				let regex = /\*\/\s*\(/g
				let match

				while ((match = regex.exec(text)) !== null) {
					let start_index = match.index
					let end_index = start_index + match[0].length - 1

					let start_loc = source_code.getLocFromIndex(start_index)
					let end_loc = source_code.getLocFromIndex(end_index)

					context.report({
						loc: { start: start_loc, end: end_loc },
						messageId: 'noJSDocCast'
					})
				}
			}
		}
	}
}

export default {
	rules: {
		'no-jsdoc-cast': rule
	}
}
