const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });
  
  const content = await page.evaluate(() => document.getElementById('root')?.innerHTML);
  console.log('Root content len:', content?.length);
  
  const errors = await page.evaluate(() => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(document.body.innerText);
      }, 1000);
    });
  });
  console.log('Body Text:', errors.substring(0, 200));

  await browser.close();
  process.exit(0);
})();
