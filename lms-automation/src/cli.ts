import { launchAndLogin } from './login';
import { createLessonsAndCall } from './flows/createLessonsAndCall';

function printUsage() {
  console.log(`
Uso:
  npm run cli -- create-lessons

Descrição:
  Cria 5 aulas por bimestre para todas as turmas e matérias.
`);
}

async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];

  switch (cmd) {
    case 'create-lessons': {
      console.log('▶️ Executando create-lessons');
      const { browser, page } = await launchAndLogin();
      await createLessonsAndCall(page);
      console.log('🎉 Fluxo concluído.');
      break;
    }

    default:
      printUsage();
      process.exit(1);
  }

  // await browser.close(); // opcional
}

main();
