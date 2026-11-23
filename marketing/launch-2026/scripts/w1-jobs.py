import json, os
S=os.getcwd(); css=open("base.css").read(); word=open("word.html").read()
def page(w,h,body,extra=""):
    return f"<!doctype html><html><head><meta charset=utf-8><style>{css}{extra}</style></head><body><div class='c' style='width:{w}px;height:{h}px'>{body}</div></body></html>"
jobs=[]
# A. LinkedIn 24 Nov, 1080x1350
jobs.append(dict(w=1080,h=1350,out="out/li-2411-why-geardown.png",html=page(1080,1350,f"""
<img src="file://{S}/dusk.png" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:60% 50%">
<div style="position:absolute;inset:0;background:linear-gradient(180deg,#07101ccc 0%,#07101c40 30%,#07101c55 50%,#07101cf2 72%,#07101cf7 100%)"></div>
<div style="position:absolute;left:84px;top:84px">{word}</div>
<div style="position:absolute;left:84px;right:84px;bottom:96px">
 <p class="mono green" style="font-size:24px;letter-spacing:.18em;font-weight:700">OPENING 15.12</p>
 <h1 style="font:600 86px/1.02 F;letter-spacing:-.015em;margin-top:18px">One logbook.<br>Right, column<br>by column.</h1>
 <p style="font-size:30px;color:#c9d4e2;margin-top:26px;max-width:820px;line-height:1.4">Built by a working pilot, tired of reconciling paper, spreadsheets and apps.</p>
 <p class="mono" style="font-size:24px;color:#93a6bc;margin-top:34px">geardown.app</p>
</div>""")))
# B. Carousel 25 Nov, 6 slides 1080x1350
mist=[
 ("Night time counted from sunset","Night runs from the end of evening civil twilight to the beginning of morning civil twilight, when the sun is 6° below the horizon. Sunset is too early.","night"),
 ("PICUS logged as PIC","Pilot in command under supervision has its own column. It is not PIC time, even where it counts towards some licence requirements.","picus"),
 ("Simulator time mixed with flight time","Sessions in a simulator (FSTD) go in their own section. They never add to your total flight time.","sim"),
 ("Totals not carried to the next page","Every page carries its totals forward. Miss one carry-over and every total after it is wrong.","totals"),
 ("Entries never signed","Training and check flights need the instructor's or examiner's signature. An unsigned entry can be questioned at your next check.","sign"),
]
def illus(k):
    if k=="night":
        return """<svg viewBox="0 0 520 220" width="520" height="220"><line x1="10" y1="150" x2="510" y2="150" stroke="#93a6bc" stroke-width="3"/>
<circle cx="120" cy="150" r="26" fill="#fbbf24"/><rect x="0" y="150" width="520" height="70" fill="#0b1626"/>
<text x="120" y="200" fill="#fbbf24" font-family="J" font-size="20" text-anchor="middle">SUNSET</text>
<line x1="330" y1="40" x2="330" y2="150" stroke="#4ade80" stroke-width="3" stroke-dasharray="8 6"/>
<text x="330" y="200" fill="#4ade80" font-family="J" font-size="20" text-anchor="middle">SUN −6°</text>
<text x="430" y="105" fill="#e8eef5" font-family="J" font-size="22" text-anchor="middle">NIGHT →</text></svg>"""
    if k=="picus":
        return """<div style="display:flex;gap:14px">"""+"".join(f"""<div style="border:2px solid {c};border-radius:14px;padding:16px 22px;font:700 30px J;color:{c}">{t}</div>""" for t,c in [("PIC","#93a6bc"),("PICUS","#4ade80"),("SIC","#93a6bc")])+"</div>"
    if k=="sim":
        return """<div style="display:flex;gap:18px;align-items:center;font:700 28px J"><div style="border:2px solid #4ade80;color:#4ade80;border-radius:14px;padding:16px 22px">FLIGHT TIME</div><div style="color:#93a6bc;font-size:40px">≠</div><div style="border:2px solid #818cf8;color:#a5b4fc;border-radius:14px;padding:16px 22px">FSTD</div></div>"""
    if k=="totals":
        return """<div style="font:600 30px J;color:#e8eef5;border:2px solid #ffffff26;border-radius:14px;padding:18px 24px;display:grid;grid-template-columns:auto auto;gap:8px 40px"><span style="color:#93a6bc">This page</span><span>12:40</span><span style="color:#93a6bc">Brought forward</span><span>1 835:24</span><span class="green">Total</span><span class="green">1 848:04</span></div>"""
    return """<div style="border:2px solid #ffffff26;border-radius:14px;padding:18px 24px;width:560px"><p class="mono" style="font-size:20px;color:#93a6bc;letter-spacing:.1em">INSTRUCTOR / EXAMINER</p><svg viewBox="0 0 500 90" width="500" height="90"><path d="M20 62 C55 18 80 92 115 48 S180 20 210 64 S275 78 310 38 L360 34" stroke="#4ade80" stroke-width="5" fill="none" stroke-linecap="round"/><line x1="10" y1="80" x2="490" y2="80" stroke="#93a6bc" stroke-width="2"/></svg></div>"""
bg="background:radial-gradient(120% 70% at 85% 0%,#163a2a 0%,#0b1626 55%,#07101c 100%)"
cover=f"""<div style="position:absolute;inset:0;{bg}"></div>
<div style="position:absolute;left:84px;top:84px">{word}</div>
<div style="position:absolute;left:84px;right:84px;top:330px">
 <p class="mono green" style="font-size:26px;letter-spacing:.16em;font-weight:700">LOGBOOK REVIEW</p>
 <h1 style="font:600 104px/1.0 F;letter-spacing:-.02em;margin-top:24px">5 logbook mistakes that come back at your next check</h1>
</div>
<p style="position:absolute;right:84px;bottom:84px;font:700 30px M;color:#4ade80">Swipe →</p>
<p class="mono" style="position:absolute;left:84px;bottom:90px;font-size:22px;color:#93a6bc">1 / 6</p>"""
jobs.append(dict(w=1080,h=1350,out="out/ig-2511-carousel-1.png",html=page(1080,1350,cover)))
for i,(t,rule,k) in enumerate(mist):
    last=i==4
    body=f"""<div style="position:absolute;inset:0;{bg}"></div>
<div style="position:absolute;left:84px;top:84px;transform:scale(.8);transform-origin:left top">{word}</div>
<p class="mono" style="position:absolute;right:84px;top:92px;font-size:22px;color:#93a6bc">{i+2} / 6</p>
<div style="position:absolute;left:84px;right:84px;top:240px">
  <p class="mono" style="font-size:24px;letter-spacing:.14em;color:#f87171;font-weight:700">✕ MISTAKE {i+1}</p>
 <h2 style="font:600 72px/1.06 F;letter-spacing:-.015em;margin-top:18px">{t}</h2>
 <div style="margin-top:56px;min-height:220px;display:flex;align-items:center">{illus(k)}</div>
 <p class="mono" style="font-size:24px;letter-spacing:.14em;color:#4ade80;font-weight:700;margin-top:40px">✓ THE RULE</p>
 <p style="font-size:36px;line-height:1.4;color:#dbe4ee;margin-top:14px">{rule}</p>
</div>
{'<div style="position:absolute;left:84px;right:84px;bottom:84px;border-top:1px solid #ffffff26;padding-top:28px;display:flex;justify-content:space-between;align-items:center"><p style="font:700 32px M">Geardown gets these right for you</p><p class="mono green" style="font-size:30px;font-weight:700">15.12</p></div>' if last else '<p style="position:absolute;left:84px;bottom:84px;font-size:22px;color:#93a6bc">Check the rules of your own authority.</p><p style="position:absolute;right:84px;bottom:84px;font:700 30px M;color:#4ade80">Swipe →</p>'}"""
    jobs.append(dict(w=1080,h=1350,out=f"out/ig-2511-carousel-{i+2}.png",html=page(1080,1350,body)))
# C. Story 29 Nov 1080x1920
jobs.append(dict(w=1080,h=1920,out="out/ig-2911-story-countdown.png",html=page(1080,1920,f"""
<img src="file://{S}/dusk.png" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:62% 50%">
<div style="position:absolute;inset:0;background:linear-gradient(180deg,#07101cdd 0%,#07101c40 35%,#07101c40 60%,#07101cee 100%)"></div>
<div style="position:absolute;left:0;right:0;top:250px;display:flex;justify-content:center">{word}</div>
<p style="position:absolute;left:0;right:0;top:360px;text-align:center;font:600 64px/1.1 F">Your complete logbook</p>
<p class="mono green" style="position:absolute;left:0;right:0;bottom:330px;text-align:center;font-size:120px;font-weight:700;letter-spacing:.04em">15.12</p>
<p style="position:absolute;left:0;right:0;bottom:250px;text-align:center;font-size:34px;color:#c9d4e2">Tap the countdown to get a reminder</p>""")))
# overlays for the 27 Nov reel (transparent 1080x1920)
def ov(name,body): jobs.append(dict(w=1080,h=1920,out=f"ov/{name}.png",transparent=True,html=page(1080,1920,body)))
os.makedirs("ov",exist_ok=True)
ov("r27-a",'<p style="position:absolute;left:0;right:0;top:330px;text-align:center;font:600 110px/1 F;text-shadow:0 4px 30px #000a">From gear up</p>')
ov("r27-b",'<p style="position:absolute;left:0;right:0;top:330px;text-align:center;font:600 110px/1 F;text-shadow:0 4px 30px #000a">to gear down.</p>')
ov("r27-c",f'<div style="position:absolute;inset:0;background:#07101c99"></div><div style="position:absolute;left:0;right:0;top:760px;display:flex;justify-content:center;transform:scale(1.6)">{word}</div><p class="mono green" style="position:absolute;left:0;right:0;top:960px;text-align:center;font-size:96px;font-weight:700">15.12</p>')
# overlays for the 23 Nov reel
ov("r23-a",'<div style="position:absolute;left:0;right:0;top:0;height:640px;background:linear-gradient(#07101cee,#07101c00)"></div><p style="position:absolute;left:90px;right:90px;top:250px;text-align:center;font:600 92px/1.08 F;text-shadow:0 4px 30px #000a">Still adding up your logbook by hand?</p>')
ov("r23-b",f'<div style="position:absolute;left:0;right:0;top:120px;display:flex;justify-content:center">{word}</div><p style="position:absolute;left:90px;right:90px;top:230px;text-align:center;font:600 80px/1.1 F">Something is coming.</p><p class="mono green" style="position:absolute;left:0;right:0;bottom:110px;text-align:center;font-size:84px;font-weight:700">15.12</p>')
json.dump(jobs,open("jobs.json","w"))
print(len(jobs))
