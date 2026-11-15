import { mkdir, cp } from 'node:fs/promises';
await mkdir('dist', { recursive: true });
for (const file of ['index.html', 'style.css', 'src']) await cp(file, `dist/${file}`, { recursive: true });
await mkdir('dist/assets', { recursive: true });
for (const file of ['park.png', 'sparrow.png', 'pigeon.png', 'commentator.png']) await cp(`assets/${file}`, `dist/assets/${file}`);
console.log('Static game built in dist/');
