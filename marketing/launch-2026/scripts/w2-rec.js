const { chromium } = require("playwright");
(async () => {
  const [k, secs, out] = process.argv.slice(2);
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1080, height: 1920 }, recordVideo: { dir: out, size: { width: 1080, height: 1920 } }, reducedMotion: "no-preference" });
  const p = await ctx.newPage();
  await p.goto(`http://localhost:3200/en/promo-rec?k=${k}`, { waitUntil: "load" });
  await p.waitForTimeout(Number(secs) * 1000);
  const v = p.video(); await ctx.close(); console.log(await v.path()); await b.close();
})();
