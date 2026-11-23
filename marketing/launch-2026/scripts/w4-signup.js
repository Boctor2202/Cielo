const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 430, height: 860 }, deviceScaleFactor: 2, colorScheme: "dark" });
  await p.goto("http://localhost:3200/en/inscription", { waitUntil: "load" }); await p.waitForTimeout(2000);
  await p.screenshot({ path: process.argv[2] });
  await b.close();
})();
