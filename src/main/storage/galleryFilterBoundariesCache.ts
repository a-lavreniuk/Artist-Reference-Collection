import type Database from 'better-sqlite3';
import { computeGalleryFilterBoundaries, type GalleryAdvancedFilters, type GalleryFilterBoundaries } from './galleryFilters';

let cachedDb: Database.Database | null = null;
let cachedBoundaries: GalleryFilterBoundaries | null = null;

export function needsGalleryFilterBoundaries(filters: GalleryAdvancedFilters): boolean {
  return (
    filters.fileWeight.length > 0 ||
    filters.resolution.length > 0 ||
    filters.duration.length > 0
  );
}

export function getGalleryFilterBoundaries(
  db: Database.Database,
  filters: GalleryAdvancedFilters
): GalleryFilterBoundaries | undefined {
  if (!needsGalleryFilterBoundaries(filters)) return undefined;
  if (cachedDb === db && cachedBoundaries) return cachedBoundaries;
  cachedDb = db;
  cachedBoundaries = computeGalleryFilterBoundaries(db);
  return cachedBoundaries;
}

export function invalidateGalleryFilterBoundariesCache(): void {
  cachedDb = null;
  cachedBoundaries = null;
}
