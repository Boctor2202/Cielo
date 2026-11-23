const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 2 })).newPage();
  await p.goto('file://' + __dirname + '/slides.html'); await p.waitForTimeout(3000);
  const n = await p.locator('.slide').count();
  for (let i = 0; i < n; i++) await p.locator('.slide').nth(i).screenshot({ path: `anatomy-${i + 1}.png` });
  await b.close(); })();
