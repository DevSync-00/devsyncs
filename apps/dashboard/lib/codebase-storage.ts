import fs from 'fs/promises';
import { existsSync } from 'fs';
import os from 'os';
import path from 'path';
import { x as extractTar } from 'tar';

const MAX_REPOSITORY_ARCHIVE_BYTES = 100 * 1024 * 1024;

export function getProjectsCloneBaseDir() {
  return process.env.PROJECTS_CLONE_DIR || path.join(os.tmpdir(), 'devsync-projects');
}

export function getProjectCloneDir(projectId: string) {
  return path.join(getProjectsCloneBaseDir(), projectId);
}

export async function ensureGitClone(
  projectId: string,
  gitUrl: string,
  existingClonePath?: string | null,
  accessToken?: string | null
) {
  if (existingClonePath && existsSync(existingClonePath)) {
    return existingClonePath;
  }

  const cloneDir = getProjectCloneDir(projectId);
  const baseDir = path.dirname(cloneDir);
  const archivePath = path.join(baseDir, `${projectId}-${Date.now()}.tar.gz`);

  await fs.mkdir(baseDir, { recursive: true });
  await fs.rm(cloneDir, { recursive: true, force: true });
  await fs.mkdir(cloneDir, { recursive: true });

  try {
    const archive = await downloadGitHubArchive(gitUrl, accessToken);
    await fs.writeFile(archivePath, archive);
    await extractTar({
      cwd: cloneDir,
      file: archivePath,
      gzip: true,
      strip: 1,
      preservePaths: false,
    });
  } catch (error) {
    await fs.rm(cloneDir, { recursive: true, force: true });
    throw error;
  } finally {
    await fs.rm(archivePath, { force: true });
  }

  return cloneDir;
}

async function downloadGitHubArchive(gitUrl: string, accessToken?: string | null): Promise<Buffer> {
  const { owner, repository } = parseGitHubRepository(gitUrl);
  const token = accessToken || process.env.GITHUB_TOKEN?.trim();
  const response = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/tarball`,
    {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'DevSync',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      redirect: 'follow',
    }
  );

  if (!response.ok) {
    const privateRepoHint = response.status === 401 || response.status === 403 || response.status === 404
      ? ' Connect the DevSync GitHub App and grant it access to this repository.'
      : '';
    throw new Error(
      `GitHub repository download failed (${response.status} ${response.statusText}).${privateRepoHint}`
    );
  }

  const contentLength = Number(response.headers.get('content-length') || 0);
  if (contentLength > MAX_REPOSITORY_ARCHIVE_BYTES) {
    throw new Error('Repository archive exceeds the 100 MB serverless processing limit.');
  }

  const archive = Buffer.from(await response.arrayBuffer());
  if (archive.byteLength > MAX_REPOSITORY_ARCHIVE_BYTES) {
    throw new Error('Repository archive exceeds the 100 MB serverless processing limit.');
  }

  return archive;
}

export function parseGitHubRepository(gitUrl: string): { owner: string; repository: string } {
  let parsed: URL;
  try {
    parsed = new URL(gitUrl);
  } catch {
    throw new Error('Invalid GitHub repository URL.');
  }

  if (parsed.protocol !== 'https:' || parsed.hostname.toLowerCase() !== 'github.com') {
    throw new Error('Deployed repository scanning currently supports HTTPS GitHub URLs only.');
  }

  const segments = parsed.pathname.replace(/^\/+|\/+$/g, '').split('/');
  if (segments.length !== 2 || !segments[0] || !segments[1]) {
    throw new Error('Use a GitHub repository URL in the form https://github.com/owner/repository.');
  }

  return {
    owner: segments[0],
    repository: segments[1].replace(/\.git$/i, ''),
  };
}
