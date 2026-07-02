const { execFileSync } = require('node:child_process');
const { readFileSync, existsSync } = require('node:fs');
const { resolve, dirname } = require('node:path');

const gitHashPattern = /^[a-f0-9]{7,40}$/iu;

function findWorkspaceRoot(startDir) {
  let current = startDir;
  const seen = new Set();

  while (current && !seen.has(current)) {
    seen.add(current);
    const candidate = resolve(current, 'package.json');
    if (existsSync(candidate)) {
      try {
        const pkg = JSON.parse(readFileSync(candidate, 'utf8'));
        if (pkg && typeof pkg.name === 'string') {
          return current;
        }
      } catch {
      }
    }
    const parent = dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  return startDir;
}

const workspaceRoot = findWorkspaceRoot(process.cwd());
const packageJsonPath = resolve(workspaceRoot, 'package.json');

function runGit(args) {
  return execFileSync('git', args, {
    cwd: workspaceRoot,
    encoding: 'utf8'
  }).trim();
}

function isGitRepo() {
  try {
    runGit(['rev-parse', '--git-dir']);
    return true;
  } catch {
    return false;
  }
}

function resolveAppVersion() {
  try {
    const rootPackageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    const baseVersion = rootPackageJson.version || '0.1.0';
    const [major = '0', minor = '1'] = baseVersion.split('.');
    const commitCount = runGit(['rev-list', '--count', 'HEAD']);
    return `${major}.${minor}.${commitCount}`;
  } catch {
    return '0.1.0';
  }
}

function resolveCurrentCommitHash() {
  try {
    return runGit(['rev-parse', 'HEAD']);
  } catch {
    return '';
  }
}

function resolveCurrentShortCommitHash() {
  try {
    return runGit(['rev-parse', '--short', 'HEAD']);
  } catch {
    return '';
  }
}

function resolveCurrentBranch() {
  try {
    return runGit(['rev-parse', '--abbrev-ref', 'HEAD']);
  } catch {
    return '';
  }
}

function parseGitLog(logOutput) {
  if (!logOutput) {
    return [];
  }

  return logOutput
    .split('\x1e')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [shortHash = '', hash = '', authorName = '', authoredAt = '', subject = ''] = entry.split('\x1f');
      return { authorName, authoredAt, hash, shortHash, subject };
    });
}

function resolveRecentCommits(limit = 10) {
  if (!isGitRepo()) {
    return [];
  }
  try {
    const logOutput = runGit([
      'log',
      '-n',
      String(limit),
      '--date=iso-strict',
      '--pretty=format:%h%x1f%H%x1f%an%x1f%aI%x1f%s%x1e'
    ]);
    return parseGitLog(logOutput);
  } catch {
    return [];
  }
}

function resolveCommitsSince(fromCommit, currentCommit, limit = 10) {
  if (!fromCommit || !gitHashPattern.test(fromCommit) || fromCommit === currentCommit) {
    return { commits: [], rangeFound: Boolean(fromCommit && fromCommit === currentCommit) };
  }

  if (!isGitRepo()) {
    return { commits: [], rangeFound: false };
  }

  try {
    runGit(['cat-file', '-e', `${fromCommit}^{commit}`]);
    const logOutput = runGit([
      'log',
      `${fromCommit}..HEAD`,
      '--date=iso-strict',
      '--pretty=format:%h%x1f%H%x1f%an%x1f%aI%x1f%s%x1e'
    ]);
    return { commits: parseGitLog(logOutput), rangeFound: true };
  } catch {
    try {
      const logOutput = runGit([
        'log',
        '-n',
        String(limit),
        '--date=iso-strict',
        '--pretty=format:%h%x1f%H%x1f%an%x1f%aI%x1f%s%x1e'
      ]);
      return { commits: parseGitLog(logOutput), rangeFound: false };
    } catch {
      return { commits: [], rangeFound: false };
    }
  }
}

function resolveAppInfo() {
  return {
    branch: resolveCurrentBranch(),
    buildTime: new Date().toISOString(),
    commitHash: resolveCurrentCommitHash(),
    recentCommits: resolveRecentCommits(),
    shortCommitHash: resolveCurrentShortCommitHash(),
    version: resolveAppVersion()
  };
}

module.exports = {
  resolveAppInfo,
  resolveAppVersion,
  resolveCommitsSince,
  resolveCurrentBranch,
  resolveCurrentCommitHash,
  resolveCurrentShortCommitHash,
  resolveRecentCommits,
  workspaceRoot
};
