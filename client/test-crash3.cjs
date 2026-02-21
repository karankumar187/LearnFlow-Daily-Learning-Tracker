const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('PAGE ERROR LOG:', msg.text());
    }
  });

  await page.goto('http://localhost:5173/login', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.setItem('token', 'fake.jwt.token');
    localStorage.setItem('user', JSON.stringify({ name: 'Test', email: 'test@test.com' }));
  });
  
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2' });
  
  const content = await page.evaluate(() => document.getElementById('root')?.innerHTML);
  console.log('Root content len:', content?.length);
  
  const errors = await page.evaluate(() => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(document.body.innerText);
      }, 1000);
    });
  });
  console.log('Body Text Snippet:', errors.substring(0, 150).replace(/\n/g, ' '));
  
  const h2s = await page.evaluate(() => Array.from(document.querySelectorAll('h2')).map(h => h.innerText));
  console.log('H2s:', h2s);

  await browser.close();
  process.exit(0);
})();
