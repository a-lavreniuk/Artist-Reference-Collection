#!/usr/bin/env node
/**
 * Creates GitHub labels for beta feedback (requires gh CLI authenticated).
 * Usage: node scripts/setup-beta-feedback-labels.mjs [--repo owner/name]
 */

const DEFAULT_REPO = 'a-lavreniuk/Artist-Reference-Collection';

const LABELS = [
  { name: 'beta-feedback', color: '7057ff', description: 'Обратная связь от бэта-тестеров' },
  { name: 'from-app', color: '0e8a16', description: 'Отправлено из приложения ARC' },
  { name: 'type:bug', color: 'd73a4a', description: 'Баг / поломка' },
  { name: 'type:ui', color: 'fbca04', description: 'Визуальная неточность' },
  { name: 'type:ux', color: '0075ca', description: 'UX / непонятно' },
  { name: 'type:performance', color: 'e99695', description: 'Производительность' },
  { name: 'type:feature', color: 'a2eeef', description: 'Идея / пожелание' },
  { name: 'type:content', color: 'cfd3d7', description: 'Тексты / локализация' }
];

async function main() {
  const repoArg = process.argv.find((a) => a.startsWith('--repo='));
  const repo = repoArg ? repoArg.slice('--repo='.length) : DEFAULT_REPO;
  const { spawnSync } = await import('node:child_process');

  console.log(`Creating labels in ${repo}…`);

  for (const label of LABELS) {
    const args = [
      'label',
      'create',
      label.name,
      '--repo',
      repo,
      '--color',
      label.color,
      '--description',
      label.description,
      '--force'
    ];
    const result = spawnSync('gh', args, {
      encoding: 'utf8',
      shell: false,
      windowsHide: true
    });
    if (result.status === 0) {
      console.log(`  ✓ ${label.name}`);
    } else {
      console.warn(`  ✗ ${label.name}: ${result.stderr?.trim() || result.stdout?.trim() || 'failed'}`);
    }
  }

  console.log('\nDone. Create a GitHub Project board manually (see scripts/feedback-proxy/README.md).');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
