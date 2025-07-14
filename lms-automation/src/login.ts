import 'dotenv/config';
import puppeteer, { Browser, Page } from 'puppeteer';

export interface BrowserPage {
  browser: Browser;
  page: Page;
}

/**
 * Inicia o Puppeteer, faz login como admin e retorna browser + page.
 */
export async function launchAndLogin(): Promise<BrowserPage> {
  console.log('▶️ Iniciando login...');
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
  });

  const page: Page = await browser.newPage();
  await page.goto(process.env.LMS_URL!, { waitUntil: 'networkidle2' });

  // Lista inputs para verificar seletores
  await page.waitForSelector('form');
  const inputs = await page.$$eval('input', els =>
    els.map(el => ({
      type: el.getAttribute('type'),
      id: el.id,
      name: el.getAttribute('name'),
      placeholder: el.getAttribute('placeholder'),
    }))
  );
  console.log('🔍 inputs:', inputs);

  // Preenche credenciais
  await page.waitForSelector('input[placeholder="Login"]');
  await page.type('input[placeholder="Login"]', process.env.ADMIN_USER!);
  await page.waitForSelector('input[placeholder="Senha"]');
  await page.type('input[placeholder="Senha"]', process.env.ADMIN_PASS!);

  // Submete e aguarda navegação
  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForNavigation({ waitUntil: 'networkidle2' }),
  ]);

  console.log('✅ Logado com sucesso!');
  return { browser, page };
}

// Permite execução standalone
if (require.main === module) {
  launchAndLogin().catch(err => {
    console.error('❌ Erro no login standalone:', err);
    process.exit(1);
  });
}