import puppeteer from 'puppeteer';
import * as fs from 'fs';

async function debug() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });

  console.log('Открываю страницу продавца...');
  await page.goto('https://www.wildberries.ru/seller/1000513', {
    waitUntil: 'networkidle2',
    timeout: 30000,
  });

  await new Promise(r => setTimeout(r, 3000));

  // Скриншот ДО клика
  await page.screenshot({ path: './data/debug-before-click.png' });
  console.log('✅ Скриншот ДО клика сохранён');

  // Ищем кнопку
  const btn = await page.$('.seller-details__tip-info');
  if (btn) {
    console.log('✅ Кнопка .seller-details__tip-info найдена, кликаю...');
    await btn.click();
    await new Promise(r => setTimeout(r, 2000));
  } else {
    console.log('❌ Кнопка .seller-details__tip-info НЕ найдена');

    // Ищем альтернативные элементы
    const alternatives = await page.evaluate(() => {
      const results: string[] = [];
      document.querySelectorAll('[class*="tip"], [class*="info"], [class*="detail"]').forEach(el => {
        results.push(`${el.tagName}.${el.className}`);
      });
      return results.slice(0, 15);
    });
    console.log('Альтернативные элементы:', alternatives);
  }

  // Скриншот ПОСЛЕ клика
  await page.screenshot({ path: './data/debug-after-click.png' });
  console.log('✅ Скриншот ПОСЛЕ клика сохранён');

  // Сохраняем текст страницы
  const bodyText = await page.evaluate(() => document.body.innerText);
  fs.writeFileSync('./data/debug-body-text.txt', bodyText);
  console.log('✅ Текст страницы сохранён в debug-body-text.txt');

  // Ищем ИНН в тексте
  const innMatch = bodyText.match(/ИНН[:\s]*(\d{10,12})/);
  if (innMatch) {
    console.log(`\n🎉 ИНН найден: ${innMatch[1]}`);
  } else {
    console.log('\n❌ ИНН не найден в тексте страницы');

    // Проверим есть ли слово ИНН вообще
    if (bodyText.includes('ИНН')) {
      console.log('   Но слово "ИНН" присутствует на странице');
      const context = bodyText.substring(bodyText.indexOf('ИНН') - 20, bodyText.indexOf('ИНН') + 50);
      console.log(`   Контекст: ...${context}...`);
    }
  }

  console.log('\n✅ Отладка завершена');
  await browser.close();
}

debug().catch(console.error);
