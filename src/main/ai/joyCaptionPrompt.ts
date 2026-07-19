/** JoyCaption index/AI-description prompt builder (HF Space templates). */

export const JOY_CAPTION_TYPE_IDS = [
  'descriptive_casual',
  'straightforward',
  'stable_diffusion',
  'midjourney',
  'art_critic',
  'product_listing',
  'social_media',
  'danbooru'
] as const;

export type JoyCaptionTypeId = (typeof JOY_CAPTION_TYPE_IDS)[number];

export const JOY_CAPTION_LENGTH_LEVELS = [0, 20, 40, 60, 80, 100] as const;
export type JoyCaptionLengthLevel = (typeof JOY_CAPTION_LENGTH_LEVELS)[number];

export const JOY_CAPTION_EXTRA_IDS = [
  'lighting',
  'camera_angle',
  'aesthetic_quality',
  'composition',
  'no_text',
  'depth_of_field',
  'lighting_sources',
  'sfw_rating',
  'only_important',
  'no_artist_title',
  'orientation',
  'vulgar_slang',
  'ages',
  'shot_type',
  'vantage_height'
] as const;

export type JoyCaptionExtraId = (typeof JOY_CAPTION_EXTRA_IDS)[number];

const LENGTH_BY_LEVEL: Record<JoyCaptionLengthLevel, string> = {
  0: 'any',
  20: 'very short',
  40: 'short',
  60: 'medium-length',
  80: 'long',
  100: 'very long'
};

/** Space CAPTION_TYPE_MAP: [any, word_count, length-descriptor]. We use index 0 for any, index 2 for named lengths. */
const CAPTION_TYPE_TEMPLATES: Record<JoyCaptionTypeId, [string, string, string]> = {
  descriptive_casual: [
    'Write a descriptive caption for this image in a casual tone.',
    'Write a descriptive caption for this image in a casual tone within {word_count} words.',
    'Write a {length} descriptive caption for this image in a casual tone.'
  ],
  straightforward: [
    'Write a straightforward caption for this image. Begin with the main subject and medium. Mention pivotal elements—people, objects, scenery—using confident, definite language. Focus on concrete details like color, shape, texture, and spatial relationships. Show how elements interact. Omit mood and speculative wording. If text is present, quote it exactly. Note any watermarks, signatures, or compression artifacts. Never mention what\'s absent, resolution, or unobservable details. Vary your sentence structure and keep the description concise, without starting with “This image is…” or similar phrasing.',
    'Write a straightforward caption for this image within {word_count} words. Begin with the main subject and medium. Mention pivotal elements—people, objects, scenery—using confident, definite language. Focus on concrete details like color, shape, texture, and spatial relationships. Show how elements interact. Omit mood and speculative wording. If text is present, quote it exactly. Note any watermarks, signatures, or compression artifacts. Never mention what\'s absent, resolution, or unobservable details. Vary your sentence structure and keep the description concise, without starting with “This image is…” or similar phrasing.',
    'Write a {length} straightforward caption for this image. Begin with the main subject and medium. Mention pivotal elements—people, objects, scenery—using confident, definite language. Focus on concrete details like color, shape, texture, and spatial relationships. Show how elements interact. Omit mood and speculative wording. If text is present, quote it exactly. Note any watermarks, signatures, or compression artifacts. Never mention what\'s absent, resolution, or unobservable details. Vary your sentence structure and keep the description concise, without starting with “This image is…” or similar phrasing.'
  ],
  stable_diffusion: [
    'Output a stable diffusion prompt that is indistinguishable from a real stable diffusion prompt.',
    'Output a stable diffusion prompt that is indistinguishable from a real stable diffusion prompt. {word_count} words or less.',
    'Output a {length} stable diffusion prompt that is indistinguishable from a real stable diffusion prompt.'
  ],
  midjourney: [
    'Write a MidJourney prompt for this image.',
    'Write a MidJourney prompt for this image within {word_count} words.',
    'Write a {length} MidJourney prompt for this image.'
  ],
  art_critic: [
    'Analyze this image like an art critic would with information about its composition, style, symbolism, the use of color, light, any artistic movement it might belong to, etc.',
    'Analyze this image like an art critic would with information about its composition, style, symbolism, the use of color, light, any artistic movement it might belong to, etc. Keep it within {word_count} words.',
    'Analyze this image like an art critic would with information about its composition, style, symbolism, the use of color, light, any artistic movement it might belong to, etc. Keep it {length}.'
  ],
  product_listing: [
    'Write a caption for this image as though it were a product listing.',
    'Write a caption for this image as though it were a product listing. Keep it under {word_count} words.',
    'Write a {length} caption for this image as though it were a product listing.'
  ],
  social_media: [
    'Write a caption for this image as if it were being used for a social media post.',
    'Write a caption for this image as if it were being used for a social media post. Limit the caption to {word_count} words.',
    'Write a {length} caption for this image as if it were being used for a social media post.'
  ],
  danbooru: [
    'Generate only comma-separated Danbooru tags (lowercase_underscores). Strict order: `artist:`, `copyright:`, `character:`, `meta:`, then general tags. Include counts (1girl), appearance, clothing, accessories, pose, expression, actions, background. Use precise Danbooru syntax. No extra text.',
    'Generate only comma-separated Danbooru tags (lowercase_underscores). Strict order: `artist:`, `copyright:`, `character:`, `meta:`, then general tags. Include counts (1girl), appearance, clothing, accessories, pose, expression, actions, background. Use precise Danbooru syntax. No extra text. {word_count} words or less.',
    'Generate only comma-separated Danbooru tags (lowercase_underscores). Strict order: `artist:`, `copyright:`, `character:`, `meta:`, then general tags. Include counts (1girl), appearance, clothing, accessories, pose, expression, actions, background. Use precise Danbooru syntax. No extra text. {length} length.'
  ]
};

const EXTRA_EN: Record<JoyCaptionExtraId, string> = {
  lighting: 'Include information about lighting.',
  camera_angle: 'Include information about camera angle.',
  aesthetic_quality:
    'You MUST include information about the subjective aesthetic quality of the image from low to very high.',
  composition:
    'Include information on the image\'s composition style, such as leading lines, rule of thirds, or symmetry.',
  no_text: 'Do NOT mention any text that is in the image.',
  depth_of_field:
    'Specify the depth of field and whether the background is in focus or blurred.',
  lighting_sources:
    'If applicable, mention the likely use of artificial or natural lighting sources.',
  sfw_rating: 'Include whether the image is sfw, suggestive, or nsfw.',
  only_important: 'ONLY describe the most important elements of the image.',
  no_artist_title:
    'If it is a work of art, do not include the artist\'s name or the title of the work.',
  orientation:
    'Identify the image orientation (portrait, landscape, or square) and aspect ratio if obvious.',
  vulgar_slang:
    'Use vulgar slang and profanity, such as (but not limited to) "fucking," "slut," "cock," etc.',
  ages: 'Include information about the ages of any people/characters when applicable.',
  shot_type:
    'Mention whether the image depicts an extreme close-up, close-up, medium close-up, medium shot, cowboy shot, medium wide shot, wide shot, or extreme wide shot.',
  vantage_height:
    'Explicitly specify the vantage height (eye-level, low-angle worm’s-eye, bird’s-eye, drone, rooftop, etc.).'
};

const EXTRA_ID_SET = new Set<string>(JOY_CAPTION_EXTRA_IDS);
const TYPE_ID_SET = new Set<string>(JOY_CAPTION_TYPE_IDS);

export function sanitizeJoyCaptionType(raw: unknown): JoyCaptionTypeId {
  if (typeof raw === 'string' && TYPE_ID_SET.has(raw)) return raw as JoyCaptionTypeId;
  return 'descriptive_casual';
}

export function sanitizeJoyCaptionLengthLevel(raw: unknown): JoyCaptionLengthLevel {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return 80;
  const stepped = Math.round(raw / 20) * 20;
  const clamped = Math.max(0, Math.min(100, stepped)) as JoyCaptionLengthLevel;
  return (JOY_CAPTION_LENGTH_LEVELS as readonly number[]).includes(clamped) ? clamped : 80;
}

export function sanitizeJoyCaptionExtraIds(raw: unknown): JoyCaptionExtraId[] {
  if (!Array.isArray(raw)) return [];
  const out: JoyCaptionExtraId[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== 'string' || !EXTRA_ID_SET.has(item) || seen.has(item)) continue;
    seen.add(item);
    out.push(item as JoyCaptionExtraId);
  }
  return out;
}

export function lengthTokenForLevel(level: JoyCaptionLengthLevel): string {
  return LENGTH_BY_LEVEL[level] ?? 'long';
}

export type IndexCaptionPromptInput = {
  aiCaptionType?: unknown;
  aiCaptionLengthLevel?: unknown;
  aiCaptionExtraIds?: unknown;
};

/**
 * Builds the English JoyCaption user prompt for indexing / AI description.
 * Does not expose to renderer — call only from main.
 */
export function buildIndexCaptionPrompt(input: IndexCaptionPromptInput): string {
  const type = sanitizeJoyCaptionType(input.aiCaptionType);
  const level = sanitizeJoyCaptionLengthLevel(input.aiCaptionLengthLevel);
  const extras = sanitizeJoyCaptionExtraIds(input.aiCaptionExtraIds);
  const lengthToken = lengthTokenForLevel(level);
  const templates = CAPTION_TYPE_TEMPLATES[type];
  const template = lengthToken === 'any' ? templates[0] : templates[2];
  let prompt = template.replace(/\{length\}/g, lengthToken).replace(/\{word_count\}/g, lengthToken);

  if (extras.length > 0) {
    prompt += ' ' + extras.map((id) => EXTRA_EN[id]).join(' ');
  }

  prompt += ' Write the caption in Russian.';
  return prompt.trim();
}
