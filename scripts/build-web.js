const fs = require('node:fs/promises');
const path = require('node:path');
const esbuild = require('esbuild');
async function build() {
  const output = path.resolve('dist/web');
  await fs.mkdir(output, { recursive: true });
  const result = await esbuild.build({ entryPoints: ['web/browser.js'], bundle: true, minify: true, platform: 'browser', target: ['chrome110', 'edge110', 'firefox115'], outdir: output, entryNames: 'portal-[hash]', metafile: true, legalComments: 'linked' });
  const script = Object.entries(result.metafile.outputs).find(([, item]) => item.entryPoint)?.[0];
  let html = await fs.readFile('src/index.html', 'utf8');
  html = html.replace('default-src \'self\'; script-src \'self\'; style-src \'self\'', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'");
  html = html.replace('VESSEL OPERATIONS', 'VESSEL OPERATIONS · BROWSER DEMO');
  html = html.replace('</header>', '<section class="portal-intro"><p>Use this page independently on any PC with a modern browser. Your files are read locally and are not uploaded or saved on a server. Closing or refreshing the page clears the current comparison.</p><button id="try-sample">Try sample lists</button><p class="sample-note">Sample lists are fictional. You can also import your own Excel files.</p></section></header>');
  html = html.replace('<script src="renderer.js"></script>', `<script src="${path.basename(script)}"></script>`);
  await fs.writeFile(path.join(output, 'index.html'), html);
  await fs.writeFile(path.join(output, 'style.css'), (await fs.readFile('src/style.css', 'utf8')) + '\n.portal-intro{margin-top:22px;padding:16px 20px;background:#edf4f6;border:1px solid #d3e2e8;border-radius:10px}.portal-intro p{margin:0 0 12px}.portal-intro .sample-note{font-size:12px;margin:10px 0 0}\n');
  await fs.writeFile(path.join(output, '.nojekyll'), '');
  console.log('Browser portal built in dist/web.');
}
build().catch(error => { console.error(error); process.exitCode = 1; });
