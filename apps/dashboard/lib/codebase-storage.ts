import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

export function getProjectsCloneBaseDir() {
  return process.env.PROJECTS_CLONE_DIR || path.join(process.cwd(), '.devsync-projects');
}

export function getProjectCloneDir(projectId: string) {
  return path.join(getProjectsCloneBaseDir(), projectId);
}

export async function ensureGitClone(projectId: string, gitUrl: string, existingClonePath?: string | null) {
  if (existingClonePath && existsSync(existingClonePath)) {
    return existingClonePath;
  }

  const simpleGit = (await import('simple-git')).default;
  const cloneDir = getProjectCloneDir(projectId);
  const baseDir = path.dirname(cloneDir);

  await fs.mkdir(baseDir, { recursive: true });
  await fs.rm(cloneDir, { recursive: true, force: true });

  const git = simpleGit();
  await git.clone(gitUrl, cloneDir, {
    '--depth': '1',
  });

  return cloneDir;
}
