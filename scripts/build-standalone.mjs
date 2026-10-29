// Builds a double-clickable copy of the exam into ./standalone (no dev server needed).
// Usage: npm run build:standalone   — then open standalone/index.html in a browser.
import { build } from 'esbuild';
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'standalone');

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

await build({
  entryPoints: [resolve(root, 'src/main.tsx')],
  outfile: resolve(out, 'app.js'),
  bundle: true,
  minify: true,
  format: 'iife',
  target: 'es2020',
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  loader: { '.json': 'json' },
  logLevel: 'info',
});

cpSync(resolve(root, 'public/images'), resolve(out, 'images'), { recursive: true });

writeFileSync(
  resolve(out, 'index.html'),
  `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>FortiOS 7.6 Administrator — Randomized Practice Exam</title>
    <link rel="stylesheet" href="app.css" />
  </head>
  <body>
    <div id="root"></div>
    <script src="app.js"></script>
  </body>
</html>
`,
);
console.log('Standalone build written to', out);
