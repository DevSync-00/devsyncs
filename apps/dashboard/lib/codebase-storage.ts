import fs from 'fs/promises';
import { existsSync } from 'fs';
import os from 'os';
import path from 'path';
import { Readable, Transform } from 'stream';
import { pipeline } from 'stream/promises';
import { x as extractTar } from 'tar';

const DEFAULT_MAX_REPOSITORY_ARCHIVE_BYTES = 400 * 1024 * 1024;

function getMaxRepositoryArchiveBytes() {
  const configuredMb = Number(process.env.MAX_REPOSITORY_ARCHIVE_MB);
  return Number.isFinite(configuredMb) && configuredMb > 0
    ? configuredMb * 1024 * 1024
    : DEFAULT_MAX_REPOSITORY_ARCHIVE_BYTES;
}

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
  accessToken?: string | null,
  ref?: string | null,
) {
  if (!ref && existingClonePath && existsSync(existingClonePath)) {
    return existingClonePath;
  }

  const cloneDir = getProjectCloneDir(projectId);
  const baseDir = path.dirname(cloneDir);

  await fs.mkdir(baseDir, { recursive: true });
  await fs.rm(cloneDir, { recursive: true, force: true });
  await fs.mkdir(cloneDir, { recursive: true });

  try {
    await downloadAndExtractGitHubArchive(gitUrl, cloneDir, accessToken, ref);
  } catch (error) {
    await fs.rm(cloneDir, { recursive: true, force: true });
    throw error;
  }

  return cloneDir;
}

async function downloadAndExtractGitHubArchive(
  gitUrl: string,
  cloneDir: string,
  accessToken?: string | null,
  ref?: string | null,
) {
  const { owner, repository } = parseGitHubRepository(gitUrl);
  const token = accessToken || process.env.GITHUB_TOKEN?.trim();
  const response = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/tarball${ref ? `/${encodeURIComponent(ref)}` : ''}`,
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

  const maxArchiveBytes = getMaxRepositoryArchiveBytes();
  const contentLength = Number(response.headers.get('content-length') || 0);
  if (contentLength > maxArchiveBytes) {
    throw new Error(
      `Repository archive exceeds the ${Math.floor(maxArchiveBytes / 1024 / 1024)} MB processing limit.`
    );
  }

  if (!response.body) {
    throw new Error('GitHub returned an empty repository archive.');
  }

  let receivedBytes = 0;
  const enforceLimit = new Transform({
    transform(chunk, _encoding, callback) {
      receivedBytes += chunk.length;
      if (receivedBytes > maxArchiveBytes) {
        callback(
          new Error(
            `Repository archive exceeds the ${Math.floor(maxArchiveBytes / 1024 / 1024)} MB processing limit.`
          )
        );
        return;
      }
      callback(null, chunk);
    },
  });

  await pipeline(
    Readable.fromWeb(response.body as any),
    enforceLimit,
    extractTar({
      cwd: cloneDir,
      gzip: true,
      strip: 1,
      preservePaths: false,
    })
  );
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
