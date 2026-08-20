/**
 * Transform object parsed from raw API response to format compatible with
 * earlier versions of the API. This function:
 *  - removes 'praw_' prefix from keys
 *  - lower first letter of keys
 *  - replaces empty strings with `undefined`
 *
 * Note: GUS API returns more prefixed keys than 'praw_'. Removing only this
 * prefix was initial partial implementation. This is inconsistent approach and
 * thus marked as deprecated, left only for compatibility with legacy code.
 *
 * @example
 * ```js
 * import Bir from 'bir1'
 * import { legacy } from 'bir1/normalize'
 * const bir = new Bir({ normalizeFn: legacy })
 * const result = await bir.search('010058960')
 * ```
 *
 * @param obj object to normalize
 * @deprecated
 */
export declare function legacy(obj: any): any;
/**
 * Transform object parsed from raw API response to convenient format commonly
 * used in modern JavaScript applications. This is subjective and opinionated.
 * This function:
 * - remove prefixes from keys (e.g. `fiz_`, `praw_`, ...)
 * - lower camel case keys
 * - unifies some keys (e.g. `regon9` -> `regon`)
 * - replaces empty strings with `undefined`
 *
 * @example
 * ```js
 * import Bir from 'bir1'
 * import { modern } from 'bir1/normalize'
 * const bir = new Bir({ normalizeFn: modern })
 * const result = await bir.search('010058960')
 * ```
 *
 * @param obj object to normalize
 * @beta
 */
export declare function modern(obj: any): any;
