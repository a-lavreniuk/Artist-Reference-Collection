# Elevation audit: Figma Colors (Dark) vs arc-ui.css

Generated: 2026-07-09T10:35:58.926Z
Source: [figma-colors-dark.json](./figma-colors-dark.json)

| Figma | CSS var | Expected (S/D/R) | Actual (S/D/R) | Status |
|-------|---------|------------------|----------------|--------|
| Background/Background | `--panel-bg` | var(--gray-1000) / var(--gray-950) / var(--gray-900) | var(--gray-1000) / var(--gray-950) / var(--gray-900) | **OK** |
| Border/Default | `--panel-border` | var(--gray-900) / var(--gray-850) / var(--gray-800) | var(--gray-900) / var(--gray-850) / var(--gray-800) | **OK** |
| Typography/Black Bg/Primary/Default | `--text-elev-primary` | var(--gray-300) / var(--gray-250) / var(--gray-200) | var(--gray-300) / var(--gray-250) / var(--gray-200) | **OK** |
| Typography/Black Bg/Secondary/Default | `--text-elev-secondary` | var(--gray-650) / var(--gray-600) / var(--gray-550) | var(--gray-650) / var(--gray-600) / var(--gray-550) | **OK** |
| Background/Tertiary/Default | `--input-fill-default` | var(--gray-1000) / var(--gray-950) / var(--gray-900) | var(--gray-1000) / var(--gray-950) / var(--gray-900) | **OK** |
| Background/Tertiary/Default | `--tab-inactive-fill-default` | var(--gray-1000) / var(--gray-950) / var(--gray-900) | transparent / transparent / transparent | **MISMATCH** |
| Background/Tertiary/Hover | `--input-fill-hover` | var(--gray-950) / var(--gray-900) / var(--gray-850) | var(--gray-950) / var(--gray-900) / var(--gray-850) | **OK** |
| Background/Secondary/Default | `--btn-secondary-fill-default` | var(--gray-900) / var(--gray-850) / var(--gray-800) | var(--gray-900) / var(--gray-850) / var(--gray-800) | **OK** |
| Background/Secondary/Default | `--tab-active-fill-default` | var(--gray-900) / var(--gray-850) / var(--gray-800) | var(--background-brand-default) / var(--background-brand-default) / var(--background-brand-default) | **MISMATCH** |
| Background/Secondary/Default | `--tag-fill-default` | var(--gray-900) / var(--gray-850) / var(--gray-800) | var(--gray-900) / var(--gray-850) / var(--gray-800) | **OK** |
| Background/Secondary/Hover | `--btn-secondary-fill-hover` | var(--gray-850) / var(--gray-800) / var(--gray-750) | var(--gray-850) / var(--gray-800) / var(--gray-750) | **OK** |
| Background/Secondary/Hover | `--tag-fill-hover` | var(--gray-850) / var(--gray-800) / var(--gray-750) | var(--gray-850) / var(--gray-800) / var(--gray-750) | **OK** |
| Background/Danger/Default | `--button-danger-default` | var(--red-900) / var(--red-850) / var(--red-800) | var(--red-900) / var(--red-850) / var(--red-800) | **OK** |
| Background/Success/Default | `--button-success-default` | var(--green-900) / var(--green-850) / var(--green-800) | var(--green-900) / var(--green-850) / var(--green-800) | **OK** |
| Background/Warning/Default | `--button-warning-default` | var(--yellow-900) / var(--yellow-850) / var(--yellow-800) | var(--yellow-900) / var(--yellow-850) / var(--yellow-800) | **OK** |
| Background/Brand/Disabled | `--btn-brand-fill-disabled` | var(--brand-950) / var(--brand-900) / var(--brand-850) | var(--brand-950) / var(--brand-900) / var(--brand-850) | **OK** |
| Typography/Danger/Primary/Default | `--font-danger-primary-default` | var(--red-550) / var(--red-500) / var(--red-450) | var(--red-550) / var(--red-500) / var(--red-450) | **OK** |
| Icons/Danger/Default | `--icons-danger-default` | var(--red-750) / var(--red-700) / var(--red-650) | var(--red-750) / var(--red-700) / var(--red-650) | **OK** |
| Icons/Black Bg/Default | `--input-icon-default` | var(--gray-600) / var(--gray-550) / var(--gray-500) | var(--gray-600) / var(--gray-550) / var(--gray-500) | **OK** |
| Icons/Black Bg/Default | `--icons-white-default` | var(--gray-600) / var(--gray-550) / var(--gray-500) | var(--gray-500) / var(--gray-500) / var(--gray-500) | **MISMATCH** |
| Border/Danger | `--input-border-error` | var(--red-850) / var(--red-800) / var(--red-750) | var(--red-850) / var(--red-800) / var(--red-750) | **OK** |

Summary: **18** OK, **3** mismatch (subset of mapped tokens).

Намеренные расхождения (продуктовые решения, не баги):
- `--tab-inactive-fill-default`: `transparent` вместо Tertiary (табы без фона в покое).
- `--tab-active-fill-default`: Brand вместо Secondary (активный таб — brand-фон).
- `--icons-white-default` в audit: маппинг на Black Bg в скрипте audit; фактически берётся из `Icons/White Bg` (gray-500).

Полный экспорт: `node scripts/export-figma-colors-elevation.mjs --theme dark` + use_figma.
Повторная синхронизация: `node scripts/sync-dark-palette.mjs`.