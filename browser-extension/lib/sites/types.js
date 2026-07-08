/**
 * @typedef {object} SiteResolveContext
 * @property {Element} targetEl
 * @property {string} rawUrl
 * @property {string} pageUrl
 * @property {string} pageTitle
 */

/**
 * @typedef {object} SiteHandler
 * @property {string} id
 * @property {(ctx: SiteResolveContext) => string | null | undefined} resolveImageUrl
 * @property {(ctx: SiteResolveContext) => string | undefined} resolveCardName
 */

/**
 * @typedef {object} SavePayload
 * @property {string} url
 * @property {string} website
 * @property {string} pageTitle
 * @property {string} [name]
 */

export {};
