/**
 * Подставляет в узлы `arc-icon-*` inline-SVG из `public/ui/icons/{name}/{name}_{size}.svg`:
 * `stroke`/`fill` с белого переводятся в `currentColor`, чтобы работали токены родителя.
 */
const ICON_DIR = '/ui/icons/';

type IconKey =
  | 'search'
  | 'close'
  | 'closeChrome'
  | 'closeSquare'
  | 'plus'
  | 'images'
  | 'image'
  | 'play'
  | 'whiteboard'
  | 'hardDrive'
  | 'pieChart'
  | 'history'
  | 'copy'
  | 'copySettings'
  | 'pasteSettings'
  | 'save'
  | 'chevron'
  | 'chevronBottom'
  | 'chevronPeak'
  | 'arrowUp'
  | 'arrowDown'
  | 'arrowUpRight'
  | 'arrowLeftRight'
  | 'trash'
  | 'broom'
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
  | 'aspectRatioHorizontal'
  | 'aspectRatioVertical'
  | 'aspectRatioSquare'
  | 'aspectRatioPanoramic'
  | 'fileType'
  | 'description'
  | 'link'
  | 'calendar'
  | 'weight'
  | 'resolution'
  | 'arrowsHorizontal'
  | 'arrowsVertical'
  | 'duration'
  | 'filterList'
  | 'layoutList'
  | 'eye'
  | 'eyeOff'
  | 'chevronsUpDown'
  | 'check'
  | 'gridL'
  | 'gridM'
  | 'gridS'
  | 'settings'
  | 'screenshot'
  | 'notifications'
  | 'shortcut'
  | 'library'
  | 'copyS'
  | 'serverS'
  | 'integrityCheck'
  | 'autoimport'
  | 'browser'
  | 'ai'
  | 'update'
  | 'send'
  | 'reuse'
  | 'redo'
  | 'bug'
  | 'bugS'
  | 'eyedropper'
  | 'pause'
  | 'skipBack'
  | 'skipForward'
  | 'volume'
  | 'volumeX'
  | 'fastForward'
  | 'aspectRatioOther'
  | 'info'
  | 'externalLink'
  | 'maximize2'
  | 'minimize2'
  | 'pin'
  | 'pinOff'
  | 'flipHorizontal'
  | 'flipVertical'
  | 'highlighter'
  | 'moon'
  | 'sunMedium'
  | 'contrast'
  /** Запасные ключи нового пака (регистрация «про запас»). */
  | 'alert'
  | 'eyeOn'
  | 'sun'
  | 'sortAsc'
  | 'sortDesc'
  | 'deviceUpdate'
  | 'clock'
  | 'chart'
  | 'folder'
  | 'folderImport'
  | 'keyboard'
  | 'lock'
  | 'lockOff'
  | 'options'
  | 'refresh'
  | 'filterOff'
  | 'layoutTemplate'
  | 'layoutWaterfall'
  | 'layoutGrid'
  | 'gridMedium'
  | 'gridSmall'
  | 'checkHexagon'
  | 'file'
  | 'size'
  | 'message'
  | 'scan'
  | 'square'
  | 'bookmarkOn'
  | 'bookmarkOff'
  | 'chevronDown'
  | 'chevronUp'
  | 'chevronLeft'
  | 'chevronRight'
  | 'volumeOff'
  | 'hexagon'
  | 'scale'
  | 'triangle'
  | 'adjustPosition'
  | 'pictureInPicture'
  | 'repeat'
  | 'shrink'
  | 'folderPlus'
  | 'skip'
  | 'forward'
  | 'backward'
  | 'card'
  | 'collection';

const ICON_FILES: Record<IconKey, string> = {
  search: 'search_m.svg',
  close: 'close_m.svg',
  /** Старый stroke-крест только для top bar (не пакет). */
  closeChrome: 'close-chrome_s.svg',
  closeSquare: 'close-square_m.svg',
  plus: 'plus_m.svg',
  images: 'images_m.svg',
  image: 'image_m.svg',
  play: 'play_m.svg',
  whiteboard: 'whiteboard_m.svg',
  hardDrive: 'folder_m.svg',
  pieChart: 'chart_m.svg',
  history: 'clock_m.svg',
  copy: 'copy_m.svg',
  copySettings: 'copy-settings_m.svg',
  pasteSettings: 'paste-settings_m.svg',
  save: 'save_m.svg',
  chevron: 'chevron_s.svg',
  chevronBottom: 'chevron-down_m.svg',
  chevronPeak: 'chevron-up_m.svg',
  arrowUp: 'arrow-up_s.svg',
  arrowDown: 'arrow-down_s.svg',
  arrowUpRight: 'arrow-up-right_m.svg',
  arrowLeftRight: 'arrow-left-right_m.svg',
  trash: 'trash_m.svg',
  broom: 'broom_m.svg',
  bookmark: 'bookmark_m.svg',
  bookmarkPlus: 'bookmark-on_m.svg',
  bookmarkMinus: 'bookmark-off_m.svg',
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
  grid: 'layout-grid_m.svg',
  filter: 'filter_m.svg',
  maximize: 'maximize_m.svg',
  sorting: 'sort-desc_m.svg',
  aspectRatio: 'aspect-ratio_m.svg',
  aspectRatioHorizontal: 'aspect-ratio-horizontal_m.svg',
  aspectRatioVertical: 'aspect-ratio-vertical_m.svg',
  aspectRatioSquare: 'square_m.svg',
  aspectRatioPanoramic: 'aspect-ratio-panoramic_m.svg',
  fileType: 'file_m.svg',
  description: 'message_m.svg',
  link: 'link_m.svg',
  calendar: 'calendar_m.svg',
  weight: 'size_m.svg',
  resolution: 'resolution_m.svg',
  arrowsHorizontal: 'arrows-horizontal_s.svg',
  arrowsVertical: 'arrows-vertical_s.svg',
  duration: 'clock_m.svg',
  filterList: 'filter_m.svg',
  layoutList: 'layout-list_m.svg',
  eye: 'eye-on_m.svg',
  eyeOff: 'eye-off_m.svg',
  chevronsUpDown: 'chevrons-up-down_m.svg',
  check: 'check_m.svg',
  gridL: 'layout-grid_m.svg',
  gridM: 'grid-medium_m.svg',
  gridS: 'grid-small_m.svg',
  settings: 'settings_m.svg',
  screenshot: 'crop_m.svg',
  notifications: 'alert_m.svg',
  shortcut: 'shortcut_s.svg',
  library: 'libray_s.svg',
  copyS: 'copy_m.svg',
  serverS: 'server_m.svg',
  integrityCheck: 'check-hexagon_m.svg',
  autoimport: 'folder-import_m.svg',
  browser: 'browser_m.svg',
  ai: 'ai_m.svg',
  update: 'device-update_m.svg',
  send: 'send_m.svg',
  reuse: 'repeat_m.svg',
  redo: 'redo_m.svg',
  bug: 'bug_l.svg',
  bugS: 'bug_s.svg',
  eyedropper: 'eyedropper_m.svg',
  pause: 'pause_m.svg',
  skipBack: 'skip-back_m.svg',
  skipForward: 'skip_m.svg',
  volume: 'volume_m.svg',
  volumeX: 'volume-off_m.svg',
  fastForward: 'forward_m.svg',
  aspectRatioOther: 'aspect-ratio-other_m.svg',
  info: 'info_m.svg',
  externalLink: 'external-link_m.svg',
  maximize2: 'maximize-2_m.svg',
  minimize2: 'minimize-2_m.svg',
  pin: 'pin_m.svg',
  pinOff: 'pin-off_m.svg',
  flipHorizontal: 'flip-horizontal_m.svg',
  flipVertical: 'flip-vertical_m.svg',
  highlighter: 'highlighter_m.svg',
  moon: 'moon_m.svg',
  sunMedium: 'sun_m.svg',
  contrast: 'contrast_m.svg',
  alert: 'alert_m.svg',
  eyeOn: 'eye-on_m.svg',
  sun: 'sun_m.svg',
  sortAsc: 'sort-asc_m.svg',
  sortDesc: 'sort-desc_m.svg',
  deviceUpdate: 'device-update_m.svg',
  clock: 'clock_m.svg',
  chart: 'chart_m.svg',
  folder: 'folder_m.svg',
  folderImport: 'folder-import_m.svg',
  keyboard: 'keyboard_m.svg',
  lock: 'lock_m.svg',
  lockOff: 'lock-off_m.svg',
  options: 'options_m.svg',
  refresh: 'repeat_m.svg',
  filterOff: 'filter-off_m.svg',
  layoutTemplate: 'layout-template_m.svg',
  layoutWaterfall: 'layout-waterfall_m.svg',
  layoutGrid: 'layout-grid_m.svg',
  gridMedium: 'grid-medium_m.svg',
  gridSmall: 'grid-small_m.svg',
  checkHexagon: 'check-hexagon_m.svg',
  file: 'file_m.svg',
  size: 'size_m.svg',
  message: 'message_m.svg',
  scan: 'scan_m.svg',
  square: 'square_m.svg',
  bookmarkOn: 'bookmark-on_m.svg',
  bookmarkOff: 'bookmark-off_m.svg',
  chevronDown: 'chevron-down_m.svg',
  chevronUp: 'chevron-up_m.svg',
  chevronLeft: 'chevron-left_m.svg',
  chevronRight: 'chevron-right_m.svg',
  volumeOff: 'volume-off_m.svg',
  hexagon: 'hexagon_m.svg',
  scale: 'scale_m.svg',
  triangle: 'triangle_m.svg',
  adjustPosition: 'adjust-position_m.svg',
  pictureInPicture: 'picture-in-picture_m.svg',
  repeat: 'repeat_m.svg',
  shrink: 'shrink_m.svg',
  folderPlus: 'folder-plus_m.svg',
  skip: 'skip_m.svg',
  forward: 'forward_m.svg',
  backward: 'backward_m.svg',
  card: 'card_m.svg',
  collection: 'collection_m.svg'
};
const SIZE_SUFFIX_RE = /_(s|m|l|xl)\.svg$/;
type UiSize = 's' | 'm' | 'l' | 'xl';

const ICON_CLASS_TO_KEY: Record<string, IconKey> = {
  arc_icon_search: 'search',
  arc_icon_close: 'close',
  arc_icon_close_chrome: 'closeChrome',
  arc_icon_close_square: 'closeSquare',
  arc_icon_plus: 'plus',
  arc_icon_images: 'images',
  arc_icon_image: 'image',
  arc_icon_play: 'play',
  arc_icon_whiteboard: 'whiteboard',
  arc_icon_hard_drive: 'hardDrive',
  arc_icon_pie_chart: 'pieChart',
  arc_icon_history: 'history',
  arc_icon_copy: 'copy',
  arc_icon_copy_settings: 'copySettings',
  arc_icon_paste_settings: 'pasteSettings',
  arc_icon_save: 'save',
  arc_icon_chevron: 'chevron',
  arc_icon_chevron_bottom: 'chevronBottom',
  arc_icon_chevron_peak: 'chevronPeak',
  arc_icon_arrow_up: 'arrowUp',
  arc_icon_arrow_down: 'arrowDown',
  arc_icon_arrow_up_right: 'arrowUpRight',
  arc_icon_arrow_left_right: 'arrowLeftRight',
  arc_icon_trash: 'trash',
  arc_icon_broom: 'broom',
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
  arc_icon_layout_grid: 'layoutGrid',
  arc_icon_filter: 'filter',
  arc_icon_maximize: 'maximize',
  arc_icon_sorting: 'sorting',
  arc_icon_aspect_ratio: 'aspectRatio',
  arc_icon_aspect_ratio_horizontal: 'aspectRatioHorizontal',
  arc_icon_aspect_ratio_vertical: 'aspectRatioVertical',
  arc_icon_aspect_ratio_square: 'aspectRatioSquare',
  arc_icon_aspect_ratio_panoramic: 'aspectRatioPanoramic',
  arc_icon_file_type: 'fileType',
  arc_icon_description: 'description',
  arc_icon_link: 'link',
  arc_icon_calendar: 'calendar',
  arc_icon_weight: 'weight',
  arc_icon_resolution: 'resolution',
  arc_icon_arrows_horizontal: 'arrowsHorizontal',
  arc_icon_arrows_vertical: 'arrowsVertical',
  arc_icon_duration: 'duration',
  arc_icon_filter_list: 'filterList',
  arc_icon_layout_list: 'layoutList',
  arc_icon_eye: 'eye',
  arc_icon_eye_off: 'eyeOff',
  arc_icon_chevrons_up_down: 'chevronsUpDown',
  arc_icon_check: 'check',
  arc_icon_grid_l: 'gridL',
  arc_icon_grid_m: 'gridM',
  arc_icon_grid_s: 'gridS',
  arc_icon_settings: 'settings',
  arc_icon_screenshot: 'screenshot',
  arc_icon_notifications: 'notifications',
  arc_icon_shortcut: 'shortcut',
  arc_icon_library: 'library',
  arc_icon_copy_s: 'copyS',
  arc_icon_server_s: 'serverS',
  arc_icon_integrity_check: 'integrityCheck',
  arc_icon_autoimport: 'autoimport',
  arc_icon_browser: 'browser',
  arc_icon_ai: 'ai',
  arc_icon_update: 'update',
  arc_icon_send: 'send',
  arc_icon_reuse: 'reuse',
  arc_icon_redo: 'redo',
  arc_icon_bug: 'bug',
  arc_icon_bug_s: 'bugS',
  arc_icon_eyedropper: 'eyedropper',
  arc_icon_pause: 'pause',
  arc_icon_skip_back: 'skipBack',
  arc_icon_skip_forward: 'skipForward',
  arc_icon_volume: 'volume',
  arc_icon_volume_x: 'volumeX',
  arc_icon_fast_forward: 'fastForward',
  arc_icon_aspect_ratio_other: 'aspectRatioOther',
  arc_icon_info: 'info',
  arc_icon_external_link: 'externalLink',
  arc_icon_maximize_2: 'maximize2',
  arc_icon_minimize_2: 'minimize2',
  arc_icon_pin: 'pin',
  arc_icon_pin_off: 'pinOff',
  arc_icon_flip_horizontal: 'flipHorizontal',
  arc_icon_flip_vertical: 'flipVertical',
  arc_icon_highlighter: 'highlighter',
  arc_icon_moon: 'moon',
  arc_icon_sun_medium: 'sunMedium',
  arc_icon_contrast: 'contrast',
  arc_icon_alert: 'alert',
  arc_icon_eye_on: 'eyeOn',
  arc_icon_sun: 'sun',
  arc_icon_sort_asc: 'sortAsc',
  arc_icon_sort_desc: 'sortDesc',
  arc_icon_device_update: 'deviceUpdate',
  arc_icon_clock: 'clock',
  arc_icon_chart: 'chart',
  arc_icon_folder: 'folder',
  arc_icon_folder_import: 'folderImport',
  arc_icon_keyboard: 'keyboard',
  arc_icon_lock: 'lock',
  arc_icon_lock_off: 'lockOff',
  arc_icon_options: 'options',
  arc_icon_refresh: 'refresh',
  arc_icon_filter_off: 'filterOff',
  arc_icon_layout_template: 'layoutTemplate',
  arc_icon_layout_waterfall: 'layoutWaterfall',
  arc_icon_grid_medium: 'gridMedium',
  arc_icon_grid_small: 'gridSmall',
  arc_icon_check_hexagon: 'checkHexagon',
  arc_icon_file: 'file',
  arc_icon_size: 'size',
  arc_icon_message: 'message',
  arc_icon_scan: 'scan',
  arc_icon_square: 'square',
  arc_icon_bookmark_on: 'bookmarkOn',
  arc_icon_bookmark_off: 'bookmarkOff',
  arc_icon_chevron_down: 'chevronDown',
  arc_icon_chevron_up: 'chevronUp',
  arc_icon_chevron_left: 'chevronLeft',
  arc_icon_chevron_right: 'chevronRight',
  arc_icon_volume_off: 'volumeOff',
  arc_icon_hexagon: 'hexagon',
  arc_icon_scale: 'scale',
  arc_icon_triangle: 'triangle',
  arc_icon_adjust_position: 'adjustPosition',
  arc_icon_picture_in_picture: 'pictureInPicture',
  arc_icon_repeat: 'repeat',
  arc_icon_shrink: 'shrink',
  arc_icon_folder_plus: 'folderPlus',
  arc_icon_skip: 'skip',
  arc_icon_forward: 'forward',
  arc_icon_backward: 'backward',
  arc_icon_card: 'card',
  arc_icon_collection: 'collection'
};

const ICON_SELECTOR =
  '.arc-icon-search, .arc-icon-plus, .arc-icon-minimize, .arc-icon-maximize, .arc-icon-maximize-2, .arc-icon-minimize-2, .arc-icon-external-link, .arc-icon-picture-in-picture, .arc-icon-pin, .arc-icon-pin-off, .arc-icon-flip-horizontal, .arc-icon-flip-vertical, .arc-icon-highlighter, .arc-icon-moon, .arc-icon-sun-medium, .arc-icon-sun, .arc-icon-contrast, .arc-icon-menu, .arc-icon-grid, .arc-icon-grid-l, .arc-icon-grid-m, .arc-icon-grid-s, .arc-icon-grid-medium, .arc-icon-grid-small, .arc-icon-check, .arc-icon-check-hexagon, .arc-icon-layout-grid, .arc-icon-layout-list, .arc-icon-layout-template, .arc-icon-layout-waterfall, .arc-icon-filter, .arc-icon-filter-off, .arc-icon-sorting, .arc-icon-sort-asc, .arc-icon-sort-desc, .arc-icon-aspect-ratio, .arc-icon-aspect-ratio-horizontal, .arc-icon-aspect-ratio-vertical, .arc-icon-aspect-ratio-square, .arc-icon-aspect-ratio-panoramic, .arc-icon-aspect-ratio-other, .arc-icon-file-type, .arc-icon-file, .arc-icon-eyedropper, .arc-icon-description, .arc-icon-message, .arc-icon-link, .arc-icon-calendar, .arc-icon-clock, .arc-icon-weight, .arc-icon-size, .arc-icon-resolution, .arc-icon-arrows-horizontal, .arc-icon-arrows-vertical, .arc-icon-arrow-left-right, .arc-icon-duration, .arc-icon-filter-list, .arc-icon-eye, .arc-icon-eye-on, .arc-icon-eye-off, .arc-icon-chevrons-up-down, .arc-icon-images, .arc-icon-image, .arc-icon-play, .arc-icon-pause, .arc-icon-skip-back, .arc-icon-skip-forward, .arc-icon-volume, .arc-icon-volume-x, .arc-icon-volume-off, .arc-icon-fast-forward, .arc-icon-info, .arc-icon-whiteboard, .arc-icon-hard-drive, .arc-icon-folder, .arc-icon-folder-import, .arc-icon-pie-chart, .arc-icon-chart, .arc-icon-history, .arc-icon-copy, .arc-icon-copy-s, .arc-icon-copy-settings, .arc-icon-paste-settings, .arc-icon-close, .arc-icon-close-chrome, .arc-icon-close-square, .arc-icon-save, .arc-icon-chevron, .arc-icon-chevron-bottom, .arc-icon-chevron-peak, .arc-icon-chevron-down, .arc-icon-chevron-up, .arc-icon-chevron-left, .arc-icon-chevron-right, .arc-icon-arrow-up, .arc-icon-arrow-down, .arc-icon-arrow-up-right, .arc-icon-send, .arc-icon-reuse, .arc-icon-refresh, .arc-icon-redo, .arc-icon-bug, .arc-icon-bug-s, .arc-icon-trash, .arc-icon-broom, .arc-icon-bookmark, .arc-icon-bookmark-plus, .arc-icon-bookmark-minus, .arc-icon-bookmark-on, .arc-icon-bookmark-off, .arc-icon-download, .arc-icon-folder-open, .arc-icon-edit, .arc-icon-tag, .arc-icon-server, .arc-icon-server-s, .arc-icon-undo, .arc-icon-cursor, .arc-icon-pan, .arc-icon-pencil, .arc-icon-type, .arc-icon-eraser, .arc-icon-line-thin, .arc-icon-line-thik, .arc-icon-predictable, .arc-icon-line, .arc-icon-circle, .arc-icon-align-left, .arc-icon-align-center, .arc-icon-align-right, .arc-icon-minus, .arc-icon-settings, .arc-icon-options, .arc-icon-screenshot, .arc-icon-scan, .arc-icon-notifications, .arc-icon-alert, .arc-icon-shortcut, .arc-icon-library, .arc-icon-integrity-check, .arc-icon-autoimport, .arc-icon-browser, .arc-icon-ai, .arc-icon-update, .arc-icon-device-update, .arc-icon-keyboard, .arc-icon-lock, .arc-icon-lock-off, .arc-icon-hexagon, .arc-icon-scale, .arc-icon-triangle, .arc-icon-adjust-position, .arc-icon-square, .arc-icon-repeat, .arc-icon-shrink, .arc-icon-folder-plus, .arc-icon-skip, .arc-icon-forward, .arc-icon-backward, .arc-icon-card, .arc-icon-collection';

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
  let out = svgText
    .replace(/<\?xml[^?]*\?>/gi, '')
    .replace(/stroke="white"/gi, 'stroke="currentColor"')
    .replace(/stroke='white'/gi, "stroke='currentColor'")
    .replace(/stroke="#ffffff"/gi, 'stroke="currentColor"')
    .replace(/stroke="#FFFFFF"/gi, 'stroke="currentColor"')
    .replace(/stroke="#fff"/gi, 'stroke="currentColor"')
    .replace(/stroke="#FFF"/gi, 'stroke="currentColor"')
    .replace(/stroke="#F3F3F4"/gi, 'stroke="currentColor"')
    .replace(/stroke="#f3f3f4"/gi, 'stroke="currentColor"')
    .replace(/stroke="black"/gi, 'stroke="currentColor"')
    .replace(/stroke='black'/gi, "stroke='currentColor'")
    .replace(/stroke="#000000"/gi, 'stroke="currentColor"')
    .replace(/stroke="#000"/gi, 'stroke="currentColor"')
    .replace(/fill="white"/gi, 'fill="currentColor"')
    .replace(/fill='white'/gi, "fill='currentColor'")
    .replace(/fill="#ffffff"/gi, 'fill="currentColor"')
    .replace(/fill="#FFFFFF"/gi, 'fill="currentColor"')
    .replace(/fill="#fff"/gi, 'fill="currentColor"')
    .replace(/fill="#FFF"/gi, 'fill="currentColor"')
    .replace(/fill="#F3F3F4"/gi, 'fill="currentColor"')
    .replace(/fill="#f3f3f4"/gi, 'fill="currentColor"')
    .replace(/fill="black"/gi, 'fill="currentColor"')
    .replace(/fill='black'/gi, "fill='currentColor'")
    .replace(/fill="#000000"/gi, 'fill="currentColor"')
    .replace(/fill="#000"/gi, 'fill="currentColor"');

  // Figma часто экспортирует clip на весь viewBox — 1px stroke по краю обрезается → «разрывы».
  out = out.replace(/\s*clip-path="url\([^"]+\)"/gi, '');
  out = out.replace(/<clipPath[\s\S]*?<\/clipPath>/gi, '');
  out = out.replace(/<defs>\s*<\/defs>/gi, '');
  return out;
}

function iconFolderForFile(file: string): string {
  const stem = file.replace(/\.svg$/i, '');
  const sized = stem.match(/^(.*)_(s|m|l|xl)$/i);
  return sized ? sized[1] : stem;
}

function iconUrl(file: string): string {
  const base = typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL ? import.meta.env.BASE_URL : '/';
  const normalized = base.endsWith('/') ? base.slice(0, -1) : base;
  const folder = iconFolderForFile(file);
  return `${normalized}${ICON_DIR}${folder}/${file}`;
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

const SIZE_INVARIANT_ICON_KEYS = new Set<IconKey>([
  /** Вкладки поиска: всегда глиф Size=M (две звезды), не S (звезда+плюс) и не L. */
  'ai',
  'maximize2',
  'minimize2',
  'flipHorizontal',
  'flipVertical',
  /** Top bar: один файл chrome-close, без суффиксов пакета. */
  'closeChrome'
]);

/** Иконки без полного набора s/m/l/xl — не запрашивать отсутствующий размер. */
const SIZE_FALLBACK_ONLY_KEYS = new Set<IconKey>([
  'whiteboard',
  'arrowUp',
  'arrowDown',
  'arrowUpRight',
  'arrowLeftRight',
  'cursor',
  'pan',
  'pencil',
  'type',
  'eraser',
  'lineThin',
  'lineThik',
  'predictable',
  'line',
  'alignLeft',
  'alignCenter',
  'alignRight',
  'minimize',
  'aspectRatioHorizontal',
  'aspectRatioVertical',
  'aspectRatioPanoramic',
  'aspectRatioOther',
  'resolution',
  'arrowsHorizontal',
  'arrowsVertical',
  'shortcut',
  'library',
  'bug',
  'bugS',
  'pause',
  'highlighter'
]);

function resolveIconFile(iconKey: IconKey, scope?: HTMLElement): { preferred: string; fallback: string } {
  const fallback = ICON_FILES[iconKey];
  if (SIZE_INVARIANT_ICON_KEYS.has(iconKey)) {
    return { preferred: fallback, fallback };
  }
  const preferred = withSizeVariant(fallback, getIconSize(scope));
  // Старые иконки без полного набора размеров — не подменять чужим суффиксом.
  if (SIZE_FALLBACK_ONLY_KEYS.has(iconKey) && preferred !== fallback) {
    return { preferred: fallback, fallback };
  }
  if (fallback.endsWith('_s.svg') && preferred !== fallback && SIZE_FALLBACK_ONLY_KEYS.has(iconKey)) {
    return { preferred: fallback, fallback };
  }
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

function classToIconKey(element: HTMLElement): IconKey | null {
  for (const className of element.classList) {
    if (!className.startsWith('arc-icon-')) continue;
    const key = className.replace(/-/g, '_');
    const mapped = ICON_CLASS_TO_KEY[key];
    if (mapped) return mapped;
  }
  return null;
}

/** Стыки Figma-path (рамка начинается mid-edge) дают разрывы stroke в Chromium без round join. */
function hardenSvgStrokeJoins(svg: SVGSVGElement): void {
  svg.setAttribute('shape-rendering', 'geometricPrecision');
  svg.setAttribute('overflow', 'visible');
  svg.querySelectorAll('path, rect, circle, ellipse, line, polyline, polygon').forEach((node) => {
    if (!(node instanceof SVGElement)) return;
    const stroke = node.getAttribute('stroke');
    if (!stroke || stroke === 'none') return;
    if (!node.hasAttribute('stroke-linejoin')) node.setAttribute('stroke-linejoin', 'round');
  });
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
  hardenSvgStrokeJoins(svg);
  host.dataset.arcIconFile = file;
}

function preloadAllIcons(): Promise<void> {
  if (preloadPromise) return preloadPromise;
  const files = [...new Set(Object.values(ICON_FILES))];
  preloadPromise = Promise.all(files.map((f) => ensureSvgMarkup(f))).then(() => undefined);
  return preloadPromise;
}

/** Фоновый прогрев всего набора иконок — не блокирует hydrate. */
export function preloadArcNavbarIcons(): void {
  void preloadAllIcons();
}

async function hydrateIconNode(node: HTMLElement): Promise<void> {
  const iconKey = classToIconKey(node);
  if (!iconKey) return;
  const { preferred, fallback } = resolveIconFile(iconKey, node);
  if (node.dataset.arcIconFile === preferred && node.querySelector(':scope > svg.arc-navbar-icon-svg')) {
    return;
  }
  const normalized =
    (await ensureSvgMarkup(preferred)) ?? (preferred !== fallback ? await ensureSvgMarkup(fallback) : null);
  if (!normalized) return;
  const usedFile = svgMarkupCache.get(preferred) ? preferred : fallback;
  if (node.dataset.arcIconFile === usedFile && node.querySelector(':scope > svg.arc-navbar-icon-svg')) {
    return;
  }
  injectSvgMarkup(node, normalized, usedFile);
}

/** Асинхронно: подставляет SVG только для иконок в scope; полный preload — в фоне. */
export async function hydrateArcNavbarIcons(scope: ParentNode = document): Promise<void> {
  void preloadAllIcons();

  const nodes = scope.querySelectorAll(ICON_SELECTOR);
  await Promise.all(
    Array.from(nodes).map((node) => {
      if (!(node instanceof HTMLElement)) return Promise.resolve();
      return hydrateIconNode(node);
    })
  );
}
