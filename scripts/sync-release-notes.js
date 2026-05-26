const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const changelogPath = path.join(process.cwd(), 'CHANGELOG.md');
const changelog = fs.readFileSync(changelogPath, 'utf8');
const dryRun = process.argv.includes('--dry-run');

const sections = [];
const headingRegex = /^#\s+([0-9][^\s]*)\s+\(([^)]+)\)\s*$/gm;
const matches = [...changelog.matchAll(headingRegex)];

for (let index = 0; index < matches.length; index++) {
  const match = matches[index];
  const next = matches[index + 1];
  const version = match[1];
  const tag = `v${version}`;
  const bodyStart = match.index + match[0].length;
  const bodyEnd = next ? next.index : changelog.length;
  const body = changelog.slice(bodyStart, bodyEnd).trim();

  if (body) {
    sections.push({ tag, body });
  }
}

if (sections.length === 0) {
  throw new Error('No changelog sections found.');
}

console.log(`Found ${sections.length} changelog sections.`);

for (const section of sections) {
  if (dryRun) {
    console.log(`Would sync ${section.tag} (${section.body.length} chars)`);
    continue;
  }

  try {
    execFileSync('gh', ['release', 'view', section.tag], {
      stdio: 'ignore',
    });
  } catch {
    console.log(`Skipping ${section.tag}: release does not exist.`);
    continue;
  }

  const notesPath = path.join(
    os.tmpdir(),
    `agregarr-release-notes-${section.tag}.md`
  );

  fs.writeFileSync(notesPath, section.body);

  execFileSync(
    'gh',
    ['release', 'edit', section.tag, '--notes-file', notesPath],
    {
      stdio: 'inherit',
    }
  );

  console.log(`Synced ${section.tag}.`);
}
