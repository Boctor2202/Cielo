const { chromium } = require("playwright");
const fs = require("fs");
(async () => {
  const b = await chromium.launch();
  for (const job of JSON.parse(fs.readFileSync(process.argv[2], "utf8"))) {
    const p = await b.newPage({ viewport: { width: job.w, height: job.h }, deviceScaleFactor: 1 });
    const f = process.cwd() + "/tmp-" + Math.random().toString(36).slice(2) + ".html"; fs.writeFileSync(f, job.html); await p.goto("file://" + f, { waitUntil: "load" }); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300); fs.unlinkSync(f);
    await p.screenshot({ path: job.out, omitBackground: !!job.transparent });
    await p.close();
  }
  await b.close();
})();
