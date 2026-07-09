/**
 * @typedef {'image' | 'video'} MediaKind
 */

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
 * @property {(ctx: SiteResolveContext) => string | { url?: string, fallbackUrl?: string, mediaKind?: MediaKind } | null | undefined} resolveImageUrl
 * @property {(ctx: SiteResolveContext) => string | undefined} resolveCardName
 * @property {(target: Element | null) => { el: Element, url: string } | null} [findVideoTarget]
 */

/**
 * @typedef {object} SavePayload
 * @property {string} url
 * @property {string} website
 * @property {string} pageTitle
 * @property {MediaKind} [mediaKind]
 * @property {string} [fallbackUrl]
 * @property {string} [name]
 */

export {};
