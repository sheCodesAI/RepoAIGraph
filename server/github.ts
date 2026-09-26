import { RepositoryMetadata, FileItem } from './types.js';

export interface GitHubParseResult {
  owner: string;
  repo: string;
  repoId: string;
}

export function parseGitHubUrl(inputUrl: string): GitHubParseResult {
  const trimmed = inputUrl.trim();
  if (!trimmed) {
    throw new Error('Please enter a GitHub repository URL.');
  }

  // Handle various formats:
  // https://github.com/owner/repo
  // http://github.com/owner/repo/
  // github.com/owner/repo
  // git@github.com:owner/repo.git
  // owner/repo
  let normalized = trimmed.replace(/\.git$/, '').replace(/\/$/, '');

  const httpMatch = normalized.match(/github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)/i);
  if (httpMatch) {
    return {
      owner: httpMatch[1],
      repo: httpMatch[2],
      repoId: `${httpMatch[1]}/${httpMatch[2]}`,
    };
  }

  const sshMatch = normalized.match(/git@github\.com:([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)/i);
  if (sshMatch) {
    return {
      owner: sshMatch[1],
      repo: sshMatch[2],
      repoId: `${sshMatch[1]}/${sshMatch[2]}`,
    };
  }

  const shortMatch = normalized.match(/^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/);
  if (shortMatch) {
    return {
      owner: shortMatch[1],
      repo: shortMatch[2],
      repoId: `${shortMatch[1]}/${shortMatch[2]}`,
    };
  }

  throw new Error(`Invalid GitHub repository URL format: "${inputUrl}". Expected format: https://github.com/owner/repo`);
}

const IGNORED_DIRECTORIES = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.next',
  '.nuxt',
  'out',
  'venv',
  '.venv',
  'env',
  '.env',
  '__pycache__',
  '.pytest_cache',
  '.idea',
  '.vscode',
  '.github',
  'vendor',
  'tmp',
  'temp',
]);

const IGNORED_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp',
  '.mp4', '.mp3', '.pdf', '.zip', '.tar', '.gz',
  '.lock', '.log', '.map', '.min.js', '.min.css',
  '.woff', '.woff2', '.ttf', '.eot',
  '.exe', '.bin', '.dll', '.so', '.dylib',
  '.pyc', '.pyd',
]);

export function isRelevantSourceFile(path: string): boolean {
  const parts = path.split('/');
  for (const part of parts) {
    if (IGNORED_DIRECTORIES.has(part)) {
      return false;
    }
  }

  const extMatch = path.match(/\.[a-zA-Z0-9]+$/);
  if (extMatch && IGNORED_EXTENSIONS.has(extMatch[0].toLowerCase())) {
    return false;
  }

  return true;
}

export function detectLanguage(filePath: string): string {
  if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) return 'TypeScript';
  if (filePath.endsWith('.js') || filePath.endsWith('.jsx') || filePath.endsWith('.mjs')) return 'JavaScript';
  if (filePath.endsWith('.py')) return 'Python';
  if (filePath.endsWith('.json')) return 'JSON';
  if (filePath.endsWith('.md')) return 'Markdown';
  if (filePath.endsWith('.html')) return 'HTML';
  if (filePath.endsWith('.css')) return 'CSS';
  if (filePath.endsWith('.go')) return 'Go';
  if (filePath.endsWith('.rs')) return 'Rust';
  if (filePath.endsWith('.java')) return 'Java';
  return 'Other';
}

export class GitHubService {
  private token: string = process.env.GITHUB_TOKEN || '';

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'RepoGraph-AI-App',
    };
    if (this.token) {
      headers['Authorization'] = `token ${this.token}`;
    }
    return headers;
  }

  public async fetchRepository(owner: string, repo: string): Promise<RepositoryMetadata> {
    const url = `https://api.github.com/repos/${owner}/${repo}`;
    const res = await fetch(url, { headers: this.getHeaders() });

    if (res.status === 404) {
      throw new Error(`GitHub repository "${owner}/${repo}" was not found or is private.`);
    }

    if (res.status === 403) {
      const rateLimitReset = res.headers.get('x-ratelimit-reset');
      const resetTime = rateLimitReset ? new Date(parseInt(rateLimitReset, 10) * 1000).toLocaleTimeString() : 'shortly';
      throw new Error(`GitHub API rate limit exceeded. Resets at ${resetTime}. Set GITHUB_TOKEN in settings or environment to increase limits.`);
    }

    if (!res.ok) {
      throw new Error(`GitHub API responded with status ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    return {
      id: `${owner}/${repo}`,
      owner: data.owner?.login || owner,
      name: data.name || repo,
      description: data.description || 'No description provided.',
      defaultBranch: data.default_branch || 'main',
      stars: data.stargazers_count || 0,
      forks: data.forks_count || 0,
      language: data.language || 'Unknown',
      url: data.html_url,
      analyzedAt: new Date().toISOString(),
    };
  }

  public async fetchTree(owner: string, repo: string, branch: string): Promise<FileItem[]> {
    const url = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
    const res = await fetch(url, { headers: this.getHeaders() });

    if (!res.ok) {
      throw new Error(`Failed to fetch file tree for ${owner}/${repo} on branch ${branch}: ${res.statusText}`);
    }

    const data = await res.json();
    if (!data.tree || !Array.isArray(data.tree)) {
      return [];
    }

    if (data.truncated) {
      console.warn(`[GitHub] Repository ${owner}/${repo} tree was truncated (too many files).`);
    }

    return data.tree
      .filter((item: any) => item.type === 'blob' && isRelevantSourceFile(item.path))
      .map((item: any) => ({
        path: item.path,
        type: item.type,
        size: item.size || 0,
        language: detectLanguage(item.path),
      }));
  }

  public async fetchReadme(owner: string, repo: string): Promise<string> {
    const url = `https://api.github.com/repos/${owner}/${repo}/readme`;
    try {
      const res = await fetch(url, { headers: this.getHeaders() });
      if (!res.ok) return '';
      const data = await res.json();
      if (data.content && data.encoding === 'base64') {
        return Buffer.from(data.content, 'base64').toString('utf-8');
      }
      return '';
    } catch {
      return '';
    }
  }

  public async fetchFileContent(owner: string, repo: string, path: string, branch = 'main'): Promise<string> {
    // Attempt raw user content first as it doesn't count toward API rate limits
    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
    try {
      const rawRes = await fetch(rawUrl);
      if (rawRes.ok) {
        return await rawRes.text();
      }
    } catch {
      // fallback to API
    }

    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;
    const res = await fetch(apiUrl, { headers: this.getHeaders() });
    if (!res.ok) {
      throw new Error(`Failed to fetch content for ${path}`);
    }
    const data = await res.json();
    if (data.content && data.encoding === 'base64') {
      return Buffer.from(data.content, 'base64').toString('utf-8');
    }
    return '';
  }
}

export const githubService = new GitHubService();
