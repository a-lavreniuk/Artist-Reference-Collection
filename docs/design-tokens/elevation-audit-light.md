# Elevation audit: Figma Colors (Light) vs theme-light.css

Generated: 2026-07-09T12:27:02.098Z
Source: [figma-colors-light.json](./figma-colors-light.json)

| Figma | CSS var | Expected (S/D/R) | Actual (S/D/R) | Status |
|-------|---------|------------------|----------------|--------|
| Background/Background | `--panel-bg` | var(--gray-25) / var(--gray-25) / var(--gray-50) | var(--gray-25) / var(--gray-25) / var(--gray-50) | **OK** |
| Border/Default | `--panel-border` | var(--gray-100) / var(--gray-100) / var(--gray-150) | var(--gray-100) / var(--gray-100) / var(--gray-150) | **OK** |
| Typography/Black Bg/Primary/Default | `--text-elev-primary` | var(--gray-950) / var(--gray-950) / var(--gray-950) | var(--gray-950) / var(--gray-950) / var(--gray-950) | **OK** |
| Typography/Black Bg/Secondary/Default | `--text-elev-secondary` | var(--gray-450) / var(--gray-450) / var(--gray-450) | var(--gray-450) / var(--gray-450) / var(--gray-450) | **OK** |
| Background/Tertiary/Default | `--input-fill-default` | var(--gray-25) / var(--gray-25) / var(--gray-50) | var(--gray-25) / var(--gray-25) / var(--gray-50) | **OK** |
| Background/Tertiary/Default | `--tab-inactive-fill-default` | var(--gray-25) / var(--gray-25) / var(--gray-50) | transparent / transparent / transparent | **MISMATCH** |
| Background/Tertiary/Hover | `--input-fill-hover` | var(--gray-100) / var(--gray-100) / var(--gray-100) | var(--gray-100) / var(--gray-100) / var(--gray-100) | **OK** |
| Background/Secondary/Default | `--btn-secondary-fill-default` | var(--gray-100) / var(--gray-100) / var(--gray-150) | var(--gray-100) / var(--gray-100) / var(--gray-150) | **OK** |
| Background/Secondary/Default | `--tab-active-fill-default` | var(--gray-100) / var(--gray-100) / var(--gray-150) | var(--background-brand-default) / var(--background-brand-default) / var(--background-brand-default) | **MISMATCH** |
| Background/Secondary/Default | `--tag-fill-default` | var(--gray-100) / var(--gray-100) / var(--gray-150) | var(--gray-100) / var(--gray-100) / var(--gray-150) | **OK** |
| Background/Secondary/Hover | `--btn-secondary-fill-hover` | var(--gray-150) / var(--gray-150) / var(--gray-200) | var(--gray-150) / var(--gray-150) / var(--gray-200) | **OK** |
| Background/Secondary/Hover | `--tag-fill-hover` | var(--gray-150) / var(--gray-150) / var(--gray-200) | var(--gray-150) / var(--gray-150) / var(--gray-200) | **OK** |
| Background/Danger/Default | `--button-danger-default` | var(--red-300) / var(--red-300) / var(--red-350) | var(--red-300) / var(--red-300) / var(--red-350) | **OK** |
| Background/Success/Default | `--button-success-default` | var(--green-300) / var(--green-300) / var(--green-350) | var(--green-300) / var(--green-300) / var(--green-350) | **OK** |
| Background/Warning/Default | `--button-warning-default` | var(--yellow-300) / var(--yellow-300) / var(--yellow-350) | var(--yellow-300) / var(--yellow-300) / var(--yellow-350) | **OK** |
| Background/Brand/Disabled | `--btn-brand-fill-disabled` | var(--brand-100) / var(--brand-100) / var(--brand-150) | var(--brand-100) / var(--brand-100) / var(--brand-150) | **OK** |
| Typography/Danger/Primary/Default | `--font-danger-primary-default` | var(--red-700) / var(--red-700) / var(--red-750) | var(--red-700) / var(--red-700) / var(--red-750) | **OK** |
| Icons/Danger/Default | `--icons-danger-default` | var(--red-550) / var(--red-600) / var(--red-650) | var(--red-550) / var(--red-600) / var(--red-650) | **OK** |
| Icons/Black Bg/Default | `--input-icon-default` | var(--gray-500) / var(--gray-500) / var(--gray-550) | var(--gray-500) / var(--gray-500) / var(--gray-550) | **OK** |
| Icons/Black Bg/Default | `--icons-white-default` | var(--gray-500) / var(--gray-500) / var(--gray-550) | var(--gray-400) / var(--gray-500) / var(--gray-600) | **MISMATCH** |
| Border/Danger | `--input-border-error` | var(--red-400) / var(--red-400) / var(--red-450) | var(--red-400) / var(--red-400) / var(--red-450) | **OK** |

Summary: **18** OK, **3** mismatch (subset of mapped tokens).

Полный экспорт: `node scripts/export-figma-colors-elevation.mjs --theme light` + use_figma.
CSS: `node scripts/generate-light-theme-css.mjs`