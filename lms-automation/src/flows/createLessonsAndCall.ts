// src/flows/createLessonsAndCall.ts
import { Page, ElementHandle } from 'puppeteer';

interface Bimestre {
    name: string;
    start: string; // YYYY-MM-DD
    end: string; // YYYY-MM-DD
}

const bimestres: Bimestre[] = [
    { name: '1º Bimestre', start: '2025-02-03', end: '2025-04-11' },
    { name: '2º Bimestre', start: '2025-04-14', end: '2025-07-11' },
    { name: '3º Bimestre', start: '2025-08-04', end: '2025-10-10' },
    { name: '4º Bimestre', start: '2025-10-13', end: '2025-12-12' },
];

function generateDates(start: string, end: string): string[] {
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    const step = (e - s) / 4;
    return Array.from({ length: 5 }, (_, i) => {
        const dt = new Date(s + step * i);
        return [
            String(dt.getDate()).padStart(2, '0'),
            String(dt.getMonth() + 1).padStart(2, '0'),
            dt.getFullYear(),
        ].join('/');
    });
}

async function takeAttendance(page: Page): Promise<void> {
    await page.waitForSelector('button#fazerChamada');
    await Promise.all([
        page.click('button#fazerChamada'),
        page.waitForNavigation({ waitUntil: 'networkidle2' }),
    ]);
    await page.$$eval('input[type="checkbox"].presenca', boxes =>
        (boxes as HTMLInputElement[]).forEach(cb => cb.checked || cb.click())
    );
    await Promise.all([
        page.click('button#salvarChamada'),
        page.waitForNavigation({ waitUntil: 'networkidle2' }),
    ]);
    console.log('      📋 Chamada registrada');
}

export async function createLessonsAndCall(page: Page): Promise<void> {
    const origin = new URL(process.env.LMS_URL!).origin;

    for (let turmaId = 1; ; turmaId++) {
        console.log(`▶️ Acessando turma ${turmaId}`);
        await page.goto(`${origin}/gestor/${turmaId}/visualizar`, { waitUntil: 'networkidle2' });

        // 1) Seleciona a matéria
        let [matHandle] = await page.$x(
            "//label[contains(normalize-space(.),'Matéria')]/following-sibling::select[1]"
        );
        if (!matHandle) break;
        const materias = (await (matHandle as ElementHandle<HTMLSelectElement>)
            .evaluate(el => Array.from(el.options).map(o => ({ value: o.value, text: o.text.trim() }))))
            .slice(1);
        if (!materias.length) continue;

        for (const materia of materias) {
            console.log(`   ▶️ Matéria: ${materia.text}`);
            [matHandle] = await page.$x(
                "//label[contains(normalize-space(.),'Matéria')]/following-sibling::select[1]"
            );
            await page.evaluate((sel, v) => {
                (sel as HTMLSelectElement).value = v;
                sel.dispatchEvent(new Event('change', { bubbles: true }));
            }, matHandle, materia.value);

            // 2) Clica em Ver Diário
            await page.waitForXPath("//button[normalize-space()='Ver Diário']", { visible: true });
            const [btnVer] = await page.$x("//button[normalize-space()='Ver Diário']");
            await Promise.all([
                (btnVer as ElementHandle<Element>).click(),
                page.waitForNavigation({ waitUntil: 'networkidle2' }),
            ]);

            // 3) Para cada bimestre...
            for (const bim of bimestres) {
                console.log(`      🔄 ${bim.name}`);

                // ——— Aqui selecionamos o Período geral ———
                await page.waitForXPath(
                    "//label[contains(normalize-space(.),'Período')]/following-sibling::select[1]",
                    { visible: true }
                );
                const [perHandle] = await page.$x(
                    "//label[contains(normalize-space(.),'Período')]/following-sibling::select[1]"
                );
                const perValue = String(bimestres.indexOf(bim) + 1);  // "1", "2", "3" ou "4"
                await page.evaluate((sel, v) => {
                    (sel as HTMLSelectElement).value = v;
                    sel.dispatchEvent(new Event('change', { bubbles: true }));
                }, perHandle, perValue);

                // gera as 5 datas
                const dates = generateDates(bim.start, bim.end);
                for (let i = 0; i < dates.length; i++) {
                    const brDate = dates[i];
                    console.log(`         ▶️ Aula ${i + 1}/5 em ${brDate}`);

                    // abre o form de cadastro
                    await page.waitForXPath("//button[normalize-space()='+ Cadastrar Aula']", { visible: true });
                    const [btnAdd] = await page.$x("//button[normalize-space()='+ Cadastrar Aula']");
                    await (btnAdd as ElementHandle<Element>).click();

                    // preenche data
                    await page.waitForSelector('input[type="date"]', { visible: true });
                    const inp = (await page.$('input[type="date"]')) as ElementHandle<HTMLInputElement>;
                    await inp.click({ clickCount: 3 });
                    await inp.type(brDate);

                    // ——— Seleciona de novo o mesmo Período dentro do formulário ———
                    await page.waitForXPath(
                        "//label[contains(normalize-space(.),'Período')]/following-sibling::select[1]",
                        { visible: true }
                    );
                    const [innerPer] = await page.$x(
                        "//label[contains(normalize-space(.),'Período')]/following-sibling::select[1]"
                    );
                    await page.evaluate((sel, v) => {
                        (sel as HTMLSelectElement).value = v;
                        sel.dispatchEvent(new Event('change', { bubbles: true }));
                    }, innerPer, perValue);

                    // preenche descrição
                    await page.waitForXPath(
                        "//label[normalize-space()='Descrição']/following-sibling::textarea[1]",
                        { visible: true }
                    );
                    const [ta] = await page.$x(
                        "//label[normalize-space()='Descrição']/following-sibling::textarea[1]"
                    );
                    const descrs = [
                        'Introdução aos conceitos',
                        'Exercícios práticos',
                        'Discussão de casos',
                        'Resolução de problemas',
                        'Revisão teórica',
                    ];
                    await (ta as ElementHandle<HTMLTextAreaElement>).click();
                    await page.evaluate((el, txt) => {
                        (el as HTMLTextAreaElement).value = txt;
                        el.dispatchEvent(new Event('input', { bubbles: true }));
                    }, ta, `${descrs[Math.floor(Math.random() * descrs.length)]} de ${materia.text} em ${brDate}`);

                    // salva e aguarda navegação
                    await page.waitForXPath("//button[normalize-space()='Salvar Aula']", { visible: true });
                    const [bs] = await page.$x("//button[normalize-space()='Salvar Aula']");
                    await Promise.all([
                        (bs as ElementHandle<Element>).click(),
                        page.waitForNavigation({ waitUntil: 'networkidle2' }),
                    ]);
                    console.log(`            ✅ Aula salva: ${brDate}`);

                    // registra chamada
                    await takeAttendance(page);
                }
            }

            // volta ao menu
            const [back] = await page.$x("//button[normalize-space()='Voltar Diário']");
            if (back) {
                await Promise.all([
                    (back as ElementHandle<Element>).click(),
                    page.waitForNavigation({ waitUntil: 'networkidle2' }),
                ]);
            }
        }
    }
}
