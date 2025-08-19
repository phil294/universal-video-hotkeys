/** @type {import('eslint/lib/types').Rule.RuleModule} */
let rule = {
	meta: {
		type: 'problem',
		docs: {
			// eslint-disable-next-line custom--no-jsdoc-cast/no-jsdoc-cast
			description: 'Disallow JSDoc type casting /** @type {x} */ (something)',
			category: 'Best Practices'
		},
		messages: {
			// eslint-disable-next-line custom--no-jsdoc-cast/no-jsdoc-cast
			noJSDocCast: 'JSDoc type casting /** @type {x} */ (something) is forbidden. Use proper TypeScript types instead.'
		}
	},
	create (context) {
		let text = context.sourceCode.getText()
		return {
			Program () {
				let regex = /\*\/\s*\(/g
				let match

				while ((match = regex.exec(text)) !== null) {
					let start_index = match.index
					let end_index = start_index + match[0].length - 1

					let start_loc = context.sourceCode.getLocFromIndex(start_index)
					let end_loc = context.sourceCode.getLocFromIndex(end_index)

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
