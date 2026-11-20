"""SQL for the App Review demo account: a fictional A320 first officer (Thomas Mercier) with a year of airline flying."""
import random, sys, uuid
from datetime import datetime, timedelta, timezone

PID = sys.argv[1]
random.seed(42)
CAPTAINS = ["Cdt A. Moreau", "Cdt L. Garnier", "Cdt S. Laurent", "Cdt J. Petit", "Cdt M. Roux"]
today = datetime(2026, 11, 19, tzinfo=timezone.utc)
q = lambda s: "NULL" if s is None else "'" + str(s).replace("'", "''") + "'"
out = [f"delete from flights where pilot_id='{PID}'; delete from licenses where pilot_id='{PID}'; delete from aircraft where pilot_id='{PID}';"]

out.append(f"""update pilots set full_name='Thomas Mercier', display_name='Thomas', locale='en', regulatory_framework='EASA', home_base_icao='LFPO',
 licence_number='FRA.FCL.CA00012345', rank='First Officer', employer='Skyline Airways', nationality='FR', authority='EASA',
 birth_date='1990-04-12', current_types=array['A320'], default_function='SIC', updated_at=now() where id='{PID}';""")

ac = {r: str(uuid.uuid4()) for r in ["F-HGDN", "F-HGDW", "F-HGDX", "F-HGDY"]}
for reg, aid in ac.items():
    out.append(f"insert into aircraft (id,created_at,updated_at,pilot_id,registration,aircraft_type_id,operator,default_operation) values ('{aid}',now(),now(),'{PID}','{reg}','ref-A320','Skyline Airways','multi_pilot');")

lic = [("licence","ATPL(A)","DGAC","FRA.FCL.AT00012345",None),("type_rating","TR A320","DGAC France",None,"2027-04-30"),
       ("rating","IR(ME)","DGAC France",None,"2027-03-31"),("medical","Class 1","CEMA Roissy",None,"2027-08-15"),("language","LPE English 6","DGAC France",None,None)]
for kind, code, auth, num, until in lic:
    out.append(f"insert into licenses (id,created_at,updated_at,pilot_id,kind,code,authority,number,valid_until,alert_days) values ('{uuid.uuid4()}',now(),now(),'{PID}','{kind}',{q(code)},{q(auth)},{q(num)},{q(until)},array[90,30,7]);")

# block minutes between a Paris-Orly base and its outstations (short and medium haul)
legs = {("LFPO","LFMN"):85,("LFPO","LFBO"):75,("LFPO","LFML"):80,("LFPO","LFBD"):70,("LFPO","LEBL"):105,("LFPO","LEMD"):125,("LFPO","LPPT"):150,
        ("LFPO","LIRF"):125,("LFPO","LGAV"):195,("LFPO","GMMN"):185,("LFPO","DTTA"):150,("LFPO","LEPA"):110,("LFPO","LIMC"):90,("LFPO","EGKK"):70,
        ("LFPO","LFKJ"):100,("LFPO","LPPR"):130,("LFPO","GCLP"):270,("LFPO","LCLK"):255}
dur = {**legs, **{(b, a): m + random.choice([-5, 0, 5]) for (a, b), m in legs.items()}}
day = today - timedelta(days=365)
n = 0
while day < today - timedelta(days=1):
    day += timedelta(days=random.choice([2, 2, 3, 3, 4, 5, 6]))
    # a duty: one, two or three return trips from Orly
    trip = []
    for _ in range(random.choice([1, 2, 2, 2, 3]) if True else 1):
        a, b = random.choice(list(legs))
        trip += [(a, b), (b, a)]
        if sum(dur[x] for x in trip) > 520:
            break
    t = day.replace(hour=random.choice([5, 6, 6, 7, 10, 13, 15]), minute=random.choice([0, 10, 20, 30, 40, 50]))
    reg = random.choice(list(ac))
    for dep, arr in trip:
        blk = dur[(dep, arr)] + random.choice([-4, 0, 3, 6])
        out_t, in_t = t, t + timedelta(minutes=blk)
        off_t, on_t = out_t + timedelta(minutes=8), in_t - timedelta(minutes=5)
        night_frac = 1.0 if out_t.hour >= 19 or out_t.hour < 5 else (0.35 if in_t.hour >= 19 or out_t.hour == 5 else 0.0)
        night = int(blk * night_frac)
        pf = random.random() < 0.5
        ld_n = 1 if (pf and night_frac == 1.0) else 0
        ld_d = 1 if (pf and not ld_n) else 0
        fn = f"SKY{random.randint(1000, 7999)}"
        # a first officer logs the captain's name (EASA format): fictional captains
        cpt = random.choice(CAPTAINS)
        iso = lambda x: x.strftime("%Y-%m-%dT%H:%M:00Z")
        out.append(
            "insert into flights (id,created_at,updated_at,pilot_id,date,flight_number,source,dep_icao,arr_icao,out_utc,off_utc,on_utc,in_utc,"
            "aircraft_id,registration,aircraft_type_icao,total_min,air_min,single_pilot_se_min,single_pilot_me_min,multi_pilot_min,function,"
            "pic_min,picus_min,copilot_min,dual_min,instructor_min,examiner_min,night_min,ifr_min,actual_imc_min,xc_min,night_calc,"
            "takeoffs_day,takeoffs_night,landings_day,landings_night,pilot_flying,approaches,is_fstd,fstd_min,crew,locked,operator,pic_name) values ("
            f"'{uuid.uuid4()}',now(),now(),'{PID}','{out_t.date()}','{fn}','manual','{dep}','{arr}','{iso(out_t)}','{iso(off_t)}','{iso(on_t)}','{iso(in_t)}',"
            f"'{ac[reg]}','{reg}','A320',{blk},{blk-15},0,0,{blk},'SIC',0,0,{blk},0,0,0,{night},{blk},{random.choice([0,0,10,20])},{blk},'auto',"
            f"{ld_d},{ld_n},{ld_d},{ld_n},{'true' if pf else 'false'},'[]',false,0,'[]',false,'Skyline Airways','{cpt}');")
        n += 1
        t = in_t + timedelta(minutes=random.choice([40, 45, 50, 60]))
print("begin;\n" + "\n".join(out) + "\ncommit;")
print(f"-- {n} flights", file=sys.stderr)
