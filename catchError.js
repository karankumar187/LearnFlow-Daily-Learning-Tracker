const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  page.on('console', msg => {
    if (msg.type() === 'error') console.log('BROWSER ERROR:', msg.text());
  });
  
  page.on('pageerror', err => {
    console.log('PAGE ERROR:', err.toString());
  });

  await page.goto('http://127.0.0.1:5173/login', { waitUntil: 'networkidle2' });
  await page.type('input[type="email"]', 'test@example.com');
  await page.type('input[type="password"]', 'test123');
  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForNavigation({ waitUntil: 'networkidle0' })
  ]);
  
  console.log("Logged in and reached dashboard.");
  
  await new Promise(r => setTimeout(r, 2000));
  await browser.close();
})();
