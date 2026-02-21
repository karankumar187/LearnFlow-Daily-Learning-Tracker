const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('PAGE ERROR LOG:', msg.text());
    }
  });

  await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle2' });
  await page.type('input[type="email"]', 'karan9302451907@gmail.com');
  await page.type('input[type="password"]', 'karanpassword123');
  await page.click('button[type="submit"]');
  
  await page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {});
  
  // Create a note with prompt
  await page.goto('http://localhost:5173/notes', { waitUntil: 'networkidle2' });
  
  // Intercept dialog
  let dialogHandled = false;
  page.on('dialog', async dialog => {
    console.log('Dialog opened:', dialog.message());
    await dialog.accept('Puppeteer Test Note Title!');
    dialogHandled = true;
  });

  console.log('Clicking New Note...');
  await page.evaluate(() => {
     const btns = Array.from(document.querySelectorAll('button'));
     const newBtn = btns.find(b => b.textContent.includes('New Note'));
     if (newBtn) newBtn.click();
  });
  
  await new Promise(r => setTimeout(r, 1000));
  
  const content = await page.evaluate(() => document.body.innerHTML);
  if (content.includes('Puppeteer Test Note Title!')) {
      console.log('Note successfully created with custom title!');
  } else {
      console.log('Failed to find custom note title.');
  }

  console.log('Checking notifications...');
  await page.evaluate(() => {
     const btns = Array.from(document.querySelectorAll('button'));
     const bell = btns.find(b => b.querySelector('svg.lucide-bell'));
     if (bell) bell.click();
  });
  
  await new Promise(r => setTimeout(r, 500));
  const hasNotifs = await page.evaluate(() => document.body.innerHTML.includes('Global System Update'));
  
  if (hasNotifs) {
      console.log('Notifications drawer opened and contains data!');
      
      // Mark read
      await page.evaluate(() => {
          const notifs = Array.from(document.querySelectorAll('.cursor-pointer'));
          if (notifs.length > 0) notifs[0].click();
      });
      await new Promise(r => setTimeout(r, 500));
      console.log('Successfully clicked notification');
  }

  await browser.close();
  process.exit(0);
})();
