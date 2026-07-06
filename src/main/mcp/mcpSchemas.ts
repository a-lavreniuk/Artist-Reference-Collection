import { z } from 'zod';

import {
  emptyGalleryAdvancedFilters,
  type GalleryAdvancedFilters
} from '../shared/galleryFilterCore';

export const paginationOffsetSchema = z
  .number()
  .int()
  .min(0)
  .optional()
  .describe('Смещение пагинации (по умолчанию 0)');

export const paginationLimitSchema = z
  .number()
  .int()
  .min(1)
  .max(100)
  .optional()
  .describe('Размер страницы (по умолчанию 50, максимум 100)');

export const libraryScopeSchema = z
  .enum(['all', 'untagged', 'trash'])
  .optional()
  .describe('Область библиотеки: все, без меток или корзина');

export const gallerySortSchema = z
  .object({
    field: z
      .enum(['addedAt', 'fileType', 'fileWeight', 'resolution', 'duration', 'shuffle'])
      .describe('Поле сортировки'),
    direction: z.enum(['asc', 'desc']).describe('Направление сортировки'),
    shuffleSeed: z.number().int().optional().describe('Сид для сортировки «перемешать»')
  })
  .optional()
  .describe('Сортировка ленты');

const descriptionFilterSchema = z
  .object({
    mode: z.enum(['has', 'missing']),
    keywords: z.string().optional()
  })
  .nullable()
  .optional();

const linkFilterSchema = z
  .object({
    mode: z.enum(['has', 'missing']),
    keywords: z.string().optional()
  })
  .nullable()
  .optional();

export const galleryAdvancedFiltersSchema = z
  .object({
    aspectRatios: z
      .array(z.enum(['horizontal', 'vertical', 'square', 'panoramic']))
      .optional()
      .describe('Соотношения сторон'),
    fileExtensions: z.array(z.string()).optional().describe('Расширения файлов без точки'),
    description: descriptionFilterSchema.describe('Фильтр по описанию'),
    link: linkFilterSchema.describe('Фильтр по ссылке'),
    dateAdded: z
      .array(
        z.union([
          z.object({
            preset: z.enum([
              'today',
              'yesterday',
              'week',
              'month',
              'threeMonths',
              'year'
            ])
          }),
          z.object({
            preset: z.literal('custom'),
            from: z.string(),
            to: z.string().optional()
          })
        ])
      )
      .optional()
      .describe('Фильтр по дате добавления'),
    fileWeight: z.array(z.record(z.string(), z.unknown())).optional(),
    resolution: z.array(z.record(z.string(), z.unknown())).optional(),
    duration: z.array(z.record(z.string(), z.unknown())).optional()
  })
  .optional()
  .describe('Расширенные фильтры галереи (как в navbar)');

export const cardIdSchema = z.string().describe('Идентификатор карточки');

export const tagIdsSchema = z.array(z.string()).describe('Список идентификаторов меток');

export const collectionIdSchema = z.string().describe('Идентификатор коллекции');

export const categoryIdSchema = z.string().describe('Идентификатор категории меток');

export const tagIdSchema = z.string().describe('Идентификатор метки');

export const hexColorSchema = z.string().describe('Цвет в формате #RRGGBB');

export const mediaVariantSchema = z.enum(['thumb', 'original']).describe('Вариант медиа');

export function mergeGalleryAdvancedFilters(
  input?: z.infer<typeof galleryAdvancedFiltersSchema>
): GalleryAdvancedFilters {
  if (!input) return emptyGalleryAdvancedFilters();
  return {
    ...emptyGalleryAdvancedFilters(),
    ...input,
    aspectRatios: input.aspectRatios ?? [],
    fileExtensions: input.fileExtensions ?? [],
    dateAdded: (input.dateAdded ?? []) as GalleryAdvancedFilters['dateAdded'],
    fileWeight: (input.fileWeight ?? []) as GalleryAdvancedFilters['fileWeight'],
    resolution: (input.resolution ?? []) as GalleryAdvancedFilters['resolution'],
    duration: (input.duration ?? []) as GalleryAdvancedFilters['duration']
  };
}
