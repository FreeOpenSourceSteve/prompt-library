import { readFile, writeFile } from 'node:fs/promises';

const notices = ['Third-party software bundled with Prompt Library.\n'];
for (const name of ['react', 'react-dom', 'scheduler']) {
  const directory = new URL(`../node_modules/${name}/`, import.meta.url);
  const { version } = JSON.parse(
    await readFile(new URL('package.json', directory), 'utf8'),
  );
  const license = await readFile(new URL('LICENSE', directory), 'utf8');
  notices.push(`${name} ${version}\n${'='.repeat(60)}\n${license}`);
}
await writeFile(
  new URL('../public/THIRD_PARTY_NOTICES.txt', import.meta.url),
  notices.join('\n\n'),
);
console.log('Updated bundled third-party license notices.');
