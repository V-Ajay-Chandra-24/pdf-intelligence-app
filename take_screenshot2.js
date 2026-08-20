const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  await page.goto('http://localhost:3000/register', { waitUntil: 'networkidle0' });
  await page.screenshot({ path: 'register_screenshot.png' });

  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' });
  await page.screenshot({ path: 'landing_screenshot.png' });
  
  await browser.close();
  console.log('Saved screenshots');
})();
