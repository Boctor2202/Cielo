import html, json
H_IG = "#pilotlife #avgeek #pilotlogbook #aviation #pilotsofinstagram #airlinepilot #corporatepilot #flighttraining"
H_LI = "#aviation #pilots #flightcrew"
U_IG = "geardown.app/?utm_source=instagram&utm_medium=social&utm_campaign=launch"
U_LI = "geardown.app/?utm_source=linkedin&utm_medium=social&utm_campaign=launch"

weeks = [
 ("1", "23 – 29 nov.", "Pré-lancement · Le problème", "Teasers et coulisses : montrer ce que les pilotes vivent avec leur carnet, sans encore tout dévoiler. Objectif : premiers abonnés, compte à rebours lancé."),
 ("2", "30 nov. – 6 déc.", "Pré-lancement · Les fonctions phares", "Une fonction par post, montrée en vrai dans l'app (compte de démo Thomas Mercier). Objectif : enregistrements, partages, premiers essais."),
 ("3", "7 – 13 déc.", "Pré-lancement · Les premiers utilisateurs", "Appel direct à essayer : 30 jours gratuits sans carte, prix fondateur pour les 500 premiers abonnés. Objectif : essais démarrés."),
 ("4", "14 – 20 déc.", "Lancement · 15 décembre", "Annonce le jour J sur les deux réseaux, puis démo, prise en main et invitation à partager sa Flightmap."),
]

posts = [
 # week, date, day, time, net, format, title, caption, visual
 (1,"23 nov.","Lun","19:00","IG","Reel 10 s","Le carnet tenu à la main",
  "Still adding up your logbook columns by hand? ✍️\n\nPage totals. Night time. PIC, IFR, landings carried forward. Every pilot knows the Sunday evening with a calculator.\n\nSomething is coming for that. 15.12 ✈️\nFollow to see it first.\n\n"+H_IG,
  "Plan serré d'un carnet papier et d'une calculatrice, puis coupe nette sur l'écran Vue d'ensemble de l'app (totaux qui s'animent). Texte à l'écran : « Still doing this? » → « 15.12 »."),
 (1,"24 nov.","Mar","08:30","LI","Texte + image","Pourquoi Geardown",
  "Most pilots keep their logbook in three places: a paper book, a spreadsheet and an app that never quite matches either.\n\nGeardown was built by a working pilot who got tired of reconciling them. One logbook, right column by column: night time from civil twilight along the route, PIC, PICUS and SIC, page totals that follow, and your flight time limitations worked out from the same data.\n\nWe open on 15 December. Until then, we will share what is inside, one feature at a time.\n\nHow do you keep yours today?\n\n"+H_LI,
  "Image sobre : le hero du site (jet au crépuscule au-dessus des nuages) avec le logo Geardown et « 15.12 »."),
 (1,"25 nov.","Mer","12:30","IG","Carrousel 6 vues","5 erreurs de carnet",
  "5 logbook mistakes that come back at your next check 👇\n\n1. Night time counted from sunset instead of civil twilight\n2. PICUS logged as PIC\n3. Simulator time mixed with flight time\n4. Totals not carried to the next page\n5. Entries never signed\n\nSave this for your next logbook review 📌\n\n"+H_IG,
  "Carrousel aux couleurs de l'app (fond nuit, accent vert). Une erreur par vue, avec la bonne règle en une ligne. Dernière vue : « Geardown gets these right for you · 15.12 »."),
 (1,"26 nov.","Jeu","08:30","LI","Sondage","Comment tenez-vous votre carnet ?",
  "Quick poll for pilots: how do you keep your logbook today?\n\n• Paper\n• Spreadsheet\n• A logbook app\n• A bit of everything\n\n(We are building Geardown around the answers.)\n\n"+H_LI,
  "Sondage natif LinkedIn, sans visuel. Répondre à chaque commentaire dans l'heure."),
 (1,"27 nov.","Ven","19:00","IG","Reel 8 s","From gear up to gear down",
  "From gear up to gear down. 🛬\nYour complete logbook, coming 15.12.\n\nTurn on notifications so you don't miss it 🔔\n\n"+H_IG,
  "Le film du hero (décollage au crépuscule) en boucle, titre « Geardown » puis « 15.12 ». Musique calme, sans voix."),
 (1,"29 nov.","Dim","18:00","IG","Story","Compte à rebours",
  "Sticker « Compte à rebours » : « Geardown · 15 décembre ». Texte : « Tap to get a reminder ».",
  "Story fond nuit avec le logo. Le sticker compte à rebours rappelle automatiquement le lancement à tous ceux qui l'activent : c'est le principal levier d'abonnés de la semaine."),

 (2,"30 nov.","Lun","19:00","IG","Reel 15 s","Import depuis une photo",
  "Years of paper logbook. One photo per page. 📸\n\nGeardown reads every line, checks it, and shows you the totals before anything is imported. Excel, CSV, LogTen, Safelog and CrewLounge work too.\n\n15.12 · try it free for 30 days, no card.\n\n"+H_IG,
  "Enregistrement d'écran : photo d'une page de carnet (fictive, compte démo) → lignes reconnues → écran « Vérifiez vos totaux ». Aucune donnée réelle de pilote."),
 (2,"1 déc.","Mar","08:30","LI","Carrousel PDF","Importer son ancien carnet",
  "Switching logbooks usually means a weekend of retyping. It shouldn't.\n\nGeardown imports:\n→ Excel and CSV exports\n→ LogTen, Safelog, CrewLounge\n→ a roster PDF\n→ a photo of your paper logbook\n\nEvery line is read and checked, and you confirm the totals before anything is saved. Your old logbook stays yours, and you can export everything again at any time.\n\nOpening 15 December.\n\n"+H_LI,
  "Document PDF de 6 pages (format carrousel LinkedIn) : un format par page avec une capture, dernière page avec le lien."),
 (2,"2 déc.","Mer","12:30","IG","Carrousel 5 vues","Flightmap",
  "Every route you've flown, on one map. 🗺️\n\nAirports, nautical miles, countries visited, filtered by year or aircraft type, and shareable in one tap.\n\nWhat would yours look like? From 15.12, share it with #MyFlightmap and we'll repost our favourites.\n\n"+H_IG,
  "Cartes Flightmap du compte démo Thomas Mercier (thème sombre et clair), puis la carte de partage au format story. Dernière vue : « #MyFlightmap »."),
 (2,"3 déc.","Jeu","08:30","LI","Texte + capture","Les FTL sans calcul",
  "Flight and duty time over 7 days, 28 days, the calendar year and 12 months, worked out from your logbook and your roster. ORO.FTL or Subpart Q.\n\nYou see how close you are to each limit before you accept the extra duty, not after.\n\nWhich limit do you check most often?\n\n"+H_LI,
  "Capture de l'écran FTL (barres de limites) du compte démo, avec un léger cadre d'ordinateur."),
 (2,"4 déc.","Ven","19:00","IG","Reel 12 s","Remplir un vol en 3 secondes",
  "Type the registration. That's it. ⏱️\n\nGeardown finds the aircraft's flights of the last few days and fills in the airports and the actual block times.\n\n15.12 ✈️\n\n"+H_IG,
  "Enregistrement d'écran : saisie d'une immatriculation fictive (F-HGDN) → liste des vols → formulaire rempli. Gros plan sur le doigt / le clic."),
 (2,"6 déc.","Dim","18:00","IG","Story","Quiz nuit",
  "Sticker quiz : « For your logbook, night starts at… » A) Sunset B) End of civil twilight ✅ C) 30 min after sunset.",
  "Story fond nuit. Le lendemain, story de réponse avec un lien vers le site (sticker lien, adresse avec UTM)."),

 (3,"7 déc.","Lun","19:00","IG","Reel 10 s","Essayez avant tout le monde",
  "You don't have to wait for the 15th. 👀\n\nThe web version is already open: 30 days free, no card, everything included. The iPhone app follows on 15 December.\n\nLink in bio.\n\n"+H_IG,
  "Reel rythmé : 4 écrans de l'app qui défilent (Vue d'ensemble, Flightmap, FTL, Signature), texte « 30 days free · no card »."),
 (3,"8 déc.","Mar","08:30","LI","Texte","Prix fondateur",
  "A promise to our first subscribers: the first 500 keep their price for as long as they stay subscribed.\n\nBasic: €3.99 a month. Max (rosters, FTL, radar, tracks, CV and job matching): €8.99 a month. Yearly plans include two months free.\n\nStart with 30 days free, no card: "+U_LI+"\n\n"+H_LI,
  "Pas de visuel ou une carte simple des deux offres aux couleurs de la marque. Vérifier les prix affichés sur le site le jour même."),
 (3,"9 déc.","Mer","12:30","IG","Carrousel 5 vues","Signer ses vols",
  "Sign your flights with your finger ✍️\n\nSave your signature once, sign a flight, a selection or the whole logbook, or ask a captain or instructor to sign. A flight changed later shows as no longer signed.\n\nSave for later 📌\n\n"+H_IG,
  "Captures du compte démo : signature au doigt, demande de signature à un collègue, vol signé dans la liste, annexe des signatures dans l'export PDF."),
 (3,"10 déc.","Jeu","08:30","LI","Texte + capture","Votre carnet vous appartient",
  "Your logbook is a legal record of your career. It should never be locked inside an app.\n\nWith Geardown you can export everything at any time, in EASA, FAA or CASA layouts, as PDF, CSV or Excel, even if you stop subscribing.\n\nWhat matters most to you when choosing a logbook?\n\n"+H_LI,
  "Capture de l'écran Export (choix des formats) du compte démo."),
 (3,"11 déc.","Ven","19:00","IG","Reel 10 s","Plus jamais de médical expiré",
  "Medical, licence, type rating, recency. 📅\nGeardown reminds you before anything lapses and checks your recent experience with every flight.\n\n4 days to go.\n\n"+H_IG,
  "Écran Licences & médical du compte démo, avec la notification de rappel qui apparaît. Texte « 4 days »."),
 (3,"12 déc.","Sam","11:00","IG","Story","Rappel J-3",
  "Story : « 3 days » + sticker lien vers le site (UTM Instagram) + republication du compte à rebours.",
  "Reprendre le sticker compte à rebours de la semaine 1 pour relancer les rappels."),

 (4,"14 déc.","Lun","19:00","IG","Story","Demain",
  "Story : « Tomorrow. » sur le film du hero, sticker compte à rebours.",
  "Courte, sans texte de plus."),
 (4,"15 déc.","Mar","08:30","LI","Texte + vidéo","Lancement",
  "Geardown is live. ✈️\n\nThe pilot logbook that gets it right column by column, now on iPhone and on the web:\n→ import your old logbook, even from photos\n→ night time, PIC, PICUS and SIC worked out for you\n→ flight time limitations from your logbook and roster\n→ signatures, licence reminders, exports in EASA, FAA and CASA layouts\n→ your career on one map\n\n30 days free, no card: "+U_LI+"\n\nThank you to everyone who followed along these past weeks.\n\n"+H_LI,
  "Vidéo de 20 à 30 s : film du hero puis enchaînement des écrans. Si Apple n'a pas encore validé l'app, publier la version de secours (voir le plan B)."),
 (4,"15 déc.","Mar","12:30","IG","Reel 20 s","Lancement",
  "It's here. 🛫\n\nGeardown, your complete logbook, is live on iPhone and on the web. 30 days free, no card.\n\nLink in bio · share your Flightmap with #MyFlightmap\n\n"+H_IG,
  "Même montage que LinkedIn, au format vertical, musique plus présente."),
 (4,"15 déc.","Mar","19:00","IG","Stories ×4","Soirée de lancement",
  "1. « It's live » + lien. 2. Démo de l'import par photo. 3. « Share your Flightmap » (exemple Thomas Mercier). 4. Sondage « What should we build next? ».",
  "Republier chaque story où Geardown est mentionné (avec l'accord des personnes)."),
 (4,"16 déc.","Mer","08:30","LI","Carrousel PDF","Ce qu'il y a dans Geardown",
  "Everything inside Geardown, in 8 pages. Swipe →\n\nWhich one would you use first?\n\n"+H_LI,
  "PDF de 8 pages : une fonction par page (import, carnet, Flightmap, FTL, licences, signatures, CV et offres, exports)."),
 (4,"17 déc.","Jeu","12:30","IG","Carrousel 6 vues","Vos 10 premières minutes",
  "Your first 10 minutes on Geardown ⏱️\n\n1. Create your account (30 days free, no card)\n2. Import your old logbook\n3. Check your totals\n4. Add your licences and medical\n5. Log your next flight from its registration\n6. Share your Flightmap\n\nSave this 📌\n\n"+H_IG,
  "Une étape par vue, chacune avec la capture correspondante du compte démo."),
 (4,"18 déc.","Ven","19:00","IG","Reel 10 s","#MyFlightmap",
  "Your routes, your map. 🗺️\nShare yours with #MyFlightmap: we'll feature some of them next week.\n\n"+H_IG,
  "Montage des cartes partagées avec l'accord écrit de leurs auteurs. Sinon, la carte du compte démo. Jamais de carte d'un pilote réel sans son accord."),
 (4,"19 déc.","Sam","10:00","LI","Texte","Merci et la suite",
  "Thank you to every pilot who tried Geardown this week and sent us feedback.\n\nWhat would you like us to build next? Every comment is read.\n\nHappy holidays, and safe flights.\n\n"+H_LI,
  "Image du hero version jour (avion au-dessus des nuages). Ne citer aucun chiffre d'inscrits qui ne soit pas réel et vérifié."),
]

growth = [
 ("Régularité", "3 publications Instagram (plus une ou deux stories) et 2 LinkedIn par semaine, toujours aux mêmes heures (08:30 sur LinkedIn ; 12:30 ou 19:00 sur Instagram, heure de Paris). Les algorithmes récompensent la régularité plus que le volume."),
 ("Reels d'abord sur Instagram", "C'est le format qui montre le compte à des non-abonnés. Accroche lisible dans la première seconde, 8 à 15 secondes, sous-titres incrustés (la plupart des gens regardent sans le son)."),
 ("Carrousels utiles à enregistrer", "Les contenus pratiques (règles de nuit, FTL, erreurs de carnet) sont enregistrés et partagés : c'est ce signal qui élargit la diffusion. Terminer par « Save this »."),
 ("Compte à rebours Instagram", "Le sticker compte à rebours rappelle automatiquement le lancement à chaque personne qui l'active. Le publier en semaine 1 et le relancer en semaine 3."),
 ("15 minutes d'échanges par jour", "Commenter des posts de pilotes, d'écoles et de comptes aviation (sans lien, avec un vrai avis) et répondre à chaque commentaire dans l'heure. C'est le levier le plus sûr pour gagner des abonnés au début."),
 ("#MyFlightmap", "Inviter les pilotes à partager leur carte (le partage est déjà dans l'app) et en republier quelques-unes avec leur accord : chaque partage montre Geardown à leur réseau."),
 ("Partages volontaires sur LinkedIn", "Demander à des pilotes de ton entourage de repartager le post de lancement s'ils le souhaitent. La page Geardown publie : ton nom et ta compagnie n'apparaissent pas."),
 ("Collaborations", "Proposer une publication commune (fonction « Collab » d'Instagram) à des créateurs aviation ou à des écoles de pilotage, en indiquant clairement tout partenariat rémunéré (#ad)."),
 ("Lien et mesure", "Le lien en bio et dans les posts LinkedIn porte un code de suivi par réseau (adresses ci-dessous). Les essais démarrés se lisent ensuite dans Admin › Vue d'ensemble."),
]

def card(p):
    w,date,day,time,net,fmt,title,cap,vis = p
    netname = "LinkedIn" if net=="LI" else "Instagram"
    launch = " launch" if date=="15 déc." else ""
    is_text = not fmt.startswith("Story") and not fmt.startswith("Stories") and not fmt.startswith("Sondage")
    import re as _re
    capid="p-"+_re.sub(r"[^a-z0-9]+","-",f"{date}-{time}-{net}".lower()).strip("-")
    return f'''<article class="post {net.lower()}{launch}" data-net="{net}">
  <div class="when"><span class="day">{day}</span><span class="date">{html.escape(date)}</span><span class="time">{time}</span></div>
  <div class="body">
    <div class="meta"><span class="net {net.lower()}">{netname}</span><span class="fmt">{html.escape(fmt)}</span>{'<span class="tag">Jour J</span>' if launch else ''}</div>
    <h4>{html.escape(title)}</h4>
    <div class="cap" id="{capid}" {'lang="en"' if is_text else ''}>{html.escape(cap)}</div>
    <p class="vis"><b>Visuel</b> {html.escape(vis)}</p>
    <div class="actions"><button type="button" class="copy" data-target="{capid}">Copier le texte</button><label class="done"><input type="checkbox" id="d-{capid}"> Publié</label></div>
  </div>
</article>'''

wk_html=[]
for num,dates,title,desc in weeks:
    items="\n".join(card(p) for p in posts if p[0]==int(num))
    wk_html.append(f'''<section class="week" id="semaine-{num}">
  <header class="wk-head"><span class="wk-num">S{num}</span><div><p class="wk-dates">{dates}</p><h3>{html.escape(title)}</h3><p class="wk-desc">{html.escape(desc)}</p></div></header>
  <div class="posts">{items}</div>
</section>''')

grow_html="\n".join(f'<li><b>{html.escape(a)}</b><span>{html.escape(b)}</span></li>' for a,b in growth)
n_li=sum(1 for p in posts if p[4]=="LI"); n_ig=sum(1 for p in posts if p[4]=="IG")

page=open("template.html").read()
page=page.replace("{{WEEKS}}","\n".join(wk_html)).replace("{{GROWTH}}",grow_html).replace("{{N_LI}}",str(n_li)).replace("{{N_IG}}",str(n_ig)).replace("{{U_IG}}",U_IG).replace("{{U_LI}}",U_LI)
open("geardown-launch.html","w").write(page)
print(len(page), n_li, n_ig)
