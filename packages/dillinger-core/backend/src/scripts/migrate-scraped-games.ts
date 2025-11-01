// Migration script to move scraped-games to metadata with slug-based directories
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateSlug, generateUniqueSlug } from '@dillinger/shared';
import type { SavedGameMetadata } from '@dillinger/shared';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DILLINGER_ROOT = process.env.DILLINGER_ROOT || path.join(__dirname, '..', '..', 'data');
const STORAGE_PATH = path.join(DILLINGER_ROOT, 'storage');
const OLD_PATH = path.join(STORAGE_PATH, 'scraped-games');
const NEW_PATH = path.join(STORAGE_PATH, 'metadata');

async function migrateScrapedGames() {
  console.log('🔄 Starting migration from scraped-games to metadata...');
  
  // Ensure new path exists
  await fs.ensureDir(NEW_PATH);
  
  // Check if old path exists
  if (!(await fs.pathExists(OLD_PATH))) {
    console.log('✅ No scraped-games directory found, nothing to migrate');
    return;
  }
  
  // Get all game directories
  const gameDirs = await fs.readdir(OLD_PATH);
  console.log(`📦 Found ${gameDirs.length} games to migrate`);
  
  const existingSlugs: string[] = [];
  
  for (const dir of gameDirs) {
    const oldGamePath = path.join(OLD_PATH, dir);
    const metadataFile = path.join(oldGamePath, 'metadata.json');
    
    if (!(await fs.pathExists(metadataFile))) {
      console.log(`⚠️  Skipping ${dir} - no metadata.json found`);
      continue;
    }
    
    try {
      // Read old metadata
      const metadata = await fs.readJSON(metadataFile) as Omit<SavedGameMetadata, 'slug'>;
      
      // Generate slug
      const baseSlug = generateSlug(metadata.scraperData.title);
      const slug = generateUniqueSlug(baseSlug, existingSlugs);
      existingSlugs.push(slug);
      
      // Create new metadata with slug
      const newMetadata: SavedGameMetadata = {
        ...metadata,
        slug,
      };
      
      // Create new game directory
      const newGamePath = path.join(NEW_PATH, slug);
      await fs.ensureDir(newGamePath);
      
      // Copy images directory if it exists
      const oldImagesPath = path.join(oldGamePath, 'images');
      const newImagesPath = path.join(newGamePath, 'images');
      
      if (await fs.pathExists(oldImagesPath)) {
        await fs.copy(oldImagesPath, newImagesPath);
        console.log(`  📁 Copied images for ${metadata.scraperData.title}`);
      }
      
      // Write new metadata
      await fs.writeJSON(path.join(newGamePath, 'metadata.json'), newMetadata, { spaces: 2 });
      
      console.log(`✅ Migrated: ${metadata.scraperData.title} -> ${slug}`);
      
    } catch (error) {
      console.error(`❌ Failed to migrate ${dir}:`, error);
    }
  }
  
  console.log('\n🎉 Migration complete!');
  console.log(`📂 Old data is still in: ${OLD_PATH}`);
  console.log(`📂 New data is in: ${NEW_PATH}`);
  console.log('\n💡 You can safely delete the scraped-games directory after verifying the migration.');
}

migrateScrapedGames().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
