#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Generator SSOT free_mail_domains.
Jedno zrodlo prawdy (GROUPS) -> emituje free_mail_domains_v1.json, .txt oraz SSOT .md
"""
import json, re, collections
from pathlib import Path

VERSION = "1.0.0"
GENERATED = "2026-07-15"

GROUPS = []

def g(provider, tier, region, conf, domains, note=""):
    GROUPS.append({
        "provider": provider, "tier": tier, "region": region,
        "conf": conf, "domains": domains, "note": note
    })

# ============================================================
# POLSKA
# ============================================================
g("Wirtualna Polska (WP / o2 / tlen)", "A", "PL", "high", [
    "wp.pl", "poczta.wp.pl", "o2.pl", "go2.pl", "tlen.pl", "int.pl", "prokonto.pl",
    "10g.pl", "mixbox.pl", "kozacki.pl", "fejm.pl", "notowany.pl", "mailmix.pl",
    "mailplus.pl", "cmoki.pl", "dobramama.pl", "dobrytata.pl", "szeptem.pl",
    "romantyczka.pl", "jadamspam.pl", "lykamspam.pl", "fajne.to", "superbox.pl",
    "wir.pl", "xboxer.pl", "tenbit.pl",
], "WP przejela o2.pl (razem z go2.pl / tlen.pl / prokonto.pl / int.pl). Jedna infrastruktura, wiele aliasow.")

g("Grupa Interia", "A", "PL", "high", [
    "interia.pl", "interia.eu", "interia.com", "poczta.fm", "vip.interia.pl",
    "intmail.pl", "interiowy.pl", "adresik.net", "pisz.to", "pacz.to", "ogarnij.se",
], "Zrodlo prawdy: https://konto-pocztowe.interia.pl/app/poczta/domainlist (oficjalny endpoint z lista domen).")

g("Onet (Ringier Axel Springer)", "A", "PL", "high", [
    "onet.pl", "onet.eu", "onet.com.pl", "poczta.onet.pl", "poczta.onet.eu",
    "op.pl", "vp.pl", "spoko.pl", "autograf.pl", "opoczta.pl", "buziaczek.pl", "amorki.pl",
])

g("Agora", "A", "PL", "high", ["gazeta.pl"])

g("PL - pozostale portale / freemail", "A", "PL", "med", [
    "poczta.pl", "priv.pl", "spray.pl", "serwus.pl", "rubikon.pl", "box43.pl",
    "os.pl", "student.pl", "akcja.pl", "hoga.pl", "1gb.pl", "pf.pl", "wp.eu",
], "Czesc to relikty (portale z lat 2000-2010). Nadal zyja jako adresy w bazach leadow - dlatego zostaja.")

g("PL - telco / ISP (dual-use)", "B", "PL", "high", [
    "orange.pl", "neostrada.pl", "netia.pl", "internetia.pl", "vectra.pl",
    "toya.pl", "toya.net.pl", "multimedia.pl", "aster.pl", "astercity.net",
    "dialog.pl", "inea.pl", "icpnet.pl", "satfilm.pl", "chello.pl",
    "upcpoczta.pl", "upc.com.pl", "plus.pl", "plusnet.pl", "t-mobile.pl",
    "era.pl", "sferia.pl",
], "Domeny abonenckie. Sa TEZ domenami realnych firm (Orange Polska, Netia SA). Patrz rozdzial 7.1 - i tak blokujemy.")

g("PL - hosting (dual-use)", "B", "PL", "med", [
    "home.pl", "nazwa.pl", "az.pl",
], "Nie jestem pewien, czy nadal wydaja darmowe skrzynki konsumenckie. Blokujemy prewencyjnie - koszt bledu jest niski.")

# ============================================================
# DE / AT / CH
# ============================================================
g("United Internet - GMX", "A", "DE/GLOBAL", "high", [
    "gmx.de", "gmx.net", "gmx.com", "gmx.at", "gmx.ch", "gmx.co.uk", "gmx.fr",
    "gmx.us", "gmx.eu", "gmx.li", "gmx.tm", "gmx.biz", "gmx.info", "gmx.org",
], "Nie mam pewnej pelnej listy (krazy liczba ~130). Zrodlo referencyjne: https://www.spamresource.com/2020/03/reference-webde-gmx-and-mailcom-domains.html . Uzupelnij regula wzorcowa `^gmx\\.<tld>$`.")

g("United Internet - web.de / 1&1", "A", "DE", "high", ["web.de", "online.de"])

g("DE - freemail", "A", "DE", "high", [
    "t-online.de", "freenet.de", "arcor.de", "mail.de", "posteo.de", "posteo.net",
    "mailbox.org", "lycos.de", "nexgo.de",
], "posteo / mailbox.org sa platne, ale konsumenckie - z punktu widzenia mintowania firmy zachowuja sie identycznie jak darmowe.")

g("DE - telco / ISP (dual-use)", "B", "DE", "med", [
    "vodafone.de", "kabelmail.de", "unitybox.de", "ewetel.net", "netcologne.de",
    "versanet.de", "htp-tel.de", "osnanet.de",
])

g("AT - freemail / ISP", "B", "AT", "med", [
    "aon.at", "chello.at", "a1.net", "inode.at", "utanet.at", "kabsi.at", "liwest.at",
])

g("CH - freemail / ISP", "B", "CH", "med", [
    "bluewin.ch", "sunrise.ch", "hispeed.ch", "bluemail.ch", "vtxnet.ch",
    "freesurf.ch", "swissonline.ch",
])

# ============================================================
# FR
# ============================================================
g("FR - Orange / Wanadoo", "B", "FR", "high", [
    "orange.fr", "wanadoo.fr", "voila.fr", "nordnet.fr",
], "UWAGA: orange.fr = konsument, orange.com = korporacja Orange S.A. NIE blokuj orange.com.")

g("FR - Free / Iliad", "B", "FR", "high", ["free.fr", "aliceadsl.fr", "alice.fr"])

g("FR - SFR / Numericable", "B", "FR", "high", [
    "sfr.fr", "neuf.fr", "cegetel.net", "club-internet.fr", "numericable.fr",
    "noos.fr", "9online.fr",
])

g("FR - Bouygues", "B", "FR", "high", ["bbox.fr"])

g("FR - freemail", "A", "FR", "high", [
    "laposte.net", "caramail.com", "lycos.fr", "netcourrier.com", "libertysurf.fr",
    "infonie.fr", "tiscali.fr", "worldonline.fr",
])

g("FR - do weryfikacji", "A", "FR", "low", [
    "caramail.fr", "chez.com", "ifrance.com", "nomade.fr", "multimania.fr",
    "mageos.com", "freesurf.fr", "tele2.fr",
], "Nie wiem, czy nadal dzialaja. Nie usuwam - martwa domena w denyliscie nie szkodzi, brakujaca zywa szkodzi.")

# ============================================================
# UK / IE
# ============================================================
g("UK - BT", "B", "UK", "high", [
    "btinternet.com", "btopenworld.com", "talk21.com", "btconnect.com",
], "btconnect.com = BT Business. Realne firmy tam siedza - ale sa to RÓŻNE firmy, wiec i tak nie wolno po tym mergowac.")

g("UK - Virgin Media", "B", "UK", "high", [
    "virginmedia.com", "virgin.net", "blueyonder.co.uk", "ntlworld.com", "telewest.co.uk",
])

g("UK - pozostali ISP", "B", "UK", "med", [
    "sky.com", "talktalk.net", "tiscali.co.uk", "lineone.net", "plus.net",
    "freeserve.co.uk", "wanadoo.co.uk", "fsnet.co.uk", "supanet.com", "zen.co.uk",
    "o2.co.uk", "orange.net",
], "o2.co.uk (UK, Telefonica) to INNA firma niz o2.pl (PL, WP). Nie laczyc.")

g("IE - ISP", "B", "IE", "med", ["eircom.net", "eir.ie", "iol.ie", "indigo.ie"])

# ============================================================
# GLOBAL - wielkie platformy
# ============================================================
g("Google", "A", "GLOBAL", "high", ["gmail.com", "googlemail.com"])

g("Microsoft - rdzen", "A", "GLOBAL", "high", [
    "outlook.com", "hotmail.com", "live.com", "msn.com", "passport.com", "windowslive.com",
])

g("Microsoft - warianty ccTLD", "A", "GLOBAL", "med", [
    "hotmail.co.uk", "hotmail.fr", "hotmail.de", "hotmail.it", "hotmail.es",
    "hotmail.be", "hotmail.nl", "hotmail.ch", "hotmail.at", "hotmail.dk",
    "hotmail.se", "hotmail.no", "hotmail.fi", "hotmail.gr", "hotmail.hu",
    "hotmail.cz", "hotmail.ca", "hotmail.ru", "hotmail.com.au", "hotmail.com.br",
    "hotmail.com.ar", "hotmail.com.mx", "hotmail.com.tr", "hotmail.co.jp",
    "hotmail.co.th", "hotmail.co.kr", "hotmail.co.nz", "hotmail.co.il",
    "live.co.uk", "live.fr", "live.de", "live.it", "live.nl", "live.be", "live.at",
    "live.ca", "live.cl", "live.cn", "live.dk", "live.fi", "live.ie", "live.jp",
    "live.no", "live.ru", "live.se", "live.com.au", "live.com.ar", "live.com.mx",
    "live.com.pt", "msn.de",
    "outlook.at", "outlook.be", "outlook.cl", "outlook.co.id", "outlook.co.il",
    "outlook.co.nz", "outlook.co.th", "outlook.com.au", "outlook.com.br",
    "outlook.com.gr", "outlook.com.pe", "outlook.com.tr", "outlook.com.vn",
    "outlook.cz", "outlook.de", "outlook.dk", "outlook.es", "outlook.fr",
    "outlook.hu", "outlook.ie", "outlook.in", "outlook.it", "outlook.jp",
    "outlook.kr", "outlook.lv", "outlook.my", "outlook.ph", "outlook.pt",
    "outlook.sa", "outlook.sg", "outlook.sk",
], "Ta lista NIE jest kompletna i nigdy nie bedzie - Microsoft dodaje ccTLD-y. To wlasnie po to jest regula wzorcowa `^(hotmail|outlook|live|msn)\\.<tld>$` (rozdz. 4.6).")

g("Yahoo", "A", "GLOBAL", "high", [
    "yahoo.com", "ymail.com", "rocketmail.com", "yahoo.co.uk", "yahoo.fr",
    "yahoo.de", "yahoo.it", "yahoo.es", "yahoo.ca", "yahoo.com.au", "yahoo.com.br",
    "yahoo.co.jp", "yahoo.co.in", "yahoo.in", "yahoo.com.mx", "yahoo.com.ar",
    "yahoo.gr", "yahoo.ie", "yahoo.nl", "yahoo.se", "yahoo.dk", "yahoo.no",
    "yahoo.fi", "yahoo.pl", "yahoo.cz", "yahoo.hu", "yahoo.ro", "yahoo.com.tr",
    "yahoo.co.id", "yahoo.com.sg", "yahoo.com.hk", "yahoo.com.tw", "yahoo.com.ph",
    "yahoo.com.vn", "yahoo.co.nz", "yahoo.co.th", "yahoo.com.my", "yahoo.co.kr",
    "yahoo.cn", "yahoo.com.cn", "yahoo.be", "yahoo.at", "yahoo.ch", "yahoo.pt",
    "yahoo.com.co", "yahoo.com.pe", "yahoo.com.ve", "yahoo.cl", "yahoo.co.za",
])

g("AOL", "A", "GLOBAL", "med", [
    "aol.com", "aim.com", "aol.co.uk", "aol.de", "aol.fr", "aol.it", "aol.es",
    "love.com", "games.com", "wow.com", "ygm.com", "netscape.net", "cs.com",
    "compuserve.com",
])

g("Apple", "A", "GLOBAL", "high", ["icloud.com", "me.com", "mac.com"])

g("Proton", "A", "GLOBAL", "high", ["protonmail.com", "protonmail.ch", "proton.me", "pm.me"])

g("Tuta (Tutanota)", "A", "GLOBAL", "high", [
    "tutanota.com", "tutanota.de", "tutamail.com", "tuta.io", "tuta.com", "keemail.me",
])

g("Zoho", "A", "GLOBAL", "high", ["zoho.com", "zohomail.com", "zoho.eu"],
  "UWAGA: Zoho hostuje TEZ domeny firmowe klientow. Blokujemy tylko @zoho.com/@zohomail.com - nie MX Zoho.")

g("Yandex", "A", "GLOBAL", "high", [
    "yandex.com", "yandex.ru", "yandex.by", "yandex.kz", "yandex.ua",
    "yandex.com.tr", "ya.ru", "narod.ru",
])

g("VK / Mail.ru", "A", "RU", "high", ["mail.ru", "inbox.ru", "list.ru", "bk.ru", "internet.ru", "my.com"])

g("Rambler", "A", "RU", "med", ["rambler.ru", "myrambler.ru", "autorambler.ru", "ro.ru", "lenta.ru", "r0.ru"])

g("Pozostale globalne freemail", "A", "GLOBAL", "high", [
    "mail.com", "email.com", "inbox.com", "hushmail.com", "hush.com", "hushmail.me",
    "lycos.com", "duck.com", "fastmail.com", "fastmail.fm", "gawab.com",
    "operamail.com",
])

# ---- mail.com: domeny "vanity" = najgrozniejsze false-corporate ----
g("mail.com - domeny vanity (FALSE CORPORATE!)", "A", "GLOBAL", "med", [
    "accountant.com", "activist.com", "adexec.com", "allergist.com", "alumni.com",
    "alumnidirector.com", "archaeologist.com", "arcticmail.com", "artlover.com",
    "asia.com", "atheist.com", "auctioneer.com", "bartender.net", "bikerider.com",
    "birdlover.com", "brew-master.com", "cash4u.com", "catlover.com", "chef.net",
    "chemist.com", "chinamail.com", "clerk.com", "collector.org", "columnist.com",
    "comic.com", "computer4u.com", "consultant.com", "contractor.net", "coolsite.net",
    "counsellor.com", "cutey.com", "cyber-wizard.com", "cyberdude.com", "cybergal.com",
    "cyberservices.com", "dallasmail.com", "deliveryman.com", "diplomats.com",
    "disciples.com", "doctor.com", "doglover.com", "doramail.com", "dr.com",
    "dublin.com", "earthling.net", "elvisfan.com", "engineer.com", "europe.com",
    "execs.com", "fastservice.com", "feelings.com", "financier.com", "fireman.net",
    "gardener.com", "geologist.com", "graduate.org", "graphic-designer.com",
    "greenmail.net", "groupmail.com", "hackermail.com", "hairdresser.net",
    "hot-shot.com", "iname.com", "innocent.com", "inorbit.com", "instruction.com",
    "instructor.net", "insurer.com", "irelandmail.com", "israelmail.com",
    "italymail.com", "job4u.com", "journalist.com", "keromail.com", "kissfans.com",
    "kittymail.com", "koreamail.com", "lawyer.com", "legislator.com", "linuxmail.org",
    "lobbyist.com", "lovecat.com", "madonnafan.com", "mail-me.com", "marchmail.com",
    "minister.com", "moscowmail.com", "munich.com", "musician.org", "muslim.com",
    "myself.com", "net-shopping.com", "nightmail.com", "ninfan.com", "nonpartisan.com",
    "nycmail.com", "optician.com", "orthodontist.net", "pediatrician.com",
    "petlover.com", "photographer.net", "physicist.net", "planetmail.com",
    "planetmail.net", "polandmail.com", "politician.com", "post.com", "presidency.com",
    "priest.com", "programmer.net", "publicist.com", "qualityservice.com",
    "radiologist.net", "ravemail.com", "realtyagent.com", "reggaefan.com",
    "registerednurses.com", "reincarnate.com", "religious.com", "repairman.com",
    "representative.com", "rescueteam.com", "revenue.com", "rocketship.com",
    "safrica.com", "saintly.com", "salesperson.net", "samerica.com", "sanfranmail.com",
    "scientist.com", "scotlandmail.com", "secretary.net", "seductive.com",
    "snakebite.com", "socialworker.net", "sociologist.com", "solution4u.com",
    "songwriter.net", "spainmail.com", "teachers.org", "tech-center.com", "techie.com",
    "technologist.com", "theplate.com", "therapist.net", "toke.com", "toothfairy.com",
    "tvstar.com", "umpire.com", "usa.com", "uymail.com", "webname.com", "worker.com",
    "workmail.com", "writeme.com", "cheerful.com",
], "NAJWAZNIEJSZY blok dla Twojego problemu: `consultant.com`, `lawyer.com`, `engineer.com`, `revenue.com` wygladaja jak domeny firmowe, a sa darmowymi skrzynkami mail.com. Odtworzone z pamieci, NIE zweryfikowane 1:1. Zrodlo prawdy: https://www.mail.com/mail/domains/ oraz https://tavel.net/en/2018/07/04/list-of-all-mail-com-domains/ (zrzut 190 domen).")

g("Fastmail - domeny aliasowe", "A", "GLOBAL", "med", [
    "fastmail.co.uk", "fastmail.us", "fastmail.net", "fastmail.to", "fastmail.mx",
    "fastmail.nl", "fastmail.se", "fastmail.jp", "fastmail.in", "fastmail.es",
    "fastmail.ca", "fastmail.de", "fastmail.fr", "sent.com", "sent.at", "sent.as",
    "eml.cc", "f-m.fm", "fmail.co.uk", "fmgirl.com", "fmguy.com", "mailbolt.com",
    "mailcan.com", "mailhaven.com", "mailmight.com", "ml1.net", "mm.st",
    "myfastmail.com", "proinbox.com", "promessage.com", "rushpost.com",
    "speedymail.org", "warpmail.net", "xsmail.com", "150mail.com", "150ml.com",
    "16mail.com", "2-mail.com", "4email.net", "50mail.com", "allmail.net",
    "bestmail.us", "cluemail.com", "elitemail.org", "emailcorner.net",
    "emailengine.net", "emailengine.org", "emailgroups.net", "emailplus.org",
    "emailuser.net", "fea.st", "hailmail.net", "imap-mail.com", "imap.cc",
    "imapmail.org", "inoutbox.com", "internet-e-mail.com", "internet-mail.org",
    "internetemails.net", "internetmailing.net", "jetemail.net", "letterboxes.org",
    "mail-central.com", "mail-page.com", "mailandftp.com", "mailas.com", "mailc.net",
    "mailforce.net", "mailftp.com", "mailingaddress.org", "mailite.com",
    "mailnew.com", "mailsent.net", "mailservice.ms", "mailup.net", "mailworks.org",
    "mymacmail.com", "nospammail.net", "ownmail.net", "petml.com", "postinbox.com",
    "postpro.net", "realemail.net", "reallyfast.biz", "reallyfast.info",
    "ssl-mail.com", "swift-mail.com", "the-fastest.net", "the-quickest.com",
    "theinternetemail.com", "theweb2mail.com", "yepmail.net", "your-mail.com",
], "Odtworzone z pamieci, do weryfikacji. Zrodlo prawdy: https://www.spamresource.com/2022/10/reference-all-fastmail-email-domains.html")

# ============================================================
# RESZTA EUROPY
# ============================================================
g("NL", "B", "NL", "high", [
    "chello.nl", "ziggo.nl", "upcmail.nl", "casema.nl", "home.nl", "kpnmail.nl",
    "planet.nl", "hetnet.nl", "kpnplanet.nl", "xs4all.nl", "telfort.nl", "online.nl",
    "zonnet.nl", "wanadoo.nl", "quicknet.nl", "versatel.nl", "tele2.nl", "caiway.nl",
])

g("BE", "B", "BE", "high", [
    "telenet.be", "skynet.be", "belgacom.net", "voo.be", "scarlet.be", "base.be",
    "proximus.be", "pandora.be", "tiscali.be", "edpnet.be", "swing.be",
])

g("IT", "A", "IT", "high", [
    "libero.it", "virgilio.it", "tiscali.it", "alice.it", "tin.it", "inwind.it",
    "iol.it", "blu.it", "katamail.com", "email.it", "fastwebnet.it", "teletu.it",
    "tim.it", "vodafone.it", "wind.it", "infinito.it", "supereva.it", "jumpy.it",
    "interfree.it", "tele2.it",
])

g("ES", "A", "ES", "high", [
    "terra.es", "telefonica.net", "movistar.es", "ya.com", "wanadoo.es", "orange.es",
    "jazzfree.com", "jazztel.es", "euskaltel.net", "ono.com", "retemail.es",
    "teleline.es", "eresmas.com", "mixmail.com", "latinmail.com",
])

g("PT", "A", "PT", "med", [
    "sapo.pt", "netcabo.pt", "clix.pt", "iol.pt", "oninet.pt", "meo.pt", "nos.pt",
])

g("SE", "B", "SE", "med", [
    "telia.com", "telia.se", "bredband.net", "comhem.se", "spray.se", "passagen.se",
    "swipnet.se", "tele2.se", "glocalnet.se", "home.se", "bahnhof.se",
])

g("NO", "B", "NO", "med", [
    "online.no", "broadpark.no", "start.no", "c2i.net", "chello.no", "getmail.no",
    "frisurf.no", "telenor.no", "nextgentel.no",
])

g("DK", "B", "DK", "med", [
    "mail.dk", "tdcadsl.dk", "post.tele.dk", "get2net.dk", "image.dk", "sol.dk",
    "jubii.dk", "stofanet.dk", "youmail.dk", "webspeed.dk", "privat.dk",
])

g("FI", "B", "FI", "med", [
    "luukku.com", "elisanet.fi", "kolumbus.fi", "saunalahti.fi", "suomi24.fi",
    "netti.fi", "dnainternet.net", "pp.inet.fi", "sci.fi",
])

g("CZ", "A", "CZ", "high", [
    "seznam.cz", "email.cz", "centrum.cz", "atlas.cz", "post.cz", "volny.cz",
    "quick.cz", "tiscali.cz", "chello.cz", "iol.cz", "mybox.cz",
])

g("SK", "A", "SK", "high", [
    "azet.sk", "centrum.sk", "post.sk", "zoznam.sk", "atlas.sk", "inmail.sk",
    "chello.sk", "orangemail.sk", "pobox.sk", "stonline.sk", "netlab.sk",
])

g("HU", "A", "HU", "high", [
    "freemail.hu", "citromail.hu", "indamail.hu", "vipmail.hu", "t-online.hu",
    "chello.hu", "invitel.hu", "upcmail.hu", "hu.inter.net",
])

g("RO", "B", "RO", "med", ["rdslink.ro", "clicknet.ro", "home.ro", "personal.ro"])

g("BG", "A", "BG", "high", ["abv.bg", "mail.bg", "dir.bg", "gbg.bg", "techno-link.com"])

g("GR", "A", "GR", "med", ["otenet.gr", "hol.gr", "in.gr", "freemail.gr", "forthnet.gr"])

g("LT", "A", "LT", "med", ["one.lt", "takas.lt", "delfi.lt", "centras.lt", "zebra.lt", "mail.lt", "inbox.lt"])

g("LV", "A", "LV", "med", ["inbox.lv", "apollo.lv", "delfi.lv", "one.lv", "tvnet.lv", "latnet.lv", "navigator.lv"])

g("EE", "A", "EE", "med", ["mail.ee", "hot.ee", "online.ee", "neti.ee", "starman.ee"])

g("UA", "A", "UA", "high", ["ukr.net", "i.ua", "meta.ua", "bigmir.net", "online.ua"])

g("BY", "A", "BY", "med", ["tut.by", "mail.by", "open.by"])

g("HR / SI / RS", "A", "EU-SE", "med", [
    "net.hr", "inet.hr", "vip.hr", "siol.net", "volja.net", "telemach.net", "eunet.rs",
])

g("TR", "A", "TR", "med", ["mynet.com", "superonline.com", "ttmail.com"])

# ============================================================
# RESZTA SWIATA (EN + APAC + LATAM)
# ============================================================
g("US - ISP (dual-use)", "B", "US", "high", [
    "comcast.net", "verizon.net", "att.net", "sbcglobal.net", "bellsouth.net",
    "cox.net", "charter.net", "earthlink.net", "juno.com", "netzero.net",
    "optonline.net", "roadrunner.com", "rr.com", "windstream.net", "frontier.com",
    "centurylink.net", "embarqmail.com", "mchsi.com", "wowway.com", "suddenlink.net",
    "cableone.net", "mindspring.com", "prodigy.net", "pacbell.net", "ameritech.net",
    "swbell.net", "flash.net", "twc.com", "insightbb.com", "ptd.net", "epix.net",
    "metrocast.net", "atlanticbb.net", "gci.net",
])

g("CA - ISP (dual-use)", "B", "CA", "med", [
    "shaw.ca", "rogers.com", "sympatico.ca", "videotron.ca", "bell.net",
    "telus.net", "cogeco.ca", "eastlink.ca",
])

g("AU / NZ - ISP (dual-use)", "B", "AU/NZ", "med", [
    "bigpond.com", "bigpond.net.au", "optusnet.com.au", "iinet.net.au",
    "tpg.com.au", "internode.on.net", "xtra.co.nz",
])

g("CN", "A", "CN", "high", [
    "qq.com", "163.com", "126.com", "sina.com", "sina.cn", "sohu.com",
    "yeah.net", "foxmail.com", "aliyun.com", "21cn.com", "tom.com",
])

g("JP / KR", "A", "JP/KR", "med", [
    "naver.com", "daum.net", "hanmail.net", "nate.com", "ezweb.ne.jp",
    "docomo.ne.jp", "softbank.ne.jp", "nifty.com", "biglobe.ne.jp", "ocn.ne.jp",
])

g("IN", "A", "IN", "med", ["rediffmail.com", "sify.com", "indiatimes.com"])

g("BR / LATAM", "A", "LATAM", "med", [
    "uol.com.br", "bol.com.br", "ig.com.br", "terra.com.br", "globo.com",
    "globomail.com", "oi.com.br", "zipmail.com.br", "prodigy.net.mx",
])

g("ZA / MEA", "A", "MEA", "med", ["mweb.co.za", "telkomsa.net", "webmail.co.za"])


# ============================================================
# WZORCE (opcjonalne, anchored)
# ============================================================
PATTERNS = [
    {"re": r"^(hotmail|outlook|live|msn)\.[a-z]{2,3}(\.[a-z]{2,3})?$", "provider": "microsoft", "tier": "A"},
    {"re": r"^(yahoo|ymail|rocketmail)\.[a-z]{2,3}(\.[a-z]{2,3})?$", "provider": "yahoo", "tier": "A"},
    {"re": r"^gmx\.[a-z]{2,3}(\.[a-z]{2,3})?$", "provider": "gmx", "tier": "A"},
    {"re": r"^fastmail\.[a-z]{2,3}(\.[a-z]{2,3})?$", "provider": "fastmail", "tier": "A"},
    {"re": r"^yandex\.[a-z]{2,3}(\.[a-z]{2,3})?$", "provider": "yandex", "tier": "A"},
    {"re": r"^interia\.(pl|eu|com)$", "provider": "interia", "tier": "A"},
    {"re": r"^(protonmail|proton)\.(com|ch|me)$", "provider": "proton", "tier": "A"},
    {"re": r"^(tutanota|tutamail|tuta)\.(com|de|io)$", "provider": "tuta", "tier": "A"},
]

# Domeny, ktorych NIGDY nie wolno dodac (korporacyjne blizniaki domen konsumenckich)
NEVER_BLOCK = [
    "google.com", "microsoft.com", "apple.com", "orange.com", "telekom.de",
    "vodafone.com", "bt.com", "t-mobile.com", "sfr.com", "telefonica.com",
    "proximus.com", "telia.se.corp",
]
NEVER_BLOCK = [d for d in NEVER_BLOCK if d != "telia.se.corp"]

# Subdomeny, ktore po normalizacji PSL kolapsuja do eTLD+1
PSL_COLLAPSE = {
    "poczta.wp.pl": "wp.pl",
    "poczta.onet.pl": "onet.pl",
    "poczta.onet.eu": "onet.eu",
    "vip.interia.pl": "interia.pl",
    "post.tele.dk": "tele.dk",
    "pp.inet.fi": "inet.fi",
    "internode.on.net": "on.net",
    "hu.inter.net": "inter.net",
}

# ============================================================
# BUILD
# ============================================================
domains = {}
dupes = collections.defaultdict(list)
for grp in GROUPS:
    for d in grp["domains"]:
        d = d.strip().lower()
        if d in domains:
            dupes[d].append(grp["provider"])
            continue
        entry = {"p": grp["provider"], "t": grp["tier"], "r": grp["region"], "c": grp["conf"]}
        if d in PSL_COLLAPSE:
            entry["psl_collapses_to"] = PSL_COLLAPSE[d]
        domains[d] = entry

# sanity: kazda domena musi wygladac jak domena
bad = [d for d in domains if not re.match(r"^[a-z0-9]([a-z0-9\-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9\-]*[a-z0-9])?)+$", d)]
# sanity: never_block nie moze byc w domains
conflict = [d for d in NEVER_BLOCK if d in domains]
# sanity: wzorce sie kompiluja i nie lapia never_block
for p in PATTERNS:
    rx = re.compile(p["re"])
    for nb in NEVER_BLOCK:
        assert not rx.match(nb), f"pattern {p['re']} lapie never_block {nb}"

CANARY = ["acme.com", "livechat.com", "livechatinc.com", "terravita.pl", "claims.com",
          "home.com", "protonet.de", "orange.com", "telekom.de", "msnbc.com", "deliveroo.co.uk"]
canary_hits = [c for c in CANARY if c in domains or any(re.match(p["re"], c) for p in PATTERNS)]

out_json = {
    "schema": "owocni/free_mail_domains/v1",
    "version": VERSION,
    "generated": GENERATED,
    "purpose": "Domeny, dla ktorych CRM NIE ustawia company_domain_key (zakaz auto-mintowania/laczenia firmy po domenie e-maila).",
    "usage": "is_free_mail(domain_reg) := domain_reg in domains OR any(pattern.match(domain_reg)). Wejscie MUSI byc juz znormalizowane do eTLD+1 przez Public Suffix List.",
    "tiers": {
        "A": "czysty freemail/portal - blokada twarda, ryzyko false-positive ~zero",
        "B": "ISP/telco/hosting - domena dual-use (abonenci + pracownicy operatora); blokujemy mimo to, patrz rozdz. 2 i 7.1"
    },
    "confidence": {
        "high": "pewne",
        "med": "prawdopodobne, odtworzone z pamieci - zweryfikuj przed uzyciem krytycznym",
        "low": "niepewne, moze juz nie istniec - zostawione bo martwa domena w denyliscie nie szkodzi"
    },
    "never_block": NEVER_BLOCK,
    "patterns_optional": True,
    "patterns": PATTERNS,
    "count": len(domains),
    "domains": dict(sorted(domains.items())),
}

OUT_DIR = Path(__file__).resolve().parents[2] / "owocni-crm" / "data"
OUT_DIR.mkdir(parents=True, exist_ok=True)
RUNTIME_DIR = Path(__file__).resolve().parents[1] / "shared" / "data"
RUNTIME_DIR.mkdir(parents=True, exist_ok=True)
CF_INBOUND_DATA = (
    Path(__file__).resolve().parents[1]
    / "cloud-functions"
    / "twenty-inbound-webhook"
    / "shared"
    / "data"
)
CF_INBOUND_DATA.mkdir(parents=True, exist_ok=True)

json_text = json.dumps(out_json, ensure_ascii=False, indent=1, sort_keys=False)
for dest in (OUT_DIR, RUNTIME_DIR, CF_INBOUND_DATA):
    with open(dest / "free_mail_domains_v1.json", "w", encoding="utf-8") as f:
        f.write(json_text)

with open(OUT_DIR / "free_mail_domains_v1.txt", "w", encoding="utf-8") as f:
    f.write("# owocni/free_mail_domains v%s (%s) - %d domen\n" % (VERSION, GENERATED, len(domains)))
    f.write("# Wejscie musi byc znormalizowane do eTLD+1 (Public Suffix List). Szczegoly: SSOT_free-mail-domains_v1.md\n")
    for d in sorted(domains):
        f.write(d + "\n")

# raport
by_tier = collections.Counter(v["t"] for v in domains.values())
by_conf = collections.Counter(v["c"] for v in domains.values())
by_region = collections.Counter(v["r"] for v in domains.values())

print("TOTAL:", len(domains))
print("TIER:", dict(by_tier))
print("CONF:", dict(by_conf))
print("REGION:", dict(sorted(by_region.items(), key=lambda x: -x[1])))
print("DUPLIKATY (pominiete):", dict(dupes) if dupes else "brak")
print("ZLE SFORMATOWANE:", bad if bad else "brak")
print("KONFLIKT z never_block:", conflict if conflict else "brak")
print("CANARY (musi byc puste):", canary_hits if canary_hits else "brak - OK")
print("GRUP:", len(GROUPS))

# zapisz statystyki dla generatora md
print("WROTE:", OUT_DIR / "free_mail_domains_v1.json")
print("WROTE:", OUT_DIR / "free_mail_domains_v1.txt")
