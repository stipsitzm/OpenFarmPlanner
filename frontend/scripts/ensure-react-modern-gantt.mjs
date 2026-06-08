import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const packageDir = join(process.cwd(), 'node_modules', 'react-modern-gantt');
const requiredArtifacts = [
  'dist/index.esm.js',
  'dist/index.js',
  'dist/index.css',
  'dist/index.d.ts',
];

const run = (command, args) => {
  const result = spawnSync(command, args, {
    cwd: packageDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      npm_config_audit: 'false',
      npm_config_fund: 'false',
      npm_config_ignore_scripts: 'true',
    },
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

if (!existsSync(packageDir)) {
  console.error('react-modern-gantt is not installed. Run npm ci before building the frontend.');
  process.exit(1);
}

const hasAllArtifacts = requiredArtifacts.every((artifact) => existsSync(join(packageDir, artifact)));

if (hasAllArtifacts) {
  console.log('react-modern-gantt build artifacts already exist; skipping rebuild.');
  process.exit(0);
}

console.log('react-modern-gantt build artifacts are missing; installing package build dependencies.');
run('npm', ['ci', '--no-audit', '--no-fund', '--ignore-scripts']);

console.log('Building react-modern-gantt.');
run('npm', ['run', 'build']);

const missingArtifacts = requiredArtifacts.filter((artifact) => !existsSync(join(packageDir, artifact)));

if (missingArtifacts.length > 0) {
  console.error(`react-modern-gantt build did not produce: ${missingArtifacts.join(', ')}`);
  process.exit(1);
}
