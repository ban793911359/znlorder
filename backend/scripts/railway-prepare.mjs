import { spawnSync } from 'node:child_process';

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: false,
    env: process.env,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run('node', ['./node_modules/prisma/build/index.js', 'migrate', 'deploy']);

if (String(process.env.AUTO_SEED_ON_BOOT || '').toLowerCase() === 'true') {
  console.log('AUTO_SEED_ON_BOOT=true, running prisma seed...');
  run('node', ['./node_modules/tsx/dist/cli.mjs', 'prisma/seed.ts']);
}
