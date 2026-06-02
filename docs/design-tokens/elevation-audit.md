# Elevation audit: Figma Colors (Dark) vs arc-ui.css

Generated: 2026-06-02T20:08:23.638Z
Source: [figma-colors-dark.json](./figma-colors-dark.json)

| Figma | CSS var | Sunken | Default | Raised | Status |
|-------|---------|--------|---------|--------|--------|
| Background/Background | `--panel-bg` | var(--gray-1000) / var(--gray-950) / var(--gray-900) | var(--gray-1000) / var(--gray-950) / var(--gray-900) | **OK** |
| Border/Default | `--panel-border` | var(--gray-900) / var(--gray-850) / var(--gray-800) | var(--gray-900) / var(--gray-850) / var(--gray-800) | **OK** |
| Typography/Black Bg/Primary/Default | `--text-elev-primary` | var(--gray-300) / var(--gray-250) / var(--gray-200) | var(--gray-300) / var(--gray-250) / var(--gray-200) | **OK** |
| Typography/Black Bg/Secondary/Default | `--text-elev-secondary` | var(--gray-650) / var(--gray-600) / var(--gray-550) | var(--gray-650) / var(--gray-600) / var(--gray-550) | **OK** |
| Background/Tertiary/Default | `--input-fill-default` | var(--gray-1000) / var(--gray-950) / var(--gray-900) | var(--gray-1000) / var(--gray-950) / var(--gray-900) | **OK** |
| Background/Tertiary/Default | `--tab-inactive-fill-default` | var(--gray-1000) / var(--gray-950) / var(--gray-900) | var(--gray-1000) / var(--gray-950) / var(--gray-900) | **OK** |
| Background/Tertiary/Hover | `--input-fill-hover` | var(--gray-950) / var(--gray-900) / var(--gray-850) | var(--gray-950) / var(--gray-900) / var(--gray-850) | **OK** |
| Background/Secondary/Default | `--btn-secondary-fill-default` | var(--gray-900) / var(--gray-850) / var(--gray-800) | var(--gray-900) / var(--gray-850) / var(--gray-800) | **OK** |
| Background/Secondary/Default | `--tab-active-fill-default` | var(--gray-900) / var(--gray-850) / var(--gray-800) | var(--gray-900) / var(--gray-850) / var(--gray-800) | **OK** |
| Background/Secondary/Default | `--tag-fill-default` | var(--gray-900) / var(--gray-850) / var(--gray-800) | var(--gray-900) / var(--gray-850) / var(--gray-800) | **OK** |
| Background/Secondary/Hover | `--btn-secondary-fill-hover` | var(--gray-850) / var(--gray-800) / var(--gray-750) | var(--gray-850) / var(--gray-800) / var(--gray-750) | **OK** |
| Background/Secondary/Hover | `--tag-fill-hover` | var(--gray-850) / var(--gray-800) / var(--gray-750) | var(--gray-850) / var(--gray-800) / var(--gray-750) | **OK** |
| Background/Danger/Default | `--button-danger-default` | var(--red-950) / var(--red-900) / var(--red-850) | var(--red-950) / var(--red-900) / var(--red-850) | **OK** |
| Background/Success/Default | `--button-success-default` | var(--green-950) / var(--green-900) / var(--green-850) | var(--green-950) / var(--green-900) / var(--green-850) | **OK** |
| Background/Warning/Default | `--button-warning-default` | var(--yellow-950) / var(--yellow-900) / var(--yellow-850) | var(--yellow-950) / var(--yellow-900) / var(--yellow-850) | **OK** |
| Background/Brand/Disabled | `--btn-brand-fill-disabled` | var(--brand-950) / var(--brand-900) / var(--brand-850) | var(--brand-950) / var(--brand-900) / var(--brand-850) | **OK** |
| Typography/Danger/Primary/Default | `--font-danger-primary-default` | var(--red-650) / var(--red-600) / var(--red-550) | var(--red-650) / var(--red-600) / var(--red-550) | **OK** |
| Icons/Danger/Default | `--icons-danger-default` | var(--red-750) / var(--red-700) / var(--red-650) | var(--red-750) / var(--red-700) / var(--red-650) | **OK** |
| Icons/Black Bg/Default | `--input-icon-default` | var(--gray-600) / var(--gray-550) / var(--gray-500) | var(--gray-600) / var(--gray-550) / var(--gray-500) | **OK** |
| Icons/Black Bg/Default | `--icons-white-default` | var(--gray-600) / var(--gray-550) / var(--gray-500) | var(--gray-600) / var(--gray-550) / var(--gray-500) | **OK** |
| Border/Danger | `--input-border-error` | var(--red-900) / var(--red-850) / var(--red-800) | var(--red-900) / var(--red-850) / var(--red-800) | **OK** |

Summary: **21** OK, **0** mismatch (subset of mapped tokens).

Полный экспорт: `node scripts/export-figma-colors-elevation.mjs` + use_figma.