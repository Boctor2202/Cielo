const { chromium } = require("playwright");
const fs = require("fs");
const dir = process.argv[2];
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2, colorScheme: "dark" });
  const p = await ctx.newPage();
  p.on("pageerror", e => console.log("ERR", e.message.slice(0, 200)));
  const flights = [
    { id: "a", ident: "FHGDN", registration: "F-HGDN", aircraftType: "A320", dep: "LSGG", arr: "LEMD", out: "2026-11-21T17:05:00Z", off: "2026-11-21T17:18:00Z", on: "2026-11-21T19:01:00Z", in: "2026-11-21T19:09:00Z", source: "flightaware" },
    { id: "b", ident: "FHGDN", registration: "F-HGDN", aircraftType: "A320", dep: "EGLL", arr: "LSGG", out: "2026-11-21T13:40:00Z", off: "2026-11-21T13:58:00Z", on: "2026-11-21T15:12:00Z", in: "2026-11-21T15:19:00Z", source: "flightaware" },
    { id: "c", ident: "FHGDN", registration: "F-HGDN", aircraftType: "A320", dep: "LSGG", arr: "EGLL", out: "2026-11-20T09:55:00Z", off: "2026-11-20T10:08:00Z", on: "2026-11-20T11:20:00Z", in: "2026-11-20T11:31:00Z", source: "flightaware" },
  ];
  await p.route("**/api/flight-lookup**", async (r) => { await new Promise((x) => setTimeout(x, 700)); r.fulfill({ json: { flights } }); });
  await p.goto("http://localhost:3200/en/app/carnet/nouveau", { waitUntil: "load" });
  await p.waitForTimeout(2500);
  // the demo banner is not part of the feature shown
  await p.evaluate(() => { for (const el of document.querySelectorAll("div,section,aside")) { if (/^Demo:/.test(el.textContent?.trim() ?? "") && el.querySelector("button,a") && el.textContent.length < 200) { el.remove(); break; } } });
  let n = 0; const list = [];
  const shot = async (dur) => { const f = `${dir}/f${String(n++).padStart(3, "0")}.png`; await p.screenshot({ path: f }); list.push([f, dur]); };
  await p.evaluate(() => scrollTo(0, 0));
  await shot(1.2);
  const input = p.locator('input[placeholder="F-GXXX"]').first();
  await input.scrollIntoViewIfNeeded();
  await shot(0.4);
  for (const ch of "F-HGDN") { await input.type(ch); await shot(0.12); }
  await shot(0.6);
  await p.getByRole("button", { name: /Fill from ADS-B/ }).first().click();
  await p.waitForTimeout(150); await shot(0.6);
  await p.waitForTimeout(900); await shot(2.2);
  await p.getByRole("button", { name: /LSGG → LEMD/ }).first().click();
  await p.waitForTimeout(500); await shot(1.4);
  await p.evaluate(() => scrollBy({ top: 260, behavior: "instant" })); await p.waitForTimeout(300); await shot(2.2);
  fs.writeFileSync(`${dir}/list.txt`, list.map(([f, d]) => `file '${f}'\nduration ${d}`).join("\n") + `\nfile '${list[list.length - 1][0]}'\n`);
  await b.close();
})();
