(() => {
  const NS = (window.__ARC__ = window.__ARC__ || {});

  const STORAGE_KEY = 'arcExtensionUiPrefs';

  /** @typedef {{ type: 'host', value: string }} DisabledSiteRule */
  /** @typedef {{ hoverButtonEnabled: boolean, disabledSiteRules: DisabledSiteRule[] }} ExtensionUiPrefs */

  /** @returns {ExtensionUiPrefs} */
  function defaultPrefs() {
    return {
      hoverButtonEnabled: true,
      disabledSiteRules: []
    };
  }

  /**
   * Normalize host for blocklist: lowercase, strip leading www.
   * @param {string} hostname
   * @returns {string}
   */
  function normalizeHost(hostname) {
    const raw = String(hostname || '')
      .trim()
      .toLowerCase()
      .replace(/:\d+$/, '');
    if (!raw) return '';
    return raw.startsWith('www.') ? raw.slice(4) : raw;
  }

  /**
   * @param {unknown} raw
   * @returns {ExtensionUiPrefs}
   */
  function parsePrefs(raw) {
    const base = defaultPrefs();
    if (!raw || typeof raw !== 'object') return base;
    const obj = /** @type {Record<string, unknown>} */ (raw);
    if (obj.hoverButtonEnabled === false) base.hoverButtonEnabled = false;
    const rules = Array.isArray(obj.disabledSiteRules) ? obj.disabledSiteRules : [];
    /** @type {DisabledSiteRule[]} */
    const next = [];
    const seen = new Set();
    for (const rule of rules) {
      if (!rule || typeof rule !== 'object') continue;
      const value = normalizeHost(/** @type {{ value?: unknown }} */ (rule).value);
      if (!value || seen.has(value)) continue;
      seen.add(value);
      next.push({ type: 'host', value });
    }
    base.disabledSiteRules = next;
    return base;
  }

  /**
   * @param {string} hostname
   * @param {ExtensionUiPrefs} prefs
   * @returns {boolean}
   */
  function isHoverBlocked(hostname, prefs) {
    if (!prefs.hoverButtonEnabled) return true;
    const host = normalizeHost(hostname);
    if (!host) return false;
    return prefs.disabledSiteRules.some((rule) => {
      const v = rule.value;
      return host === v || host.endsWith(`.${v}`);
    });
  }

  /** @returns {Promise<ExtensionUiPrefs>} */
  async function getExtensionUiPrefs() {
    try {
      const data = await chrome.storage.local.get(STORAGE_KEY);
      return parsePrefs(data?.[STORAGE_KEY]);
    } catch {
      return defaultPrefs();
    }
  }

  /**
   * @param {Partial<ExtensionUiPrefs>} patch
   * @returns {Promise<ExtensionUiPrefs>}
   */
  async function setExtensionUiPrefs(patch) {
    const current = await getExtensionUiPrefs();
    const next = parsePrefs({
      ...current,
      ...patch,
      disabledSiteRules: patch.disabledSiteRules ?? current.disabledSiteRules
    });
    await chrome.storage.local.set({ [STORAGE_KEY]: next });
    return next;
  }

  /**
   * @param {string} hostname
   * @returns {Promise<ExtensionUiPrefs>}
   */
  async function addDisabledHost(hostname) {
    const host = normalizeHost(hostname);
    if (!host) return getExtensionUiPrefs();
    const current = await getExtensionUiPrefs();
    if (current.disabledSiteRules.some((r) => r.value === host)) return current;
    return setExtensionUiPrefs({
      disabledSiteRules: [...current.disabledSiteRules, { type: 'host', value: host }]
    });
  }

  /**
   * @param {string} hostname
   * @returns {Promise<ExtensionUiPrefs>}
   */
  async function removeDisabledHost(hostname) {
    const host = normalizeHost(hostname);
    const current = await getExtensionUiPrefs();
    return setExtensionUiPrefs({
      disabledSiteRules: current.disabledSiteRules.filter((r) => r.value !== host)
    });
  }

  NS.EXTENSION_UI_PREFS_KEY = STORAGE_KEY;
  NS.normalizeHost = normalizeHost;
  NS.isHoverBlocked = isHoverBlocked;
  NS.getExtensionUiPrefs = getExtensionUiPrefs;
  NS.setExtensionUiPrefs = setExtensionUiPrefs;
  NS.addDisabledHost = addDisabledHost;
  NS.removeDisabledHost = removeDisabledHost;
  NS.defaultExtensionUiPrefs = defaultPrefs;
  NS.parseExtensionUiPrefs = parsePrefs;
})();
