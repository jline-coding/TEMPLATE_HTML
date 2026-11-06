import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { copyFileSync, existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const flags = vi.hoisted(() => ({ dip: true, po: 'op611432', watch: false, php: false }));

vi.mock('../scripts/tools/config.js', async importOriginal => {
  const config = await importOriginal();
  const { mkdtempSync } = await import('node:fs');
  const { resolve } = await import('node:path');
  const sandbox = mkdtempSync(resolve(config.ROOT, 'test-sandbox-dip-snippets-'));
  return {
    ...config,
    ROOT: sandbox,
    DIST: resolve(sandbox, 'public'),
    PAGES_DIR: resolve(sandbox, 'src/pages'),
    INCLUDE_DIRS: { components: resolve(sandbox, 'src/components') },
    refreshIncludeDirs: () => {},
    SITE_URL: 'https://unchanged.example.test',
    get DIP() { return flags.dip; },
    get DIP_PO() { return flags.po; },
    get isWatch() { return flags.watch; },
    get OUTPUT_EXT() { return flags.php ? '.php' : '.html'; },
    get USE_PHP_INCLUDE() { return flags.php; },
    get PAGE_OUT_PREFIXES() { return flags.dip && flags.po ? [`pc/${flags.po}`, `sp/${flags.po}`] : ['']; }
  };
});

import { buildEjs } from '../scripts/builders/ejs.js';
import { loadDipSnippets, injectDipSnippets } from '../scripts/tools/dip-snippets.js';
import { DIST, INCLUDE_DIRS, PAGES_DIR, ROOT, LAYOUTS_DIR } from '../scripts/tools/config.js';
import { safeRmDirSync } from '../scripts/tools/safety.js';

const configPath = resolve(ROOT, 'dip-config.js');
const projectRoot = resolve(LAYOUTS_DIR, '../..');
const snippets = {
  pc: {
    bodyStart: String.raw`<!-- PC: keep EXACT spacing -->
<noscript>
<iframe src="./assets/client-only.html?id=GTM-N5QJZZ"
height="0" width="0" style="display:none;visibility:hidden"></iframe>
</noscript>
<script>var value = '$& $$ $\' $\x60'; var pattern = /\d+\s/; /* <%= untouched %> */</script>`,
    bodyEnd: '<script>  var analyticsData = { "eVar32" : "PC", "channel": "静的_企業ページ(ASP)" };\r\n</script>'
  },
  sp: {
    bodyStart: '<!-- SP start -->\n<script>const id="GTM-TGL7LM";</script>',
    bodyEnd: '<script>var analyticsData = {"eVar32":"SP"};</script>\n<!-- SP end -->'
  }
};

function saveConfig(value = snippets) {
  writeFileSync(configPath, `export default ${JSON.stringify(value)};`, 'utf8');
}

function readOutput(target, page = 'index.html') {
  const prefix = flags.dip && flags.po ? `${target}/${flags.po}` : '';
  return readFileSync(resolve(DIST, prefix, page), 'utf8');
}

beforeEach(() => {
  flags.dip = true;
  flags.po = 'op611432';
  flags.watch = false;
  flags.php = false;
  if (existsSync(configPath)) unlinkSync(configPath);
  mkdirSync(resolve(PAGES_DIR, 'about'), { recursive: true });
  mkdirSync(INCLUDE_DIRS.components, { recursive: true });
  for (const name of ['header', 'footer']) {
    copyFileSync(resolve(projectRoot, `src/components/_${name}.ejs`), resolve(INCLUDE_DIRS.components, `_${name}.ejs`));
  }
  const page = '---\ntitle: Unchanged title\ndescription: Unchanged description\n---\n<main><%- includeComponent("sample") %></main>';
  writeFileSync(resolve(INCLUDE_DIRS.components, '_sample.ejs'), '<p>Original component</p>');
  writeFileSync(resolve(PAGES_DIR, 'index.ejs'), page);
  writeFileSync(resolve(PAGES_DIR, 'about/index.ejs'), page);
});

afterAll(() => {
  if (existsSync(ROOT)) safeRmDirSync(ROOT, projectRoot);
});

describe('DIP raw snippets', () => {
  it('inserts the exact configured strings on every PC/SP page after formatting and path rewriting', async () => {
    await buildEjs();
    const original = {};
    for (const device of ['pc', 'sp']) {
      for (const page of ['index.html', 'about/index.html']) original[`${device}/${page}`] = readOutput(device, page);
    }
    saveConfig();
    await buildEjs();
    for (const device of ['pc', 'sp']) {
      for (const page of ['index.html', 'about/index.html']) {
        const html = readOutput(device, page);
        const { bodyStart, bodyEnd } = snippets[device];
        expect(html).toContain(`<body>\n${bodyStart}\n`);
        expect(html).toContain(`\n${bodyEnd}\n</body>`);
        expect(html.split(bodyStart)).toHaveLength(2);
        expect(html.split(bodyEnd)).toHaveLength(2);
        expect(html).not.toContain(snippets[device === 'pc' ? 'sp' : 'pc'].bodyStart);
        const withoutSnippets = html.replace('\n' + bodyStart + '\n', '').replace('\n' + bodyEnd + '\n', '');
        expect(withoutSnippets).toBe(original[`${device}/${page}`]);
      }
    }
  });

  it('does not import even an invalid config when DIP is false', async () => {
    flags.dip = false;
    await buildEjs();
    const original = readOutput('pc');
    writeFileSync(configPath, 'throw new Error("Must never be imported when DIP=false");');
    await buildEjs();
    expect(readOutput('pc')).toBe(original);
    expect(original).toContain('href="./assets/css/common.css"');
    expect(original).toContain('href="https://unchanged.example.test/"');
  });

  it('leaves the original unsplit DIP flow unchanged without DIP_PO', async () => {
    flags.po = '';
    await buildEjs();
    const original = readOutput('pc');
    writeFileSync(configPath, 'not valid JavaScript !!!');
    await buildEjs();
    expect(readOutput('pc')).toBe(original);
  });

  it('keeps the old output for missing config, missing fields and empty strings', async () => {
    await buildEjs();
    const original = readOutput('pc');
    for (const config of [{}, { pc: { bodyStart: '', bodyEnd: '' }, sp: {} }]) {
      saveConfig(config);
      await buildEjs();
      expect(readOutput('pc')).toBe(original);
      expect(readOutput('sp')).toBe(original);
    }
  });

  it('reloads edited config and removes snippets when the config is deleted', async () => {
    saveConfig({ pc: { bodyStart: '<!-- first -->' } });
    await buildEjs();
    expect(readOutput('pc')).toContain('<!-- first -->');
    saveConfig({ pc: { bodyStart: '<!-- second -->' } });
    await buildEjs();
    expect(readOutput('pc')).toContain('<!-- second -->');
    expect(readOutput('pc')).not.toContain('<!-- first -->');
    unlinkSync(configPath);
    await buildEjs();
    expect(readOutput('pc')).not.toContain('<!-- second -->');
  });

  it('preserves snippets during incremental watch builds and PHP formatting/includes', async () => {
    saveConfig();
    flags.watch = true;
    await buildEjs(resolve(PAGES_DIR, 'index.ejs'));
    expect(readOutput('pc')).toContain(snippets.pc.bodyStart);
    expect(readOutput('sp')).toContain(snippets.sp.bodyEnd);
    flags.watch = false;
    flags.php = true;
    await buildEjs();
    expect(readOutput('pc', 'index.php')).toContain(snippets.pc.bodyStart);
    expect(readOutput('sp', 'about/index.php')).toContain(snippets.sp.bodyEnd);
    expect(readOutput('pc', 'index.php')).toContain("components/header.php");
  });

  it('accepts editable multiline backtick config and keeps PC/SP values independent', async () => {
    const pcStart = '<!-- PC raw -->\n<iframe src="//client.example/pc"\nheight="0"></iframe>';
    const spStart = '<!-- SP raw -->\n<script>var device="SP";</script>';
    writeFileSync(configPath, `export default {
      pc: { bodyStart: \`${pcStart}\`, bodyEnd: "" },
      sp: { bodyStart: \`${spStart}\`, bodyEnd: "" }
    };`);
    const config = await loadDipSnippets(configPath);
    expect(config.pc.bodyStart).toBe(pcStart);
    expect(config.sp.bodyStart).toBe(spStart);
    await buildEjs();
    expect(readOutput('pc')).toContain(config.pc.bodyStart);
    expect(readOutput('sp')).toContain(config.sp.bodyStart);
  });

  it('reports invalid config instead of writing malformed snippets', async () => {
    for (const config of [null, [], { pc: [] }, { sp: null }, { pc: { bodyStart: 123 } }]) {
      saveConfig(config);
      await expect(buildEjs()).rejects.toThrow('[dip] Cannot load');
    }
    writeFileSync(configPath, 'export default { pc: { bodyStart: `unclosed');
    await expect(buildEjs()).rejects.toThrow('[dip] Cannot load');
  });

  it('finds the real body tags despite comments, PHP, script strings and quoted attributes', () => {
    const html = `<!-- <body> --><?php $fake = '<body>'; ?><html><head>
<script>var fake = '<body data-x="fake"></body>';</script>
<style>.x::before { content: '<body>'; }</style></head>
<body-custom></body-custom><div data-fake="<body>"></div>
<body class="page" data-arrow=">">main<textarea><body></body></textarea></body></html>`;
    const config = { pc: { bodyStart: 'START', bodyEnd: 'END' } };
    const result = injectDipSnippets(html, 'pc/op611432', config);
    expect(result).toContain('<body class="page" data-arrow=">">\nSTART\nmain');
    expect(result).toContain('<textarea><body></body></textarea>\nEND\n</body></html>');
  });

  it('does not alter fragments without snippets and reports missing required body tags', () => {
    expect(injectDipSnippets('<main>fragment</main>', 'pc/op611432', { pc: {} })).toBe('<main>fragment</main>');
    expect(injectDipSnippets('<body>original</body>', 'other', snippets)).toBe('<body>original</body>');
    expect(() => injectDipSnippets('<main>fragment</main>', 'pc/op611432', snippets)).toThrow('required <body> or </body>');
  });
});
