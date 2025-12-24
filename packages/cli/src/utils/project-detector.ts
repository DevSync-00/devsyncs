import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, basename, resolve } from 'path';
import { execSync } from 'child_process';

export interface ProjectInfo {
  name: string;
  schemaType: string | null;
  gitRemote?: string;
  gitBranch?: string;
  packageManager?: 'npm' | 'yarn' | 'pnpm' | 'bun';
  description?: string;
  path: string;
}

/**
 * Detect project name from various sources
 */
export function detectProjectName(basePath: string): string {
  // 1. Try package.json name
  const packageJsonPath = join(basePath, 'package.json');
  if (existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
      if (packageJson.name && packageJson.name !== '') {
        return packageJson.name;
      }
    } catch {
      // Ignore errors
    }
  }

  // 2. Try git repository name
  try {
    const gitRemote = getGitRemote(basePath);
    if (gitRemote) {
      // Extract repo name from git remote URL
      const match = gitRemote.match(/(?:.*\/)?([^\/]+?)(?:\.git)?$/);
      if (match && match[1]) {
        return match[1];
      }
    }
  } catch {
    // Ignore errors
  }

  // 3. Use directory name as fallback
  return basename(resolve(basePath));
}

/**
 * Detect schema type from codebase
 */
export function detectSchemaType(basePath: string): string | null {
  // Check in order of priority
  if (existsSync(join(basePath, 'prisma', 'schema.prisma'))) {
    return 'prisma';
  }
  
  if (existsSync(join(basePath, 'supabase', 'migrations'))) {
    return 'supabase';
  }
  
  // Check for TypeORM entities
  if (globMatch(basePath, '**/*.entity.ts') || globMatch(basePath, '**/*.entity.js')) {
    return 'typeorm';
  }
  
  // Check for Kysely
  if (globMatch(basePath, '**/kysely/**/*.ts') || existsSync(join(basePath, 'src', 'db', 'schema.ts'))) {
    return 'kysely';
  }
  
  // Check for Sequelize
  if (globMatch(basePath, '**/*.model.ts') || globMatch(basePath, '**/*.model.js')) {
    return 'sequelize';
  }
  
  // Check for Drizzle
  const drizzlePaths = [
    join(basePath, 'src', 'db', 'schema.ts'),
    join(basePath, 'src', 'schema.ts'),
    join(basePath, 'schema.ts'),
    join(basePath, 'drizzle', 'schema.ts'),
  ];
  if (drizzlePaths.some(p => existsSync(p))) {
    return 'drizzle';
  }
  
  // Check for Django
  if (existsSync(join(basePath, 'manage.py')) || globMatch(basePath, '**/models.py')) {
    return 'django';
  }
  
  // Check for SQLAlchemy
  if (globMatch(basePath, '**/*models.py') || globMatch(basePath, '**/models.py')) {
    return 'sqlalchemy';
  }
  
  // Check for raw SQL migrations
  if (globMatch(basePath, '**/migrations/*.sql') || globMatch(basePath, '**/db/migrations/*.sql')) {
    return 'raw-sql';
  }
  
  return null;
}

/**
 * Get git remote URL
 */
export function getGitRemote(basePath: string): string | null {
  try {
    const gitDir = join(basePath, '.git');
    if (!existsSync(gitDir)) {
      return null;
    }
    
    // Try to get remote URL
    const result = execSync('git remote get-url origin', { 
      cwd: basePath,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
    
    return result || null;
  } catch {
    return null;
  }
}

/**
 * Get current git branch
 */
export function getGitBranch(basePath: string): string | null {
  try {
    const gitDir = join(basePath, '.git');
    if (!existsSync(gitDir)) {
      return null;
    }
    
    const result = execSync('git branch --show-current', {
      cwd: basePath,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
    
    return result || null;
  } catch {
    return null;
  }
}

/**
 * Detect package manager
 */
export function detectPackageManager(basePath: string): 'npm' | 'yarn' | 'pnpm' | 'bun' | undefined {
  if (existsSync(join(basePath, 'yarn.lock'))) {
    return 'yarn';
  }
  if (existsSync(join(basePath, 'pnpm-lock.yaml'))) {
    return 'pnpm';
  }
  if (existsSync(join(basePath, 'bun.lockb'))) {
    return 'bun';
  }
  if (existsSync(join(basePath, 'package-lock.json'))) {
    return 'npm';
  }
  return undefined;
}

/**
 * Get project description from package.json
 */
export function getProjectDescription(basePath: string): string | undefined {
  const packageJsonPath = join(basePath, 'package.json');
  if (existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
      return packageJson.description;
    } catch {
      // Ignore errors
    }
  }
  return undefined;
}

/**
 * Detect all project information
 */
export function detectProjectInfo(basePath: string): ProjectInfo {
  const absolutePath = resolve(basePath);
  
  return {
    name: detectProjectName(absolutePath),
    schemaType: detectSchemaType(absolutePath),
    gitRemote: getGitRemote(absolutePath) || undefined,
    gitBranch: getGitBranch(absolutePath) || undefined,
    packageManager: detectPackageManager(absolutePath),
    description: getProjectDescription(absolutePath),
    path: absolutePath,
  };
}

/**
 * Simple glob matching (checks if any file matches pattern)
 * Uses recursive directory search
 */
function globMatch(basePath: string, pattern: string): boolean {
  try {
    const fileName = pattern.split('/').pop() || '';
    const searchDirs = ['src', 'lib', 'app', 'apps', 'packages', 'db', 'database', '.'];
    
    for (const dir of searchDirs) {
      const searchPath = join(basePath, dir);
      if (existsSync(searchPath)) {
        if (findFileRecursive(searchPath, fileName)) {
          return true;
        }
      }
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Recursively search for a file matching pattern
 */
function findFileRecursive(dir: string, pattern: string, maxDepth: number = 5, currentDepth: number = 0): boolean {
  if (currentDepth >= maxDepth) {
    return false;
  }
  
  try {
    const entries = readdirSync(dir);
    
    for (const entry of entries) {
      // Skip node_modules and other common ignore dirs
      if (entry === 'node_modules' || entry === '.git' || entry === 'dist' || entry === 'build') {
        continue;
      }
      
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      
      if (stat.isDirectory()) {
        if (findFileRecursive(fullPath, pattern, maxDepth, currentDepth + 1)) {
          return true;
        }
      } else if (stat.isFile()) {
        // Simple pattern matching
        if (pattern.includes('*')) {
          const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
          if (regex.test(entry)) {
            return true;
          }
        } else if (entry === pattern) {
          return true;
        }
      }
    }
    
    return false;
  } catch {
    return false;
  }
}

/**
 * Match project info with existing projects (fuzzy matching)
 * Improved matching algorithm for better accuracy
 */
export function matchProject(
  projectInfo: ProjectInfo,
  existingProjects: Array<{ id: string; name: string; schemaType?: string; schema_type?: string; slug?: string }>
): Array<{ project: typeof existingProjects[0]; score: number }> {
  const matches: Array<{ project: typeof existingProjects[0]; score: number }> = [];
  
  const projectNameLower = projectInfo.name.toLowerCase().trim();
  const projectNameNormalized = projectNameLower.replace(/[^a-z0-9]/g, '');
  
  for (const existing of existingProjects) {
    let score = 0;
    const existingSchemaType = existing.schemaType || existing.schema_type;
    const existingNameLower = existing.name.toLowerCase().trim();
    const existingNameNormalized = existingNameLower.replace(/[^a-z0-9]/g, '');
    
    // Exact name match (highest priority)
    if (existingNameLower === projectNameLower) {
      score += 100;
    }
    // Normalized name match (handles special characters, spaces, etc.)
    else if (existingNameNormalized === projectNameNormalized && existingNameNormalized.length > 0) {
      score += 95;
    }
    // Slug match (if available) - very reliable
    else if (existing.slug && existing.slug.toLowerCase() === projectNameLower) {
      score += 90;
    }
    // Partial name match (one contains the other)
    else if (existingNameLower.includes(projectNameLower) || projectNameLower.includes(existingNameLower)) {
      // Calculate similarity based on overlap
      const longer = existingNameLower.length > projectNameLower.length ? existingNameLower : projectNameLower;
      const shorter = existingNameLower.length > projectNameLower.length ? projectNameLower : existingNameLower;
      const overlap = shorter.length / longer.length;
      score += Math.floor(50 * overlap);
    }
    // Levenshtein-like similarity for close matches
    else {
      const similarity = calculateStringSimilarity(projectNameLower, existingNameLower);
      if (similarity > 0.7) {
        score += Math.floor(40 * similarity);
      }
    }
    
    // Schema type match (bonus points)
    if (projectInfo.schemaType && existingSchemaType && existingSchemaType === projectInfo.schemaType) {
      score += 30;
    }
    
    // Git remote match (if available) - very reliable
    if (projectInfo.gitRemote && existing.slug) {
      const gitRepoName = extractRepoNameFromRemote(projectInfo.gitRemote);
      if (gitRepoName && (gitRepoName.toLowerCase() === existingNameLower || gitRepoName.toLowerCase() === existing.slug.toLowerCase())) {
        score += 85;
      }
    }
    
    if (score > 0) {
      matches.push({ project: existing, score });
    }
  }
  
  // Sort by score descending
  return matches.sort((a, b) => b.score - a.score);
}

/**
 * Calculate string similarity (simple Levenshtein-like)
 */
function calculateStringSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

/**
 * Extract repository name from git remote URL
 */
function extractRepoNameFromRemote(remote: string): string | null {
  try {
    const match = remote.match(/(?:.*\/)?([^\/]+?)(?:\.git)?$/);
    return match && match[1] ? match[1] : null;
  } catch {
    return null;
  }
}

