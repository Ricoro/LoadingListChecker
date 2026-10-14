// Verify the release feed without authentication.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const crypto = require('node:crypto');
const { NodeHttpExecutor } = require('builder-util/out/nodeHttpExecutor');
const { GitHubProvider } = require('electron-updater/out/providers/GitHubProvider');
const { version } = require('../package.json');
async function verify() {
  assert.ok(!process.env.GH_TOKEN && !process.env.GITHUB_TOKEN, 'Verify public updates without credentials.');
  const provider = new GitHubProvider(
    { provider: 'github', owner: 'Ricoro', repo: 'LoadingListChecker', private: false },
    { allowPrerelease: false, channel: null },
    { executor: new NodeHttpExecutor(), platform: 'win32', isUseMultipleRangeRequest: false }
  );
  const info = await provider.getLatestVersion();
  assert.equal(info.version, version);
  const files = provider.resolveFiles(info);
  const installer = files.find(file => file.info.url === `Loading-List-Checker-Setup-${version}.exe`);
  assert.ok(installer, 'The public update feed must resolve the Windows installer asset.');
  const bytes = await fs.readFile(`dist/Loading-List-Checker-Setup-${version}.exe`);
  assert.equal(installer.info.size, bytes.length);
  assert.equal(installer.info.sha512, crypto.createHash('sha512').update(bytes).digest('base64'));
  console.log('Authenticated public update feed, installer asset and SHA-512 checksum verified.');
}
verify().catch(() => { console.error('Public release verification failed.'); process.exitCode = 1; });
