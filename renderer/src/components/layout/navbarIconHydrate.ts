/**
 * Подставляет в узлы `arc-icon-*` inline-SVG из `public/ui/icons/`:
 * `stroke`/`fill` с белого переводятся в `currentColor`, чтобы работали токены родителя.
 */
const ICON_DIR = '/ui/icons/';

type IconKey =
  | 'search'
  | 'close'
  | 'plus'
  | 'images'
  | 'image'
  | 'play'
  | 'whiteboard'
  | 'hardDrive'
  | 'pieChart'
  | 'history'
  | 'copy'
  | 'save'
  | 'chevron'
  | 'arrowUp'
  | 'arrowDown'
  | 'arrowUpRight'
  | 'trash'
  | 'bookmark'
  | 'bookmarkPlus'
  | 'bookmarkMinus'
  | 'download'
  | 'folderOpen'
  | 'edit'
  | 'tag'
  | 'server'
  | 'undo'
  | 'cursor'
  | 'pan'
  | 'pencil'
  | 'type'
  | 'eraser'
  | 'lineThin'
  | 'lineThik'
  | 'predictable'
  | 'line'
  | 'circle'
  | 'alignLeft'
  | 'alignCenter'
  | 'alignRight'
  | 'minus'
  | 'minimize'
  | 'menu'
  | 'grid'
  | 'filter'
  | 'maximize'
  | 'sorting'
  | 'aspectRatio'
  | 'fileType'
  | 'description'
  | 'link'
  | 'calendar'
  | 'weight'
  | 'resolution'
  | 'duration'
  | 'filterList';

const ICON_FILES: Record<IconKey, string> = {
  search: 'search_m.svg',
  close: 'close_m.svg',
  plus: 'plus_m.svg',
  images: 'images_m.svg',
  image: 'image_m.svg',
  play: 'play_m.svg',
  whiteboard: 'whiteboard_m.svg',
  hardDrive: 'hard-drive_m.svg',
  pieChart: 'pie-chart_m.svg',
  history: 'history_m.svg',
  copy: 'copy_m.svg',
  save: 'save_m.svg',
  chevron: 'chevron_m.svg',
  arrowUp: 'arrow-up_s.svg',
  arrowDown: 'arrow-down_s.svg',
  arrowUpRight: 'arrow-up-right_m.svg',
  trash: 'trash_m.svg',
  bookmark: 'bookmark_m.svg',
  bookmarkPlus: 'bookmark-plus_m.svg',
  bookmarkMinus: 'bookmark-minus_m.svg',
  download: 'download_m.svg',
  folderOpen: 'folder-open_m.svg',
  edit: 'edit_m.svg',
  tag: 'tag_m.svg',
  server: 'server_m.svg',
  undo: 'undo_m.svg',
  cursor: 'cursor_m.svg',
  pan: 'hand_m.svg',
  pencil: 'pencil_m.svg',
  type: 'type_m.svg',
  eraser: 'eraser_m.svg',
  lineThin: 'line-thin_m.svg',
  lineThik: 'line-thik_m.svg',
  predictable: 'redictable_m.svg',
  line: 'line_m.svg',
  circle: 'circle_m.svg',
  alignLeft: 'align-left_m.svg',
  alignCenter: 'align-center_m.svg',
  alignRight: 'align-right_m.svg',
  minus: 'minus_m.svg',
  minimize: 'minimize_s.svg',
  menu: 'menu_m.svg',
  grid: 'grid_m.svg',
  filter: 'filter_m.svg',
  maximize: 'maximize_s.svg',
  sorting: 'sorting_s.svg',
  aspectRatio: 'aspect-ratio_s.svg',
  fileType: 'file-type_s.svg',
  description: 'description_s.svg',
  link: 'link_s.svg',
  calendar: 'calebdar_s.svg',
  weight: 'weight_s.svg',
  resolution: 'resolution_s.svg',
  duration: 'duration_s.svg',
  filterList: 'filter-list_s.svg'
};
const SIZE_SUFFIX_RE = /_(s|m|l|xl)\.svg$/;
type UiSize = 's' | 'm' | 'l' | 'xl';

const ICON_CLASS_TO_KEY: Record<string, IconKey> = {
  arc_icon_search: 'search',
  arc_icon_close: 'close',
  arc_icon_plus: 'plus',
  arc_icon_images: 'images',
  arc_icon_image: 'image',
  arc_icon_play: 'play',
  arc_icon_whiteboard: 'whiteboard',
  arc_icon_hard_drive: 'hardDrive',
  arc_icon_pie_chart: 'pieChart',
  arc_icon_history: 'history',
  arc_icon_copy: 'copy',
  arc_icon_save: 'save',
  arc_icon_chevron: 'chevron',
  arc_icon_arrow_up: 'arrowUp',
  arc_icon_arrow_down: 'arrowDown',
  arc_icon_arrow_up_right: 'arrowUpRight',
  arc_icon_trash: 'trash',
  arc_icon_bookmark: 'bookmark',
  arc_icon_bookmark_plus: 'bookmarkPlus',
  arc_icon_bookmark_minus: 'bookmarkMinus',
  arc_icon_download: 'download',
  arc_icon_folder_open: 'folderOpen',
  arc_icon_edit: 'edit',
  arc_icon_tag: 'tag',
  arc_icon_server: 'server',
  arc_icon_undo: 'undo',
  arc_icon_cursor: 'cursor',
  arc_icon_pan: 'pan',
  arc_icon_pencil: 'pencil',
  arc_icon_type: 'type',
  arc_icon_eraser: 'eraser',
  arc_icon_line_thin: 'lineThin',
  arc_icon_line_thik: 'lineThik',
  arc_icon_predictable: 'predictable',
  arc_icon_line: 'line',
  arc_icon_circle: 'circle',
  arc_icon_align_left: 'alignLeft',
  arc_icon_align_center: 'alignCenter',
  arc_icon_align_right: 'alignRight',
  arc_icon_minus: 'minus',
  arc_icon_minimize: 'minimize',
  arc_icon_menu: 'menu',
  arc_icon_grid: 'grid',
  arc_icon_layout_grid: 'grid',
  arc_icon_filter: 'filter',
  arc_icon_maximize: 'maximize',
  arc_icon_sorting: 'sorting',
  arc_icon_aspect_ratio: 'aspectRatio',
  arc_icon_file_type: 'fileType',
  arc_icon_description: 'description',
  arc_icon_link: 'link',
  arc_icon_calendar: 'calendar',
  arc_icon_weight: 'weight',
  arc_icon_resolution: 'resolution',
  arc_icon_duration: 'duration',
  arc_icon_filter_list: 'filterList'
};

const ICON_SELECTOR =
  '.arc-icon-search, .arc-icon-plus, .arc-icon-minimize, .arc-icon-maximize, .arc-icon-menu, .arc-icon-grid, .arc-icon-layout-grid, .arc-icon-filter, .arc-icon-sorting, .arc-icon-aspect-ratio, .arc-icon-file-type, .arc-icon-description, .arc-icon-link, .arc-icon-calendar, .arc-icon-weight, .arc-icon-resolution, .arc-icon-duration, .arc-icon-filter-list, .arc-icon-images, .arc-icon-image, .arc-icon-play, .arc-icon-whiteboard, .arc-icon-hard-drive, .arc-icon-pie-chart, .arc-icon-history, .arc-icon-copy, .arc-icon-close, .arc-icon-save, .arc-icon-chevron, .arc-icon-arrow-up, .arc-icon-arrow-down, .arc-icon-arrow-up-right, .arc-icon-trash, .arc-icon-bookmark, .arc-icon-bookmark-plus, .arc-icon-bookmark-minus, .arc-icon-download, .arc-icon-folder-open, .arc-icon-edit, .arc-icon-tag, .arc-icon-server, .arc-icon-undo, .arc-icon-cursor, .arc-icon-pan, .arc-icon-pencil, .arc-icon-type, .arc-icon-eraser, .arc-icon-line-thin, .arc-icon-line-thik, .arc-icon-predictable, .arc-icon-line, .arc-icon-circle, .arc-icon-align-left, .arc-icon-align-center, .arc-icon-align-right, .arc-icon-minus';

const svgMarkupCache = new Map<string, string>();
let preloadPromise: Promise<void> | null = null;

let idUniq = 0;
function uniquifySvgIds(svgText: string): string {
  const sfx = `i${++idUniq}`;
  return svgText
    .replace(/\bid="([^"]+)"/g, (_, id: string) => `id="${id}-${sfx}"`)
    .replace(/url\(#([^)]+)\)/g, (_, ref: string) => `url(#${ref}-${sfx})`);
}

function isLikelySvgMarkup(raw: string): boolean {
  const t = raw.replace(/^\uFEFF/, '').replace(/<\?xml[^?]*\?>/gi, '').trimStart();
  return /^<svg\b/i.test(t);
}

function normalizeSvgForTokens(svgText: string): string {
  return svgText
    .replace(/<\?xml[^?]*\?>/gi, '')
    .replace(/stroke="white"/gi, 'stroke="currentColor"')
    .replace(/stroke='white'/gi, "stroke='currentColor'")
    .replace(/stroke="#ffffff"/gi, 'stroke="currentColor"')
    .replace(/stroke="#FFFFFF"/gi, 'stroke="currentColor"')
    .replace(/stroke="#fff"/gi, 'stroke="currentColor"')
    .replace(/stroke="#FFF"/gi, 'stroke="currentColor"')
    .replace(/fill="white"/gi, 'fill="currentColor"')
    .replace(/fill='white'/gi, "fill='currentColor'")
    .replace(/fill="#ffffff"/gi, 'fill="currentColor"')
    .replace(/fill="#FFFFFF"/gi, 'fill="currentColor"')
    .replace(/fill="#fff"/gi, 'fill="currentColor"')
    .replace(/fill="#FFF"/gi, 'fill="currentColor"');
}

function iconUrl(file: string): string {
  const base = typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL ? import.meta.env.BASE_URL : '/';
  const normalized = base.endsWith('/') ? base.slice(0, -1) : base;
  return `${normalized}${ICON_DIR}${file}`;
}

function getIconSize(scope?: HTMLElement): UiSize {
  const explicit = scope?.closest('[data-arc-icon-size]')?.getAttribute('data-arc-icon-size');
  if (explicit === 's' || explicit === 'm' || explicit === 'l' || explicit === 'xl') return explicit;
  const btnSize =
    scope?.closest('[data-btn-size]')?.getAttribute('data-btn-size') ?? document.body?.getAttribute('data-btn-size');
  if (btnSize === 's' || btnSize === 'm' || btnSize === 'l') return btnSize;
  return 'm';
}

function withSizeVariant(file: string, size: UiSize): string {
  if (!SIZE_SUFFIX_RE.test(file)) return file;
  return file.replace(SIZE_SUFFIX_RE, `_${size}.svg`);
}

function resolveIconFile(iconKey: IconKey, scope?: HTMLElement): { preferred: string; fallback: string } {
  const fallback = ICON_FILES[iconKey];
  const preferred = withSizeVariant(fallback, getIconSize(scope));
  return { preferred, fallback };
}

async function ensureSvgMarkup(file: string): Promise<string | null> {
  const cached = svgMarkupCache.get(file);
  if (cached) {
    if (isLikelySvgMarkup(cached)) return cached;
    svgMarkupCache.delete(file);
  }
  try {
    const res = await fetch(iconUrl(file));
    if (!res.ok) return null;
    const raw = (await res.text()).trim();
    if (!isLikelySvgMarkup(raw)) return null;
    const normalized = normalizeSvgForTokens(raw);
    if (!isLikelySvgMarkup(normalized)) return null;
    svgMarkupCache.set(file, normalized);
    return normalized;
  } catch {
    return null;
  }
}

function preloadAllIcons(): Promise<void> {
  if (preloadPromise) return preloadPromise;
  const files = [...new Set(Object.values(ICON_FILES))];
  preloadPromise = Promise.all(files.map((f) => ensureSvgMarkup(f))).then(() => undefined);
  return preloadPromise;
}

function classToIconKey(element: HTMLElement): IconKey | null {
  for (const className of element.classList) {
    if (!className.startsWith('arc-icon-')) continue;
    const key = className.replace(/-/g, '_');
    const mapped = ICON_CLASS_TO_KEY[key];
    if (mapped) return mapped;
  }
  return null;
}

function injectSvgMarkup(host: HTMLElement, normalizedMarkup: string, file: string): void {
  host.innerHTML = uniquifySvgIds(normalizedMarkup);
  const svg = host.querySelector('svg');
  if (!svg) {
    host.innerHTML = '';
    delete host.dataset.arcIconFile;
    return;
  }
  svg.classList.add('arc-navbar-icon-svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.removeAttribute('width');
  svg.removeAttribute('height');
  host.dataset.arcIconFile = file;
}

/** Асинхронно: дожидается кэша файлов, затем вставляет SVG с currentColor. */
export async function hydrateArcNavbarIcons(scope: ParentNode = document): Promise<void> {
  await preloadAllIcons();

  const nodes = scope.querySelectorAll(ICON_SELECTOR);
  for (const node of nodes) {
    if (!(node instanceof HTMLElement)) continue;
    const iconKey = classToIconKey(node);
    if (!iconKey) continue;
    const { preferred, fallback } = resolveIconFile(iconKey, node);
    if (node.dataset.arcIconFile === preferred && node.querySelector(':scope > svg.arc-navbar-icon-svg')) {
      continue;
    }
    const normalized = (await ensureSvgMarkup(preferred)) ?? (preferred !== fallback ? await ensureSvgMarkup(fallback) : null);
    if (!normalized) continue;
    const usedFile = svgMarkupCache.get(preferred) ? preferred : fallback;
    if (node.dataset.arcIconFile === usedFile && node.querySelector(':scope > svg.arc-navbar-icon-svg')) {
      continue;
    }
    injectSvgMarkup(node, normalized, usedFile);
  }
}
