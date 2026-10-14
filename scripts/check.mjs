import { spawnSync } from 'node:child_process';

const steps = ['format:check', 'typecheck', 'lint', 'build', 'test'];

const results = steps.map((script) => {
  console.log(`\n▶ npm run ${script}\n`);
  const { status } = spawnSync('npm', ['run', script], { stdio: 'inherit', shell: true });
  return { label: script, passed: status === 0 };
});

console.log('\n— Resumen de npm run check —');
for (const { label, passed } of results) {
  console.log(`${passed ? '✔' : '✖'} ${label}`);
}

const failed = results.filter((result) => !result.passed);
if (failed.length > 0) {
  console.log(
    `\n${failed.length} de ${results.length} pasos fallaron: ${failed.map((f) => f.label).join(', ')}.`,
  );
  process.exit(1);
}
console.log(`\nLos ${results.length} pasos pasaron.`);
