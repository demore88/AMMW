// Builds the whole game into dist/: one self-contained index.html plus the home-screen app files.
import * as esbuild from 'esbuild'; import fs from 'fs';
const r = await esbuild.build({ entryPoints: ['src/main.js'], bundle: true, minify: true, format: 'iife', write: false, target: 'es2020' });
const js = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const html = fs.readFileSync('src/index.html', 'utf8').replace('<script>/*BUNDLE*/</script>', () => '<script>' + js + '</script>');
fs.mkdirSync('dist', { recursive: true }); fs.writeFileSync('dist/index.html', html);
for (const f of fs.readdirSync('public')) fs.copyFileSync('public/' + f, 'dist/' + f);
console.log('built', (html.length / 1024 | 0) + 'KB');
