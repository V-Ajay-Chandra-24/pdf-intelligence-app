const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });

  const styles = await page.evaluate(() => {
    const el = document.querySelector('.animate-drift');
    if (!el) return null;
    const style = window.getComputedStyle(el);
    return {
      width: style.width,
      height: style.height,
      opacity: style.opacity,
      background: style.background,
      filter: style.filter,
      position: style.position,
      zIndex: style.zIndex,
      visibility: style.visibility,
      transform: style.transform,
      animation: style.animation
    };
  });

  console.log('Homepage .animate-drift styles:', styles);

  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle0' });
  const loginStyles = await page.evaluate(() => {
    const el = document.querySelector('.animate-drift');
    if (!el) return null;
    const style = window.getComputedStyle(el);
    return {
      width: style.width,
      height: style.height,
      opacity: style.opacity,
      background: style.background,
      filter: style.filter,
      position: style.position,
      zIndex: style.zIndex,
      visibility: style.visibility,
      transform: style.transform,
      animation: style.animation
    };
  });

  console.log('Login .animate-drift styles:', loginStyles);

  await browser.close();
})();
