// Utility functions for generating URL-friendly slugs

/**
 * Generate a URL-friendly slug from a game title
 * Examples:
 *   "The Legend of Zelda: Breath of the Wild" -> "the-legend-of-zelda-breath-of-the-wild"
 *   "DOOM (2016)" -> "doom-2016"
 *   "Portal 2" -> "portal-2"
 */
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    // Remove special characters except spaces and hyphens
    .replace(/[^\w\s-]/g, '')
    // Replace spaces with hyphens
    .replace(/\s+/g, '-')
    // Remove consecutive hyphens
    .replace(/-+/g, '-')
    // Remove leading/trailing hyphens
    .replace(/^-+|-+$/g, '');
}

/**
 * Generate a unique slug by appending a number if the slug already exists
 * @param baseSlug The base slug to make unique
 * @param existingSlugs Array of slugs that already exist
 * @returns A unique slug
 */
export function generateUniqueSlug(baseSlug: string, existingSlugs: string[]): string {
  let slug = baseSlug;
  let counter = 1;

  while (existingSlugs.includes(slug)) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
}
