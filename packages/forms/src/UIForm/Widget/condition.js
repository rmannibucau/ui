import get from 'lodash/get';
import findIndex from 'lodash/findIndex';

function toNumber(value) {
	if (typeof value === 'number') {
		return value;
	}
	if (typeof value === 'string') {
		return Number(value);
	}
	const error = { error: 'the passed value is not a string or a number', value };
	throw error;
}

function toString(value) {
	if (!value) {
		return value;
	}
	if (typeof value === 'number') {
		return JSON.stringify(value);
	}
	if (typeof value === 'string') {
		return value.toString();
	}
	const error = { error: 'the passed value is not a string or a number', value };
	throw error;
}

function parseStrategy(strategy) {
	if (!strategy) {
		return undefined;
	}

	const start = strategy.indexOf('(');
	if (start > 0) {
		const end = strategy.indexOf(')', start);
		if (end > 0) {
			const params = strategy.substring(start + 1, end).split(';')
				.map(it => {
					const sep = it.indexOf('=');
					if (sep > 0) {
						return {
							[it.substring(0, sep).trim()]: it.substring(sep + 1, it.length).trim(),
						};
					}
					return {
						value: it.trim(),
					};
				})
				.reduce((a, v) => ({
					...a,
					...v,
				}), {});
			return {
				name: strategy.substring(0, start).toLowerCase(),
				params,
			};
		}
	}
	return {
		name: strategy.toLowerCase(),
		params: {},
	};
}

function toEvaluator(value, strategyConfig) {
	switch (strategyConfig.name) {
		case 'length':
			if (value && value.length) {
				const length = value.length;
				return expected => length === toNumber(expected);
			}
			return expected => expected === 0 || expected === '0';
		case 'contains':
			if (!value) {
				return () => false;
			}
			if (strategyConfig.params.lowercase === 'true') { // allows case insensitve comparison
				return expected => value && toString(value).toLowerCase().includes(expected);
			}
			return expected => value && toString(value).includes(expected);
		default:
			return () => value;
	}
}

function evaluateInlineCondition(properties, condition) {
	if (!condition.path || !condition.values) {
		return true;
	}

	const strategyConfig = parseStrategy(condition.strategy);
	const value = get(properties, condition.path);
	let evaluator;
	if (strategyConfig) {
		evaluator = toEvaluator(value, strategyConfig);
	} else {
		evaluator = expected => value === expected || (value && toString(value) === expected);
	}
	return (condition.shouldBe !== false) === (findIndex(condition.values, evaluator) >= 0);
}

function evaluateChildrenCondition(properties, condition) {
	if (!condition.children || condition.children.length === 0) {
		return true;
	}
	const evaluator =
		(condition.childrenOperator || 'AND').toUpperCase() === 'AND'
			? Array.prototype.every
			: Array.prototype.some;
	return evaluator.call(
		condition.children,
		cond =>
			evaluateInlineCondition(properties, cond) && evaluateChildrenCondition(properties, cond),
	);
}

/**
 * Evaluate a list (array) of conditions against a contextual set of values (properties).
 * Condition specification is done through objects with the following attributes:
 * <ul>
 *   <li><em>values</em> (required): list of values compared to the evaluated value</li>
 *   <li><em>path</em> (required): the path used to extract the value from properties
 *   to use to compare to values</li>
 *   <li><em>shouldBe</em> (optional): should the evaluation activate this widget when
 *   true (default) or false (when shouldBe = true).</li>
 *   <li><em>strategy</em> (optional): by default the property value extraction
 *   just uses the path, but for some cases like array you can want some more advanced strategy
 *   like extracting the length. For such cases, there are some <code>evaluationStrategy</code>.
 *   Currently you can set this property to <code>length</code> to evaluate the length of an array
 *   when the extracted instance is an array, otherwise it will set the value to zero. Other
 *   strategy values will just return false.</li>
 *   <li><em>children</em>: an array of nested conditions</li>
 *   <li><em>childrenOperator</em>: how to combine children (OR/AND)</li>
 * </ul>
 *
 * @example {
 *   values:["A", "B"],
 *   path: "someProp.someArray",
 *   shouldBe: true,
 *   evaluationStrategy: "length",
 *   children: [],
 *   childrenOperator: "OR",
 * }
 *
 * The combination of the conditions is done through an <code>AND</code>
 * whereas, for a single condition, the test against <code>values</code>
 * is an <code>includes</code> (<code>OR</code>).
 *
 * @param properties source of the value provider to evaluate conditions.
 * @param conditions array of conditions to evaluate.
 * @returns true if the conditions are met, false otherwise.
 */
export default function shouldRender(condition, properties) {
	if (!condition) {
		return true;
	}

	// quit fast condition (don't evaluate the whole graph)
	if (!evaluateInlineCondition(properties, condition)) {
		return false;
	}

	// navigate the nested graph
	return evaluateChildrenCondition(properties, condition);
}
