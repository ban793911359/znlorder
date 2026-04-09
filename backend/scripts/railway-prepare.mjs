import { spawnSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

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
  const prisma = new PrismaClient();

  try {
    const userCount = await prisma.user.count();

    if (userCount === 0) {
      console.log('AUTO_SEED_ON_BOOT=true and database is empty, running prisma seed...');
      run('node', ['./node_modules/tsx/dist/cli.mjs', 'prisma/seed.ts']);
    } else {
      console.log(
        `AUTO_SEED_ON_BOOT=true but database already has ${userCount} users, skipping prisma seed.`,
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}
