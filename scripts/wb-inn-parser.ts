import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Page } from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';

// Включаем stealth режим
puppeteer.use(StealthPlugin());

// ============== НАСТРОЙКИ ==============
const CONFIG = {
  WORKERS: 1,
  DELAY_BETWEEN_REQUESTS: 4000, // Увеличил задержку
  PAGE_TIMEOUT: 30000,
  MAX_RETRIES: 2,
  INPUT_FILE: './data/sellers-input.csv',
  OUTPUT_FILE: './data/sellers-output.csv',
  PROGRESS_FILE: './data/parser-progress.json',
  COOKIES_FILE: './data/wb-cookies.json',
};

// ============== ТИПЫ ==============
interface SellerInput {
  sellerId: string;
}

interface SellerResult {
  sellerId: string;
  url: string;
  name: string | null;
  inn: string | null;
  ogrn: string | null;
  regNumber: string | null;
  fullName: string | null;
  status: 'success' | 'error' | 'blocked';
  error?: string;
  parsedAt: string;
}

interface Progress {
  processed: string[];
  lastUpdated: string;
}

// ============== УТИЛИТЫ ==============
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function extractSellerId(input: string): string {
  const match = input.match(/seller\/(\d+)/);
  return match ? match[1] : input.replace(/\D/g, '');
}

function parseCSV(content: string): SellerInput[] {
  const lines = content.trim().split('\n');
  const results: SellerInput[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.toLowerCase().startsWith('url') || trimmed.toLowerCase().startsWith('id')) {
      continue;
    }
    const sellerId = extractSellerId(trimmed.split(',')[0].split(';')[0]);
    if (sellerId) {
      results.push({ sellerId });
    }
  }
  return results;
}

function loadProgress(): Progress {
  try {
    if (fs.existsSync(CONFIG.PROGRESS_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG.PROGRESS_FILE, 'utf-8'));
    }
  } catch {
    console.log('⚠️  Не удалось загрузить прогресс');
  }
  return { processed: [], lastUpdated: new Date().toISOString() };
}

function saveProgress(progress: Progress): void {
  const dir = path.dirname(CONFIG.PROGRESS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  progress.lastUpdated = new Date().toISOString();
  fs.writeFileSync(CONFIG.PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

function appendToCSV(result: SellerResult): void {
  const dir = path.dirname(CONFIG.OUTPUT_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const fileExists = fs.existsSync(CONFIG.OUTPUT_FILE);
  const header = 'sellerId;url;name;inn;ogrn;regNumber;fullName;status;error;parsedAt\n';

  if (!fileExists) {
    fs.writeFileSync(CONFIG.OUTPUT_FILE, header);
  }

  const row = [
    result.sellerId,
    result.url,
    result.name || '',
    result.inn || '',
    result.ogrn || '',
    result.regNumber || '',
    result.fullName || '',
    result.status,
    result.error || '',
    result.parsedAt,
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(';') + '\n';

  fs.appendFileSync(CONFIG.OUTPUT_FILE, row);
}

async function saveCookies(page: Page): Promise<void> {
  const cookies = await page.cookies();
  fs.writeFileSync(CONFIG.COOKIES_FILE, JSON.stringify(cookies, null, 2));
}

async function loadCookies(page: Page): Promise<boolean> {
  try {
    if (fs.existsSync(CONFIG.COOKIES_FILE)) {
      const cookies = JSON.parse(fs.readFileSync(CONFIG.COOKIES_FILE, 'utf-8'));
      await page.setCookie(...cookies);
      console.log('🍪 Куки загружены');
      return true;
    }
  } catch {
    console.log('⚠️  Не удалось загрузить куки');
  }
  return false;
}

// ============== ПРОВЕРКА БЛОКИРОВКИ ==============
async function isBlocked(page: Page): Promise<boolean> {
  try {
    const content = await page.content();
    return content.includes('Подозрительная активность') ||
           content.includes('captcha') ||
           content.includes('Что-то не так');
  } catch {
    return true;
  }
}

async function waitForCaptchaSolved(page: Page, maxWaitMs = 300000): Promise<void> {
  console.log('⏳ Жду решения капчи (макс 5 минут)...');
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    await sleep(3000);

    if (!await isBlocked(page)) {
      console.log('✅ Капча пройдена!');
      return;
    }
  }

  throw new Error('Таймаут ожидания капчи');
}

// ============== ПАРСЕР ==============
async function parseSeller(page: Page, sellerId: string): Promise<SellerResult> {
  const url = `https://www.wildberries.ru/seller/${sellerId}`;
  const result: SellerResult = {
    sellerId,
    url,
    name: null,
    inn: null,
    ogrn: null,
    regNumber: null,
    fullName: null,
    status: 'success',
    parsedAt: new Date().toISOString(),
  };

  try {
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: CONFIG.PAGE_TIMEOUT
    });

    await sleep(2000);

    if (await isBlocked(page)) {
      result.status = 'blocked';
      result.error = 'Заблокировано WB';
      return result;
    }

    // Кликаем на кнопку информации
    try {
      await page.waitForSelector('.seller-details__tip-info', { timeout: 5000 });
      await page.click('.seller-details__tip-info');
      await sleep(1500);
    } catch {
      // Попробуем найти через evaluate
      await page.evaluate(() => {
        const btns = document.querySelectorAll('span, button, div');
        for (const btn of btns) {
          if (btn.className.includes('tip') || btn.className.includes('info')) {
            (btn as HTMLElement).click();
            break;
          }
        }
      });
      await sleep(1500);
    }

    // Извлекаем данные
    const data = await page.evaluate(() => {
      const bodyText = document.body.innerText;

      const innMatch = bodyText.match(/ИНН[:\s]*(\d{10,12})/);
      const ogrnMatch = bodyText.match(/ОГРН(?:ИП)?[:\s]*(\d{13,15})/);
      const regMatch = bodyText.match(/(?:Номер регистрации|Рег\.?\s*№?)[:\s]*(\d+)/i);

      let fullName = null;
      const ipMatch = bodyText.match(/(?:Индивидуальный предприниматель|ИП)\s+([А-ЯЁа-яё\s]+?)(?=\s*ОГРН|\s*ИНН|\n)/);
      const oooMatch = bodyText.match(/(?:ООО|ЗАО|ОАО|ПАО|АО)\s*[«"]?([^»"\n]+)/);
      if (ipMatch) fullName = ipMatch[0].trim();
      else if (oooMatch) fullName = oooMatch[0].trim();

      const titleEl = document.querySelector('.seller-details__title, h1');
      const name = titleEl?.textContent?.trim() || null;

      return { inn: innMatch?.[1] || null, ogrn: ogrnMatch?.[1] || null, regNumber: regMatch?.[1] || null, fullName, name };
    });

    Object.assign(result, data);

    if (!data.inn) {
      result.status = 'error';
      result.error = 'ИНН не найден';
    }

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    // Пробрасываем ошибку detached frame наружу для пересоздания страницы
    if (errMsg.includes('detached') || errMsg.includes('Frame')) {
      throw error;
    }
    result.status = 'error';
    result.error = errMsg;
  }

  return result;
}

// ============== ГЛАВНАЯ ФУНКЦИЯ ==============
async function main(): Promise<void> {
  console.log('🚀 Парсер Wildberries ИНН (Stealth Mode)');
  console.log('========================================\n');

  if (!fs.existsSync(CONFIG.INPUT_FILE)) {
    console.error(`❌ Файл не найден: ${CONFIG.INPUT_FILE}`);
    process.exit(1);
  }

  const inputContent = fs.readFileSync(CONFIG.INPUT_FILE, 'utf-8');
  const sellers = parseCSV(inputContent);
  const progress = loadProgress();
  const remaining = sellers.filter(s => !progress.processed.includes(s.sellerId));

  console.log(`📋 Всего продавцов: ${sellers.length}`);
  console.log(`✅ Уже обработано: ${progress.processed.length}`);
  console.log(`⏳ Осталось: ${remaining.length}\n`);

  if (remaining.length === 0) {
    console.log('🎉 Все продавцы уже обработаны!');
    return;
  }

  console.log('🌐 Запуск браузера (Stealth Mode)...\n');
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: [
      '--start-maximized',
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
      '--no-sandbox',
    ],
  });

  const page = await browser.newPage();

  // Дополнительная маскировка
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  await loadCookies(page);

  console.log('📍 Открываю тестовую страницу...');
  try {
    await page.goto('https://www.wildberries.ru/seller/' + remaining[0].sellerId, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
  } catch {
    console.log('⚠️  Таймаут, пробую ещё раз...');
    await sleep(5000);
    await page.goto('https://www.wildberries.ru/seller/' + remaining[0].sellerId, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
  }

  if (await isBlocked(page)) {
    console.log('\n⚠️  ОБНАРУЖЕНА БЛОКИРОВКА!');
    console.log('👆 Пройди капчу в браузере...\n');
    await waitForCaptchaSolved(page);
    await saveCookies(page);
    console.log('🍪 Куки сохранены\n');
  }

  console.log('🔄 Начинаю парсинг...\n');
  let success = 0;
  let errors = 0;
  let currentPage = page;

  for (let i = 0; i < remaining.length; i++) {
    const seller = remaining[i];

    // Проверка на блокировку каждые 50 запросов
    if (i > 0 && i % 50 === 0) {
      try {
        if (await isBlocked(currentPage)) {
          console.log('\n⚠️  Снова заблокировано! Пройди капчу...');
          await waitForCaptchaSolved(currentPage);
          await saveCookies(currentPage);
        }
      } catch {
        // Пересоздаём страницу
        console.log('🔄 Пересоздаю страницу...');
        try { await currentPage.close(); } catch {}
        currentPage = await browser.newPage();
        await currentPage.evaluateOnNewDocument(() => {
          Object.defineProperty(navigator, 'webdriver', { get: () => false });
        });
        await loadCookies(currentPage);
      }
    }

    let result: SellerResult;
    try {
      result = await parseSeller(currentPage, seller.sellerId);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);

      // При критических ошибках - завершаем (можно перезапустить)
      if (errMsg.includes('Connection closed') || errMsg.includes('Target closed')) {
        console.log('\n💥 Браузер закрылся. Перезапусти скрипт (прогресс сохранён)');
        process.exit(1);
      }

      // Остальные ошибки - пропускаем
      result = {
        sellerId: seller.sellerId,
        url: `https://www.wildberries.ru/seller/${seller.sellerId}`,
        name: null, inn: null, ogrn: null, regNumber: null, fullName: null,
        status: 'error',
        error: errMsg,
        parsedAt: new Date().toISOString(),
      };
    }

    if (result.status === 'blocked') {
      console.log(`🚫 [${i + 1}/${remaining.length}] ${seller.sellerId}: ЗАБЛОКИРОВАНО`);
      console.log('👆 Пройди капчу в браузере...');
      await waitForCaptchaSolved(currentPage);
      await saveCookies(currentPage);
      i--;
      continue;
    }

    appendToCSV(result);
    progress.processed.push(seller.sellerId);
    saveProgress(progress);

    if (result.inn) {
      success++;
      console.log(`✅ [${i + 1}/${remaining.length}] ${seller.sellerId}: ИНН=${result.inn}`);
    } else {
      errors++;
      console.log(`❌ [${i + 1}/${remaining.length}] ${seller.sellerId}: ${result.error}`);
    }

    await sleep(CONFIG.DELAY_BETWEEN_REQUESTS);
  }

  await browser.close();

  console.log('\n========================================');
  console.log('🎉 Парсинг завершён!');
  console.log(`✅ Успешно: ${success}`);
  console.log(`❌ Ошибки: ${errors}`);
  console.log(`📄 Результаты: ${CONFIG.OUTPUT_FILE}`);
}

main().catch(console.error);
