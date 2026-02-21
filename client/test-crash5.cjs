const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('PAGE ERROR LOG:', msg.text());
    }
  });
  page.on('pageerror', err => console.log('PAGE UNCAUGHT ERROR:', err.toString()));

  await page.goto('http://localhost:5173/login', { waitUntil: 'domcontentloaded' });
  
  const email = 'karan9302451907@gmail.com';
  const password = 'karanpassword123';
  
  await page.type('input[type="email"]', email);
  await page.type('input[type="password"]', password);
  await page.click('button[type="submit"]');
  
  console.log('Waiting for nav...');
  await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 5000 }).catch(e => console.log('Nav timeout'));
  console.log('Current URL:', page.url());
  
  if (!page.url().includes('dashboard')) {
     await page.goto('http://localhost:5173/dashboard', { waitUntil: 'networkidle2' });
  }

  const content = await page.evaluate(() => document.getElementById('root')?.innerHTML);
  console.log('Root content len:', content?.length);
  const text = await page.evaluate(() => document.body.innerText);
  console.log('Body Text Snippet:', text.substring(0, 150).replace(/\n/g, ' '));

  await browser.close();
  process.exit(0);
})();
