// @ts-nocheck
/** Generated from renderer/public/ui/arc-ui/arc-ui.html — demo logic scoped to .arc-ui-kit-scope. Regenerate: node scripts/gen-ui-kit-boot.mjs */

import { hydrateArcNavbarIcons } from '../components/layout/navbarIconHydrate';

const arcUiKitGlyphHydrators = new WeakMap<HTMLElement, () => Promise<unknown>>();

/** Повторная подстановка SVG в инпутах после смены `data-input-size` на контейнере стенда. */
export function refreshArcUiKitGlyphs(scope: HTMLElement): Promise<unknown> | undefined {
  const fn = arcUiKitGlyphHydrators.get(scope);
  return fn ? fn() : undefined;
}

export function mountArcUiKitDemo(scope: HTMLElement, options?: { signal?: AbortSignal }): void {
  const parentSignal = options?.signal;
  const mountAc = new AbortController();
  if (parentSignal) {
    if (parentSignal.aborted) {
      mountAc.abort();
      return;
    }
    parentSignal.addEventListener("abort", () => mountAc.abort(), { once: true });
  }
  const priorAc = (scope as HTMLElement & { __arcUiKitMountAc?: AbortController }).__arcUiKitMountAc;
  priorAc?.abort();
  (scope as HTMLElement & { __arcUiKitMountAc?: AbortController }).__arcUiKitMountAc = mountAc;
  const docOpts = { signal: mountAc.signal } as AddEventListenerOptions;

      const body = scope;

      function injectButtonIcons() {
        const closeIconMarkup = '<svg class="btn-icon-svg" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5.5 5.5L18.5 18.5M18.5 5.5L5.5 18.5" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        const closeNodes = scope.querySelectorAll(".btn-ds__icon, .btn-icon-only__glyph, .tab-icon");
        closeNodes.forEach(function (node) {
          if (!node.querySelector("svg")) {
            node.innerHTML = closeIconMarkup;
          }
        });
      }

      /**
       * Встроенные копии icons/*.svg: без этого fetch() к локальным файлам часто пустой
       * (file://, политика браузера), из‑за чего глифы в инпутах не появлялись.
       */
      const INPUT_GLYPH_INLINE = {
        "search_m.svg":
          '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10.8966 10.8816C11.8875 9.8869 12.5 8.51498 12.5 7C12.5 3.96243 10.0376 1.5 7 1.5C3.96243 1.5 1.5 3.96243 1.5 7C1.5 10.0376 3.96243 12.5 7 12.5C8.52258 12.5 9.90066 11.8813 10.8966 10.8816ZM10.8966 10.8816L14.5 14.5" stroke="white" stroke-linecap="round"/></svg>',
        "search_s.svg":
          '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><g clip-path="url(#clip0_412_2174)"><path d="M8.18809 8.17586C8.99884 7.36201 9.5 6.23953 9.5 5C9.5 2.51472 7.48528 0.5 5 0.5C2.51472 0.5 0.5 2.51472 0.5 5C0.5 7.48528 2.51472 9.5 5 9.5C6.24575 9.5 7.37327 8.9938 8.18809 8.17586ZM8.18809 8.17586L11.5 11.5" stroke="white" stroke-linecap="round"/></g><defs><clipPath id="clip0_412_2174"><rect width="12" height="12" fill="white"/></clipPath></defs></svg>',
        "close_m.svg":
          '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3.5 3.5L12.5 12.5M12.5 3.5L3.5 12.5" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        "close_s.svg":
          '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2.5 2.5L9.5 9.5M9.5 2.5L2.5 9.5" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        "chevron_m.svg":
          '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3.5 6L8 10L12.5 6" stroke="white" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        "chevron_s.svg":
          '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2.5 4.5L6 7.5L9.5 4.5" stroke="white" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        "trash_m.svg":
          '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><g clip-path="url(#clip0_412_160)"><path d="M0 2.5H2.5M16 2.5H13.5M2.5 2.5V13.5C2.5 14.6046 3.39543 15.5 4.5 15.5H11.5C12.6046 15.5 13.5 14.6046 13.5 13.5V2.5M2.5 2.5H13.5M3 0.5H13" stroke="white" stroke-linejoin="round"/></g><defs><clipPath id="clip0_412_160"><rect width="16" height="16" fill="white"/></clipPath></defs></svg>',
        "trash_s.svg":
          '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><g clip-path="url(#clip0_412_166)"><path d="M0 2.5L2.5 2.5M12 2.5L9.5 2.5M2.5 2.5L2.5 11.5L9.5 11.5L9.5 2.5M2.5 2.5L9.5 2.5M3 0.5C3.4 0.5 7.16667 0.5 9 0.5" stroke="white" stroke-linejoin="round"/></g><defs><clipPath id="clip0_412_166"><rect width="12" height="12" fill="white"/></clipPath></defs></svg>',
        "check_m.svg":
          '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M13.5 4.5L5.99935 11.5L2.5 8.5" stroke="white" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        "check_s.svg":
          '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9.5 3.5L4.5 8.5L2.5 6.5" stroke="white" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      };

      const svgTextCache = Object.create(null);
      let glyphIdSeq = 0;

      function nextGlyphSuffix() {
        glyphIdSeq += 1;
        return "i" + glyphIdSeq;
      }

      function cssUrlValue(raw) {
        const v = (raw || "").trim();
        if (!v || v === "none") return "";
        const i = v.toLowerCase().indexOf("url(");
        if (i === -1) return "";
        let rest = v.slice(i + 4).trim();
        if (rest.charAt(0) === '"' || rest.charAt(0) === "'") {
          const q = rest.charAt(0);
          const end = rest.indexOf(q, 1);
          if (end === -1) return "";
          return rest.slice(1, end).trim();
        }
        const endParen = rest.indexOf(")");
        return (endParen === -1 ? rest
          : rest.slice(0, endParen)).trim();
      }

      function glyphFileKey(href) {
        const s = (href || "").replace(/^\.\//, "").replace(/\\/g, "/");
        const parts = s.split("/");
        let name = parts[parts.length - 1] || s;
        const q = name.indexOf("?");
        if (q !== -1) name = name.slice(0, q);
        return name;
      }

      function uniquifySvgText(text, sfx) {
        return text
          .replace(/id="([^"]+)"/g, function (_, id) {
            return 'id="' + id + "-" + sfx + '"';
          })
          .replace(/url\(#([^)]+)\)/g, function (_, ref) {
            return "url(#" + ref + "-" + sfx + ")";
          });
      }

      function fetchSvgText(absHref) {
        if (svgTextCache[absHref]) return Promise.resolve(svgTextCache[absHref]);
        return fetch(absHref)
          .then(function (r) {
            if (!r.ok) throw new Error(String(r.status));
            return r.text();
          })
          .then(function (t) {
            svgTextCache[absHref] = t;
            return t;
          });
      }

      function getSvgText(href) {
        const key = glyphFileKey(href);
        const embedded = INPUT_GLYPH_INLINE[key];
        if (embedded) return Promise.resolve(embedded);
        try {
          const abs = new URL(href, document.baseURI).href;
          return fetchSvgText(abs);
        } catch (e) {
          return Promise.reject(e);
        }
      }

      function injectSvgFromComputedVar(el, varName) {
        const rawFromEl = getComputedStyle(el).getPropertyValue(varName).trim();
        const rawFromBody = getComputedStyle(body).getPropertyValue(varName).trim();
        const href = cssUrlValue(rawFromEl || rawFromBody);
        if (!href) return Promise.resolve();
        return getSvgText(href).then(function (text) {
          const cleaned = text.replace(/<\?xml[^?]*\?>/, "").trim();
          const unique = uniquifySvgText(cleaned, nextGlyphSuffix());
          const wrap = document.createElement("div");
          wrap.innerHTML = unique;
          const svg = wrap.querySelector("svg");
          if (!svg) return;
          svg.setAttribute("class", "btn-icon-svg");
          svg.setAttribute("aria-hidden", "true");
          svg.removeAttribute("width");
          svg.removeAttribute("height");
          el.textContent = "";
          el.appendChild(svg);
        });
      }

      function hydrateInputGlyphs() {
        const tasks = [];
        scope.querySelectorAll(".search-icon").forEach(function (el) {
          tasks.push(injectSvgFromComputedVar(el, "--input-icon-search-url"));
        });
        scope.querySelectorAll(".selector-caret").forEach(function (el) {
          tasks.push(injectSvgFromComputedVar(el, "--input-icon-chevron-url"));
        });
        scope.querySelectorAll(".selector-clear").forEach(function (el) {
          tasks.push(injectSvgFromComputedVar(el, "--input-icon-close-url"));
        });
        scope.querySelectorAll(".input-inline-icon--close").forEach(function (el) {
          tasks.push(injectSvgFromComputedVar(el, "--input-icon-close-url"));
        });
        scope.querySelectorAll(".input-inline-icon--trash").forEach(function (el) {
          tasks.push(injectSvgFromComputedVar(el, "--input-icon-trash-url"));
        });
        scope.querySelectorAll(".dropdown-row-check").forEach(function (el) {
          tasks.push(injectSvgFromComputedVar(el, "--input-icon-check-url"));
        });
        return Promise.all(tasks);
      }

      function initArcModals() {
        const hosts = Array.from(scope.querySelectorAll(".arc-modal-host"));
        let activeHost = null;
        let lastTrigger = null;
        const modalCommittedState = new Map();
        const confirmHost = scope.querySelector("#arcModalConfirmHost");
        const confirmStayBtn = scope.querySelector("#arcModalConfirmStay");
        const confirmDiscardBtn = scope.querySelector("#arcModalConfirmDiscard");
        const confirmSaveBtn = scope.querySelector("#arcModalConfirmSave");
        let pendingCloseHost = null;
        let pendingCloseTrigger = null;

        function getFocusable(root) {
          return Array.from(
            root.querySelectorAll(
              'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
            )
          ).filter(function (el) {
            return !el.closest("[hidden]");
          });
        }

        function captureModalState(host) {
          const state = {
            controls: [],
            selectors: [],
            tabs: [],
            uploaders: []
          };

          const controls = Array.from(host.querySelectorAll("input, textarea"));
          controls.forEach(function (control, idx) {
            state.controls.push({
              idx: idx,
              value: control.value || ""
            });
          });

          const selectors = Array.from(host.querySelectorAll("[data-selector]"));
          selectors.forEach(function (field, idx) {
            const valueNode = field.querySelector(".selector-value");
            const rows = Array.from(field.querySelectorAll(".dropdown-row"));
            let checkedIndex = -1;
            rows.forEach(function (row, rowIdx) {
              if (row.classList.contains("is-checked")) checkedIndex = rowIdx;
            });
            state.selectors.push({
              idx: idx,
              value: valueNode ? (valueNode.textContent || "") : "",
              hasValue: field.classList.contains("has-value"),
              checkedIndex: checkedIndex
            });
          });

          const tabLists = Array.from(host.querySelectorAll(".arc-modal .tabs"));
          tabLists.forEach(function (tabList, idx) {
            const buttons = Array.from(tabList.querySelectorAll(".tab-button"));
            let active = 0;
            buttons.forEach(function (button, buttonIdx) {
              if (button.classList.contains("is-active")) active = buttonIdx;
            });
            state.tabs.push({ idx: idx, active: active });
          });

          const uploaders = Array.from(host.querySelectorAll("[data-live-uploader]"));
          uploaders.forEach(function (field, idx) {
            const valueNode = field.querySelector(".uploader-value");
            const fullValue = valueNode && valueNode.dataset ? (valueNode.dataset.fullValue || "") : "";
            state.uploaders.push({
              idx: idx,
              fullValue: fullValue,
              text: valueNode ? (valueNode.textContent || "") : "",
              hasFile: field.classList.contains("has-file")
            });
          });

          return state;
        }

        function applyModalState(host, state) {
          if (!state) return;

          const controls = Array.from(host.querySelectorAll("input, textarea"));
          state.controls.forEach(function (entry) {
            const control = controls[entry.idx];
            if (!control) return;
            control.value = entry.value;
            control.dispatchEvent(new Event("input", { bubbles: true }));
          });

          const selectors = Array.from(host.querySelectorAll("[data-selector]"));
          state.selectors.forEach(function (entry) {
            const field = selectors[entry.idx];
            if (!field) return;
            const valueNode = field.querySelector(".selector-value");
            const rows = Array.from(field.querySelectorAll(".dropdown-row"));
            if (valueNode) valueNode.textContent = entry.value;
            field.classList.toggle("has-value", !!entry.hasValue);
            rows.forEach(function (row, rowIdx) {
              row.classList.toggle("is-checked", rowIdx === entry.checkedIndex);
              row.hidden = false;
            });
            const trigger = field.querySelector("[data-selector-trigger]");
            const dropdown = field.querySelector(".selector-dropdown");
            if (trigger) trigger.setAttribute("aria-expanded", "false");
            if (dropdown) dropdown.hidden = true;
            const search = field.querySelector(".selector-search .search-inner");
            if (search) search.value = "";
          });

          const tabLists = Array.from(host.querySelectorAll(".arc-modal .tabs"));
          state.tabs.forEach(function (entry) {
            const tabList = tabLists[entry.idx];
            if (!tabList) return;
            const buttons = Array.from(tabList.querySelectorAll(".tab-button"));
            buttons.forEach(function (button, buttonIdx) {
              const active = buttonIdx === entry.active;
              button.classList.toggle("is-active", active);
              if (button.hasAttribute("aria-selected")) {
                button.setAttribute("aria-selected", active ? "true" : "false");
              }
            });
          });

          const uploaders = Array.from(host.querySelectorAll("[data-live-uploader]"));
          state.uploaders.forEach(function (entry) {
            const field = uploaders[entry.idx];
            if (!field) return;
            const valueNode = field.querySelector(".uploader-value");
            if (!valueNode) return;
            if (entry.fullValue) valueNode.dataset.fullValue = entry.fullValue;
            else delete valueNode.dataset.fullValue;
            valueNode.textContent = entry.text;
            field.classList.toggle("has-file", !!entry.hasFile);
          });
        }

        function isModalDirty(host) {
          if (!host) return false;
          const committed = modalCommittedState.get(host.id);
          if (!committed) return false;
          try {
            return JSON.stringify(captureModalState(host)) !== JSON.stringify(committed);
          } catch (e) {
            return false;
          }
        }

        function syncDirtyIndicator(host) {
          if (!host) return;
          const dirty = isModalDirty(host);
          host.querySelectorAll("[data-arc-save-dot]").forEach(function (node) {
            node.hidden = !dirty;
          });
        }

        function showUnsavedConfirm(host, trigger) {
          if (!confirmHost) return false;
          pendingCloseHost = host || null;
          pendingCloseTrigger = trigger || null;
          confirmHost.hidden = false;
          confirmHost.setAttribute("aria-hidden", "false");
          if (confirmStayBtn) confirmStayBtn.focus();
          return true;
        }

        function hideUnsavedConfirm() {
          if (!confirmHost) return;
          confirmHost.hidden = true;
          confirmHost.setAttribute("aria-hidden", "true");
          pendingCloseHost = null;
          pendingCloseTrigger = null;
        }

        function openArcModal(hostId, trigger) {
          const host = scope.querySelector("#" + hostId);
          if (!host) return;
          hosts.forEach(function (h) {
            h.hidden = true;
            h.setAttribute("aria-hidden", "true");
          });
          host.hidden = false;
          host.setAttribute("aria-hidden", "false");
          activeHost = host;
          lastTrigger = trigger || null;
          if (!modalCommittedState.has(hostId)) {
            modalCommittedState.set(hostId, captureModalState(host));
          }
          applyModalState(host, modalCommittedState.get(hostId));
          syncDirtyIndicator(host);
          document.dispatchEvent(new CustomEvent("arc-modal:open", { detail: { host: host, trigger: trigger || null } }));
          const dialog = host.querySelector(".arc-modal");
          const focusables = dialog ? getFocusable(dialog) : [];
          if (focusables.length) {
            focusables[0].focus();
          }
          hydrateInputGlyphs().catch(function (err) {
            if (typeof console !== "undefined" && console.warn) {
              console.warn("[arc-ui] hydrateInputGlyphs:", err);
            }
          });
        }

        function closeArcModal(closingHost, triggerOverride) {
          if (!closingHost) return;
          const saved = closingHost.getAttribute("data-arc-modal-saved") === "true";
          closingHost.removeAttribute("data-arc-modal-saved");
          closingHost.hidden = true;
          closingHost.setAttribute("aria-hidden", "true");
          const t = triggerOverride || lastTrigger;
          document.dispatchEvent(new CustomEvent("arc-modal:close", { detail: { host: closingHost, trigger: t || null, saved: saved } }));
          activeHost = null;
          lastTrigger = null;
          if (t && typeof t.focus === "function") {
            t.focus();
          }
        }

        scope.querySelectorAll("[data-arc-modal-open]").forEach(function (btn) {
          btn.addEventListener("click", function () {
            const id = btn.getAttribute("data-arc-modal-open");
            if (id) openArcModal(id, btn);
          }, docOpts);
        });

        scope.querySelectorAll("[data-arc-modal-close]").forEach(function (btn) {
          btn.addEventListener("click", function () {
            const host = btn.closest(".arc-modal-host");
            const isSave = btn.hasAttribute("data-arc-modal-save");
            const isCancel = btn.closest(".arc-modal__footer") && !isSave;
            if (!host) return;
            if (!isSave && !isCancel && isModalDirty(host)) {
              if (showUnsavedConfirm(host, lastTrigger)) return;
            }
            if (host) {
              if (isSave) {
                modalCommittedState.set(host.id, captureModalState(host));
                host.setAttribute("data-arc-modal-saved", "true");
              } else {
                applyModalState(host, modalCommittedState.get(host.id));
                host.setAttribute("data-arc-modal-saved", "false");
              }
              syncDirtyIndicator(host);
            }
            closeArcModal(host, lastTrigger);
          }, docOpts);
        });

        hosts.forEach(function (host) {
          host.addEventListener("input", function () {
            syncDirtyIndicator(host);
          }, docOpts);
          host.addEventListener("change", function () {
            syncDirtyIndicator(host);
          }, docOpts);
          host.addEventListener("click", function () {
            requestAnimationFrame(function () {
              syncDirtyIndicator(host);
            });
          }, docOpts);
        });

        if (confirmStayBtn) {
          confirmStayBtn.addEventListener("click", function () {
            const hostToFocus = pendingCloseHost && pendingCloseHost.querySelector(".arc-modal");
            hideUnsavedConfirm();
            if (hostToFocus) {
              const focusables = getFocusable(hostToFocus);
              if (focusables.length) focusables[0].focus();
            }
          }, docOpts);
        }

        if (confirmDiscardBtn) {
          confirmDiscardBtn.addEventListener("click", function () {
            if (!pendingCloseHost) {
              hideUnsavedConfirm();
              return;
            }
            applyModalState(pendingCloseHost, modalCommittedState.get(pendingCloseHost.id));
            pendingCloseHost.setAttribute("data-arc-modal-saved", "false");
            const host = pendingCloseHost;
            const trigger = pendingCloseTrigger;
            hideUnsavedConfirm();
            closeArcModal(host, trigger);
          }, docOpts);
        }

        if (confirmSaveBtn) {
          confirmSaveBtn.addEventListener("click", function () {
            if (!pendingCloseHost) {
              hideUnsavedConfirm();
              return;
            }
            modalCommittedState.set(pendingCloseHost.id, captureModalState(pendingCloseHost));
            pendingCloseHost.setAttribute("data-arc-modal-saved", "true");
            const host = pendingCloseHost;
            const trigger = pendingCloseTrigger;
            hideUnsavedConfirm();
            closeArcModal(host, trigger);
          }, docOpts);
        }

        document.addEventListener("keydown", function (event) {
          if (event.key !== "Escape") return;
          if (confirmHost && !confirmHost.hidden) {
            event.preventDefault();
            hideUnsavedConfirm();
            return;
          }
          const dialog = activeHost && activeHost.querySelector(".arc-modal");
          if (dialog && dialog.contains(document.activeElement)) {
            event.preventDefault();
            if (isModalDirty(activeHost)) {
              showUnsavedConfirm(activeHost, lastTrigger);
            } else {
              closeArcModal(activeHost, lastTrigger);
            }
            return;
          }
          closeSelectors();
        }, docOpts);

        scope.querySelectorAll(".arc-modal .tabs").forEach(function (tabList) {
          const tabButtons = Array.from(tabList.querySelectorAll(".tab-button"));
          tabButtons.forEach(function (button) {
            button.addEventListener("click", function () {
              tabButtons.forEach(function (b) {
                b.classList.toggle("is-active", b === button);
              });
            }, docOpts);
          });
        });
      }

      function initModalColorPickers() {
        const pickers = Array.from(scope.querySelectorAll("[data-modal-color-picker]"));
        if (!pickers.length) return;

        function hsvToHex(h, s, v) {
          const sat = s / 100;
          const val = v / 100;
          const c = val * sat;
          const hh = h / 60;
          const x = c * (1 - Math.abs((hh % 2) - 1));
          let r = 0;
          let g = 0;
          let b = 0;
          if (hh >= 0 && hh < 1) { r = c; g = x; b = 0; }
          else if (hh < 2) { r = x; g = c; b = 0; }
          else if (hh < 3) { r = 0; g = c; b = x; }
          else if (hh < 4) { r = 0; g = x; b = c; }
          else if (hh < 5) { r = x; g = 0; b = c; }
          else { r = c; g = 0; b = x; }
          const m = val - c;
          const rr = Math.round((r + m) * 255);
          const gg = Math.round((g + m) * 255);
          const bb = Math.round((b + m) * 255);
          return "#" + [rr, gg, bb].map(function (n) {
            return n.toString(16).padStart(2, "0");
          }).join("").toUpperCase();
        }

        function clamp(num, min, max) {
          return Math.min(max, Math.max(min, num));
        }

        function hexToHsv(hex) {
          const raw = (hex || "").trim().replace(/^#/, "");
          if (!/^[0-9a-fA-F]{6}$/.test(raw)) return null;
          const r = parseInt(raw.slice(0, 2), 16) / 255;
          const g = parseInt(raw.slice(2, 4), 16) / 255;
          const b = parseInt(raw.slice(4, 6), 16) / 255;
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const d = max - min;
          let h = 0;
          if (d !== 0) {
            if (max === r) h = ((g - b) / d) % 6;
            else if (max === g) h = (b - r) / d + 2;
            else h = (r - g) / d + 4;
          }
          h = Math.round(h * 60);
          if (h < 0) h += 360;
          const s = max === 0 ? 0 : d / max;
          const v = max;
          return { h: h, s: Math.round(s * 100), v: Math.round(v * 100) };
        }

        const pickerStateMap = new Map();
        pickers.forEach(function (picker) {
          const dialog = picker.closest(".arc-modal");
          if (!dialog) return;
          const hueTrack = dialog.querySelector("[data-color-hue-track]");
          const hueThumb = dialog.querySelector("[data-color-hue-thumb]");
          const toneTrack = dialog.querySelector("[data-color-tone-track]");
          const toneThumb = dialog.querySelector("[data-color-tone-thumb]");
          const valueInput = picker.querySelector("[data-color-value-input]");
          const swatchNode = picker.querySelector("[data-color-swatch]");
          if (!hueTrack || !hueThumb || !toneTrack || !toneThumb || !valueInput || !swatchNode) return;

          let hue = 45;
          let saturation = 95;
          let brightness = 92;
          let latestHex = "#EAB308";

          function render() {
            const hex = hsvToHex(hue, saturation, brightness);
            latestHex = hex;
            valueInput.value = hex;
            swatchNode.style.background = hex;
            toneTrack.style.background =
              "linear-gradient(180deg, rgba(0, 0, 0, 0) 0%, #000000 100%), " +
              "linear-gradient(90deg, #ffffff 0%, hsl(" + Math.round(hue) + " 100% 50%) 100%)";
            const hueInset = 2;
            const hueThumbSize = 12;
            const hueTravel = Math.max(0, hueTrack.clientWidth - hueThumbSize - hueInset * 2);
            hueThumb.style.left = (hueInset + (hue / 360) * hueTravel) + "px";
            toneThumb.style.left = saturation + "%";
            toneThumb.style.top = (100 - brightness) + "%";
          }

          function setFromHex(hex) {
            const parsed = hexToHsv(hex);
            if (!parsed) return;
            hue = parsed.h;
            saturation = parsed.s;
            brightness = parsed.v;
            render();
          }

          function bindDrag(track, onMove) {
            track.addEventListener("pointerdown", function (event) {
              event.preventDefault();
              function move(e) {
                const rect = track.getBoundingClientRect();
                onMove(e, rect);
              }
              function up() {
                document.removeEventListener("pointermove", move);
                document.removeEventListener("pointerup", up);
              }
              move(event);
              document.addEventListener("pointermove", move);
              document.addEventListener("pointerup", up);
            }, docOpts);
          }

          bindDrag(hueTrack, function (event, rect) {
            const x = clamp((event.clientX - rect.left) / rect.width, 0, 1);
            hue = x * 360;
            render();
          });

          bindDrag(toneTrack, function (event, rect) {
            const x = clamp((event.clientX - rect.left) / rect.width, 0, 1);
            const y = clamp((event.clientY - rect.top) / rect.height, 0, 1);
            saturation = Math.round(x * 100);
            brightness = Math.round((1 - y) * 100);
            render();
          });

          valueInput.addEventListener("input", function () {
            const parsed = hexToHsv(valueInput.value);
            if (!parsed) return;
            hue = parsed.h;
            saturation = parsed.s;
            brightness = parsed.v;
            render();
          }, docOpts);

          render();
          pickerStateMap.set(picker, {
            picker: picker,
            dialog: dialog,
            setFromHex: setFromHex,
            getHex: function () { return latestHex; }
          });
        });

        const mainInput = scope.querySelector("[data-main-color-input]");
        const mainSwatch = scope.querySelector("[data-main-color-swatch]");
        const colorModalHost = scope.querySelector("#arcModalHostColor");
        if (!mainInput || !mainSwatch || !colorModalHost) return;

        const colorModalPicker = Array.from(pickerStateMap.values()).find(function (state) {
          return state.picker.getAttribute("data-modal-color-target") === "main";
        });
        if (!colorModalPicker) return;

        function normalizeHex(value) {
          const parsed = hexToHsv(value);
          if (!parsed) return null;
          return hsvToHex(parsed.h, parsed.s, parsed.v);
        }

        function applyMainColor(hex) {
          mainInput.value = hex;
          mainSwatch.style.background = hex;
        }

        let committedHex = normalizeHex(mainInput.value) || "#EAB308";
        let draftHex = committedHex;
        applyMainColor(committedHex);
        colorModalPicker.setFromHex(committedHex);

        mainInput.addEventListener("input", function () {
          const next = normalizeHex(mainInput.value);
          if (!next) return;
          committedHex = next;
          draftHex = next;
          applyMainColor(next);
          colorModalPicker.setFromHex(next);
        }, docOpts);

        colorModalPicker.picker.querySelector("[data-color-value-input]").addEventListener("input", function () {
          draftHex = colorModalPicker.getHex();
        }, docOpts);

        document.addEventListener("arc-modal:open", function (event) {
          const host = event.detail && event.detail.host;
          if (!host || host.id !== "arcModalHostColor") return;
          draftHex = committedHex;
          colorModalPicker.setFromHex(committedHex);
        }, docOpts);

        document.addEventListener("arc-modal:close", function (event) {
          const host = event.detail && event.detail.host;
          if (!host || host.id !== "arcModalHostColor") return;
          if (event.detail && event.detail.saved) {
            draftHex = colorModalPicker.getHex();
            committedHex = draftHex;
            applyMainColor(committedHex);
          } else {
            colorModalPicker.setFromHex(committedHex);
            applyMainColor(committedHex);
          }
        }, docOpts);
      }

      function initDemoAlerts() {
        const host = scope.querySelector("#demoAlertHost");
        const buttons = Array.from(scope.querySelectorAll("[data-demo-alert]"));
        if (!host || !buttons.length) return;

        const alertCopy = {
          success: "Операция успешно завершена",
          info: "Изменения применяются, это может занять несколько секунд",
          brand: "Карточка добавлена в мудборд",
          warning: "Не все данные заполнены, проверьте обязательные поля",
          danger: "Не удалось завершить операцию, попробуйте снова"
        };

        let closeTimer = null;

        function closeAlert() {
          if (closeTimer) {
            clearTimeout(closeTimer);
            closeTimer = null;
          }
          host.innerHTML = "";
        }

        const demoAlertCloseSvg =
          '<svg class="demo-alert__close-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
          '<path d="M5.5 5.5L18.5 18.5M18.5 5.5L5.5 18.5" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>' +
          "</svg>";

        function showAlert(type) {
          const kind = type || "info";
          const message = alertCopy[kind] || alertCopy.info;
          closeAlert();
          const alertNode = document.createElement("div");
          alertNode.className = "alert alert-" + kind;
          alertNode.setAttribute("role", "status");
          alertNode.innerHTML =
            '<p class="demo-alert__message"></p>' +
            '<button type="button" class="demo-alert__close" aria-label="Закрыть уведомление">' +
            demoAlertCloseSvg +
            "</button>";
          const messageNode = alertNode.querySelector(".demo-alert__message");
          const closeNode = alertNode.querySelector(".demo-alert__close");
          if (messageNode) messageNode.textContent = message;
          alertNode.addEventListener("click", function () {
            closeAlert();
          }, docOpts);
          if (closeNode) {
            closeNode.addEventListener("click", function () {
              closeAlert();
            }, docOpts);
          }
          host.appendChild(alertNode);
          closeTimer = window.setTimeout(closeAlert, 3200);
        }

        buttons.forEach(function (button) {
          button.addEventListener("click", function () {
            showAlert(button.getAttribute("data-demo-alert"));
          }, docOpts);
        });
      }

      function setActive(buttons, activeButton) {
        buttons.forEach(function (button) {
          button.classList.toggle("is-active", button === activeButton);
        });
      }

      const elevationTabs = Array.from(scope.querySelectorAll("[data-elevation-tab]"));
      elevationTabs.forEach(function (button) {
        button.addEventListener("click", function () {
          body.setAttribute("data-elevation", button.getAttribute("data-elevation-tab"));
          setActive(elevationTabs, button);
        }, docOpts);
      });

      const sizeTabs = Array.from(scope.querySelectorAll("[data-size-tab]"));
      sizeTabs.forEach(function (button) {
        button.addEventListener("click", function () {
          const size = button.getAttribute("data-size-tab");
          body.setAttribute("data-btn-size", size);
          body.setAttribute("data-input-size", size);
          setActive(sizeTabs, button);
          hydrateInputGlyphs().catch(function (err) {
            if (typeof console !== "undefined" && console.warn) {
              console.warn("[arc-ui] hydrateInputGlyphs:", err);
            }
          });
        }, docOpts);
      });

      const groupButtons = Array.from(scope.querySelectorAll(".btn-group-ds .btn"));
      groupButtons.forEach(function (button) {
        button.addEventListener("mousedown", function (event) {
          event.preventDefault();
        }, docOpts);
      });

      body.addEventListener("click", function (event) {
        const tag = event.target && event.target.closest && event.target.closest("[data-tag-toggle]");
        if (!tag || !body.contains(tag)) return;
        tag.classList.toggle("chip-active");
      }, docOpts);

      const demoTabLists = Array.from(scope.querySelectorAll('.tabs[aria-label="Tabs default"]'));
      demoTabLists.forEach(function (tabList) {
        const tabButtons = Array.from(tabList.querySelectorAll(".tab-button"));
        tabButtons.forEach(function (button) {
          button.addEventListener("click", function () {
            setActive(tabButtons, button);
          }, docOpts);
        });
      });

      const selectorFields = Array.from(scope.querySelectorAll("[data-selector]"));
      function closeSelectors() {
        selectorFields.forEach(function (field) {
          const dropdown = field.querySelector(".selector-dropdown");
          const trigger = field.querySelector("[data-selector-trigger]");
          if (dropdown) dropdown.hidden = true;
          if (trigger) trigger.setAttribute("aria-expanded", "false");
        });
      }

      selectorFields.forEach(function (field) {
        const trigger = field.querySelector("[data-selector-trigger]");
        const dropdown = field.querySelector(".selector-dropdown");
        const valueNode = field.querySelector(".selector-value");
        const clearNode = field.querySelector(".selector-clear");
        const searchInput = field.querySelector(".selector-search .search-inner");
        const searchContainer = field.querySelector(".selector-search");
        const searchClearBtn = field.querySelector(".selector-search .search-clear-btn");
        if (!trigger || !dropdown || !valueNode) return;

        function syncSelectorSearchState() {
          if (!searchContainer || !searchInput) return;
          searchContainer.classList.toggle("has-value", searchInput.value.length > 0);
        }

        function applyRowFilter() {
          const rows = Array.from(field.querySelectorAll(".dropdown-row"));
          const query = searchInput ? searchInput.value.trim().toLowerCase() : "";
          rows.forEach(function (row) {
            const labelNode = row.querySelector("span");
            const label = labelNode ? labelNode.textContent : row.textContent;
            const normalized = (label || "").trim().toLowerCase();
            row.hidden = query.length > 0 && normalized.indexOf(query) === -1;
          });
        }

        trigger.addEventListener("click", function (event) {
          if (clearNode && (event.target === clearNode || clearNode.contains(event.target))) {
            valueNode.textContent = "Выберите значение";
            field.classList.remove("has-value");
            closeSelectors();
            trigger.focus();
            return;
          }
          event.stopPropagation();
          const willOpen = dropdown.hidden;
          closeSelectors();
          dropdown.hidden = !willOpen;
          trigger.setAttribute("aria-expanded", willOpen ? "true" : "false");
        }, docOpts);

        dropdown.addEventListener("click", function (event) {
          event.stopPropagation();
        }, docOpts);

        if (searchInput) {
          searchInput.addEventListener("click", function (event) {
            event.stopPropagation();
          }, docOpts);
          searchInput.addEventListener("input", function () {
            applyRowFilter();
            syncSelectorSearchState();
          }, docOpts);
          searchInput.addEventListener("keydown", function (event) {
            event.stopPropagation();
          }, docOpts);
        }

        if (searchClearBtn && searchInput) {
          searchClearBtn.addEventListener("click", function (event) {
            event.stopPropagation();
            searchInput.value = "";
            syncSelectorSearchState();
            applyRowFilter();
            searchInput.focus();
          }, docOpts);
        }

        const rows = Array.from(field.querySelectorAll(".dropdown-row"));
        rows.forEach(function (row) {
          row.addEventListener("click", function () {
            rows.forEach(function (r) {
              r.classList.remove("is-checked");
            });
            row.classList.add("is-checked");
            valueNode.textContent = row.textContent ? row.textContent.trim() : "";
            field.classList.add("has-value");
            closeSelectors();
            trigger.focus();
          }, docOpts);
        });

        const resetBtn = field.querySelector(".selector-reset");
        if (resetBtn) {
          resetBtn.addEventListener("click", function () {
            rows.forEach(function (row) {
              row.classList.remove("is-checked");
              row.hidden = false;
            });
            valueNode.textContent = "Выберите значение";
            field.classList.remove("has-value");
            if (searchInput) searchInput.value = "";
            syncSelectorSearchState();
            closeSelectors();
            trigger.focus();
          }, docOpts);
        }

        syncSelectorSearchState();
        applyRowFilter();
      });

      document.addEventListener("click", function () {
        closeSelectors();
      }, docOpts);

      const liveInputs = Array.from(scope.querySelectorAll("[data-live-input]"));
      liveInputs.forEach(function (field) {
        const input = field.querySelector("input.input");
        const clearBtn = field.querySelector(".input-clear-btn");
        if (!input || !clearBtn) return;

        function syncInputState() {
          field.classList.toggle("has-value", input.value.length > 0);
        }

        input.addEventListener("input", syncInputState, docOpts);
        clearBtn.addEventListener("click", function () {
          input.value = "";
          syncInputState();
          input.focus();
        }, docOpts);

        syncInputState();
      });

      const liveSearchInputs = Array.from(scope.querySelectorAll("[data-live-search]"));
      liveSearchInputs.forEach(function (field) {
        const input = field.querySelector(".search-inner");
        const clearBtn = field.querySelector(".search-clear-btn");
        if (!input || !clearBtn) return;

        function syncSearchState() {
          field.classList.toggle("has-value", input.value.length > 0);
        }

        input.addEventListener("input", syncSearchState, docOpts);
        clearBtn.addEventListener("click", function () {
          input.value = "";
          syncSearchState();
          input.focus();
        }, docOpts);

        syncSearchState();
      });

      const liveSearchMultiselectFields = Array.from(scope.querySelectorAll("[data-live-search-multi]"));
      liveSearchMultiselectFields.forEach(function (field) {
        const input = field.querySelector(".search-multiselect .search-inner");
        const clearBtn = field.querySelector(".search-multiselect-clear-btn");
        if (!input || !clearBtn) return;

        function syncMultiSearchState() {
          field.classList.toggle("has-value", input.value.length > 0);
        }

        input.addEventListener("input", syncMultiSearchState, docOpts);
        clearBtn.addEventListener("click", function () {
          input.value = "";
          syncMultiSearchState();
          input.focus();
        }, docOpts);

        syncMultiSearchState();
      });

      const liveUploaderFields = Array.from(scope.querySelectorAll("[data-live-uploader]"));
      liveUploaderFields.forEach(function (field) {
        const trigger = field.querySelector(".uploader");
        const valueNode = field.querySelector(".uploader-value");
        const clearNode = field.querySelector(".uploader-clear");
        const fileInput = field.querySelector(".uploader-file-input");
        const emptyValue = field.getAttribute("data-empty-value") || "Файл не выбран";
        if (!trigger || !valueNode || !fileInput) return;

        const initialValue = (valueNode.textContent || "").trim();
        if (initialValue && initialValue !== emptyValue) {
          valueNode.dataset.fullValue = initialValue;
        }

        function renderUploaderValue() {
          const fullValue = valueNode.dataset.fullValue || "";
          if (!fullValue) {
            valueNode.textContent = emptyValue;
            return;
          }
          valueNode.textContent = fullValue;
          if (valueNode.scrollWidth <= valueNode.clientWidth) return;
          const lastDot = fullValue.lastIndexOf(".");
          const hasExt = lastDot > 0 && lastDot < fullValue.length - 1;
          if (hasExt) {
            const base = fullValue.slice(0, lastDot);
            const ext = fullValue.slice(lastDot + 1);
            let head = base;
            while (head.length > 1) {
              valueNode.textContent = head + "..." + ext;
              if (valueNode.scrollWidth <= valueNode.clientWidth) return;
              head = head.slice(0, -1);
            }
            valueNode.textContent = "..." + ext;
            return;
          }
          let head = fullValue;
          while (head.length > 1) {
            head = head.slice(0, -1);
            valueNode.textContent = head + "...";
            if (valueNode.scrollWidth <= valueNode.clientWidth) return;
          }
        }

        function syncUploaderState() {
          const hasFile = Boolean(valueNode.dataset.fullValue);
          field.classList.toggle("has-file", Boolean(hasFile));
          renderUploaderValue();
        }

        trigger.addEventListener("click", function (event) {
          if (trigger.disabled) return;
          if (clearNode && (event.target === clearNode || clearNode.contains(event.target))) {
            fileInput.value = "";
            delete valueNode.dataset.fullValue;
            syncUploaderState();
            return;
          }
          fileInput.click();
        }, docOpts);

        fileInput.addEventListener("change", function () {
          const file = fileInput.files && fileInput.files[0];
          if (file) {
            valueNode.dataset.fullValue = file.name;
          } else {
            delete valueNode.dataset.fullValue;
          }
          syncUploaderState();
        }, docOpts);

        window.addEventListener("resize", function () {
          renderUploaderValue();
        }, docOpts);

        syncUploaderState();
      });

      function initContextMenuDemo() {
        const trigger = scope.querySelector("[data-context-menu-trigger]");
        if (!trigger || !(trigger instanceof HTMLButtonElement)) return;

        let menuEl = null;
        let backdropEl = null;

        function closeMenu() {
          if (menuEl) menuEl.remove();
          if (backdropEl) backdropEl.remove();
          menuEl = null;
          backdropEl = null;
          trigger.setAttribute("aria-expanded", "false");
        }

        document.querySelectorAll("[data-arc-ui-kit-context-menu]").forEach(function (node) {
          node.remove();
        });

        function openMenu() {
          closeMenu();
          const rect = trigger.getBoundingClientRect();
          backdropEl = document.createElement("button");
          backdropEl.type = "button";
          backdropEl.className = "context-menu-backdrop";
          backdropEl.dataset.arcUiKitContextMenu = "backdrop";
          backdropEl.setAttribute("aria-label", "Закрыть меню");
          backdropEl.addEventListener("click", closeMenu, docOpts);

          menuEl = document.createElement("div");
          menuEl.className = "context-menu panel elevation-raised arc-ui-kit-scope";
          menuEl.dataset.arcUiKitContextMenu = "panel";
          menuEl.setAttribute("role", "menu");
          menuEl.setAttribute("aria-label", "Демо меню");
          menuEl.dataset.elevation = "raised";
          menuEl.dataset.typoTone = "white";
          menuEl.dataset.inputSize = "s";
          menuEl.dataset.btnSize = "m";
          menuEl.style.top = rect.bottom + 8 + "px";
          menuEl.style.left = Math.max(8, rect.right - 250) + "px";
          menuEl.style.width = "250px";
          menuEl.innerHTML =
            '<div class="context-menu__list">' +
            '<button type="button" class="context-menu__item" role="menuitem"><span class="context-menu__item-inner"><span class="context-menu__item-label">Действие</span></span></button>' +
            '<button type="button" class="context-menu__item" role="menuitem"><span class="context-menu__item-inner"><span class="context-menu__item-label">Ещё пункт</span><span class="context-menu__item-shortcut">Ctrl+K</span></span></button>' +
            "</div>";

          menuEl.querySelectorAll(".context-menu__item").forEach(function (item) {
            item.addEventListener("click", closeMenu, docOpts);
          });

          document.body.appendChild(backdropEl);
          document.body.appendChild(menuEl);
          trigger.setAttribute("aria-expanded", "true");
        }

        trigger.addEventListener("click", function () {
          if (menuEl) closeMenu();
          else openMenu();
        }, docOpts);

        window.addEventListener("keydown", function (e) {
          if (e.key === "Escape") closeMenu();
        }, docOpts);

        mountAc.signal.addEventListener("abort", closeMenu, { once: true });
      }

      arcUiKitGlyphHydrators.set(scope, hydrateInputGlyphs);

      initArcModals();
      initContextMenuDemo();
      initModalColorPickers();
      initDemoAlerts();

      injectButtonIcons();
      const staticMenu = scope.querySelector(".context-menu--static");
      if (staticMenu) void hydrateArcNavbarIcons(staticMenu);
      hydrateInputGlyphs().catch(function (err) {
        if (typeof console !== "undefined" && console.warn) {
          console.warn("[arc-ui] hydrateInputGlyphs:", err);
        }
      });
}
