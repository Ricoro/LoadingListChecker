// Run only in the release workflow with a scoped GitHub Actions token.
// No token or authenticated request details are printed or saved.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const crypto = require('node:crypto');
const { NodeHttpExecutor } = require('builder-util/out/nodeHttpExecutor');
const { PrivateGitHubProvider } = require('electron-updater/out/providers/PrivateGitHubProvider');
const { version } = require('../package.json');
async function verify() {
  assert.ok(process.env.GH_TOKEN, 'Release verification requires GitHub authentication.');
  const provider = new PrivateGitHubProvider(
    { provider: 'github', owner: 'Ricoro', repo: 'LoadingListChecker', private: true },
    { allowPrerelease: false }, process.env.GH_TOKEN,
    { executor: new NodeHttpExecutor(), platform: 'win32', isUseMultipleRangeRequest: false }
  );
  const info = await provider.getLatestVersion();
  assert.equal(info.version, version);
  const files = provider.resolveFiles(info);
  const installer = files.find(file => file.info.url === `Loading-List-Checker-Setup-${version}.exe`);
  assert.ok(installer, 'The private update feed must resolve the Windows installer asset.');
  const bytes = await fs.readFile(`dist/Loading-List-Checker-Setup-${version}.exe`);
  assert.equal(installer.info.size, bytes.length);
  assert.equal(installer.info.sha512, crypto.createHash('sha512').update(bytes).digest('base64'));
  console.log('Authenticated private update feed, installer asset and SHA-512 checksum verified.');
}
verify().catch(() => { console.error('Private release verification failed. No authentication details have been logged.'); process.exitCode = 1; });
