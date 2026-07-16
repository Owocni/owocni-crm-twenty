// SORTOWNIA V2 — Stape (slim: bez komentarzy/DEBUG, limit 200KB). Pełna wersja w git history.
const sendHttpRequest = require("sendHttpRequest");
const JSON = require("JSON");
const generateRandom = require("generateRandom");
const logToConsole = require("logToConsole");
const getTimestampMillis = require("getTimestampMillis");
const makeString = require("makeString");
const getEventData = require("getEventData");
const encodeUriComponent = require("encodeUriComponent");
const setCookie = require("setCookie");
const getCookieValues = require("getCookieValues");

// === FREE_MAIL_SHIELD_BEGIN (exact match SSOT v1 — do not use substring) ===
var FREE_MAIL_EXACT = {"10g.pl":1,"126.com":1,"150mail.com":1,"150ml.com":1,"163.com":1,"16mail.com":1,"1gb.pl":1,"2-mail.com":1,"21cn.com":1,"4email.net":1,"50mail.com":1,"9online.fr":1,"a1.net":1,"abv.bg":1,"accountant.com":1,"activist.com":1,"adexec.com":1,"adresik.net":1,"aim.com":1,"akcja.pl":1,"alice.fr":1,"alice.it":1,"aliceadsl.fr":1,"aliyun.com":1,"allergist.com":1,"allmail.net":1,"alumni.com":1,"alumnidirector.com":1,"ameritech.net":1,"amorki.pl":1,"aol.co.uk":1,"aol.com":1,"aol.de":1,"aol.es":1,"aol.fr":1,"aol.it":1,"aon.at":1,"apollo.lv":1,"archaeologist.com":1,"arcor.de":1,"arcticmail.com":1,"artlover.com":1,"asia.com":1,"aster.pl":1,"astercity.net":1,"atheist.com":1,"atlanticbb.net":1,"atlas.cz":1,"atlas.sk":1,"att.net":1,"auctioneer.com":1,"autograf.pl":1,"autorambler.ru":1,"az.pl":1,"azet.sk":1,"bahnhof.se":1,"bartender.net":1,"base.be":1,"bbox.fr":1,"belgacom.net":1,"bell.net":1,"bellsouth.net":1,"bestmail.us":1,"biglobe.ne.jp":1,"bigmir.net":1,"bigpond.com":1,"bigpond.net.au":1,"bikerider.com":1,"birdlover.com":1,"bk.ru":1,"blu.it":1,"bluemail.ch":1,"bluewin.ch":1,"blueyonder.co.uk":1,"bol.com.br":1,"box43.pl":1,"bredband.net":1,"brew-master.com":1,"broadpark.no":1,"btconnect.com":1,"btinternet.com":1,"btopenworld.com":1,"buziaczek.pl":1,"c2i.net":1,"cableone.net":1,"caiway.nl":1,"caramail.com":1,"caramail.fr":1,"casema.nl":1,"cash4u.com":1,"catlover.com":1,"cegetel.net":1,"centras.lt":1,"centrum.cz":1,"centrum.sk":1,"centurylink.net":1,"charter.net":1,"cheerful.com":1,"chef.net":1,"chello.at":1,"chello.cz":1,"chello.hu":1,"chello.nl":1,"chello.no":1,"chello.pl":1,"chello.sk":1,"chemist.com":1,"chez.com":1,"chinamail.com":1,"citromail.hu":1,"clerk.com":1,"clicknet.ro":1,"clix.pt":1,"club-internet.fr":1,"cluemail.com":1,"cmoki.pl":1,"cogeco.ca":1,"collector.org":1,"columnist.com":1,"comcast.net":1,"comhem.se":1,"comic.com":1,"compuserve.com":1,"computer4u.com":1,"consultant.com":1,"contractor.net":1,"coolsite.net":1,"counsellor.com":1,"cox.net":1,"cs.com":1,"cutey.com":1,"cyber-wizard.com":1,"cyberdude.com":1,"cybergal.com":1,"cyberservices.com":1,"dallasmail.com":1,"daum.net":1,"delfi.lt":1,"delfi.lv":1,"deliveryman.com":1,"dialog.pl":1,"diplomats.com":1,"dir.bg":1,"disciples.com":1,"dnainternet.net":1,"dobramama.pl":1,"dobrytata.pl":1,"docomo.ne.jp":1,"doctor.com":1,"doglover.com":1,"doramail.com":1,"dr.com":1,"dublin.com":1,"duck.com":1,"earthling.net":1,"earthlink.net":1,"eastlink.ca":1,"edpnet.be":1,"eir.ie":1,"eircom.net":1,"elisanet.fi":1,"elitemail.org":1,"elvisfan.com":1,"email.com":1,"email.cz":1,"email.it":1,"emailcorner.net":1,"emailengine.net":1,"emailengine.org":1,"emailgroups.net":1,"emailplus.org":1,"emailuser.net":1,"embarqmail.com":1,"eml.cc":1,"engineer.com":1,"epix.net":1,"era.pl":1,"eresmas.com":1,"eunet.rs":1,"europe.com":1,"euskaltel.net":1,"ewetel.net":1,"execs.com":1,"ezweb.ne.jp":1,"f-m.fm":1,"fajne.to":1,"fastmail.ca":1,"fastmail.co.uk":1,"fastmail.com":1,"fastmail.de":1,"fastmail.es":1,"fastmail.fm":1,"fastmail.fr":1,"fastmail.in":1,"fastmail.jp":1,"fastmail.mx":1,"fastmail.net":1,"fastmail.nl":1,"fastmail.se":1,"fastmail.to":1,"fastmail.us":1,"fastservice.com":1,"fastwebnet.it":1,"fea.st":1,"feelings.com":1,"fejm.pl":1,"financier.com":1,"fireman.net":1,"flash.net":1,"fmail.co.uk":1,"fmgirl.com":1,"fmguy.com":1,"forthnet.gr":1,"foxmail.com":1,"free.fr":1,"freemail.gr":1,"freemail.hu":1,"freenet.de":1,"freeserve.co.uk":1,"freesurf.ch":1,"freesurf.fr":1,"frisurf.no":1,"frontier.com":1,"fsnet.co.uk":1,"games.com":1,"gardener.com":1,"gawab.com":1,"gazeta.pl":1,"gbg.bg":1,"gci.net":1,"geologist.com":1,"get2net.dk":1,"getmail.no":1,"globo.com":1,"globomail.com":1,"glocalnet.se":1,"gmail.com":1,"gmx.at":1,"gmx.biz":1,"gmx.ch":1,"gmx.co.uk":1,"gmx.com":1,"gmx.de":1,"gmx.eu":1,"gmx.fr":1,"gmx.info":1,"gmx.li":1,"gmx.net":1,"gmx.org":1,"gmx.tm":1,"gmx.us":1,"go2.pl":1,"googlemail.com":1,"graduate.org":1,"graphic-designer.com":1,"greenmail.net":1,"groupmail.com":1,"hackermail.com":1,"hailmail.net":1,"hairdresser.net":1,"hanmail.net":1,"hetnet.nl":1,"hispeed.ch":1,"hoga.pl":1,"hol.gr":1,"home.nl":1,"home.pl":1,"home.ro":1,"home.se":1,"hot-shot.com":1,"hot.ee":1,"hotmail.at":1,"hotmail.be":1,"hotmail.ca":1,"hotmail.ch":1,"hotmail.co.il":1,"hotmail.co.jp":1,"hotmail.co.kr":1,"hotmail.co.nz":1,"hotmail.co.th":1,"hotmail.co.uk":1,"hotmail.com":1,"hotmail.com.ar":1,"hotmail.com.au":1,"hotmail.com.br":1,"hotmail.com.mx":1,"hotmail.com.tr":1,"hotmail.cz":1,"hotmail.de":1,"hotmail.dk":1,"hotmail.es":1,"hotmail.fi":1,"hotmail.fr":1,"hotmail.gr":1,"hotmail.hu":1,"hotmail.it":1,"hotmail.nl":1,"hotmail.no":1,"hotmail.ru":1,"hotmail.se":1,"htp-tel.de":1,"hu.inter.net":1,"hush.com":1,"hushmail.com":1,"hushmail.me":1,"i.ua":1,"icloud.com":1,"icpnet.pl":1,"ifrance.com":1,"ig.com.br":1,"iinet.net.au":1,"image.dk":1,"imap-mail.com":1,"imap.cc":1,"imapmail.org":1,"in.gr":1,"iname.com":1,"inbox.com":1,"inbox.lt":1,"inbox.lv":1,"inbox.ru":1,"indamail.hu":1,"indiatimes.com":1,"indigo.ie":1,"inea.pl":1,"inet.hr":1,"infinito.it":1,"infonie.fr":1,"inmail.sk":1,"innocent.com":1,"inode.at":1,"inorbit.com":1,"inoutbox.com":1,"insightbb.com":1,"instruction.com":1,"instructor.net":1,"insurer.com":1,"int.pl":1,"interfree.it":1,"interia.com":1,"interia.eu":1,"interia.pl":1,"interiowy.pl":1,"internet-e-mail.com":1,"internet-mail.org":1,"internet.ru":1,"internetemails.net":1,"internetia.pl":1,"internetmailing.net":1,"internode.on.net":1,"intmail.pl":1,"invitel.hu":1,"inwind.it":1,"iol.cz":1,"iol.ie":1,"iol.it":1,"iol.pt":1,"irelandmail.com":1,"israelmail.com":1,"italymail.com":1,"jadamspam.pl":1,"jazzfree.com":1,"jazztel.es":1,"jetemail.net":1,"job4u.com":1,"journalist.com":1,"jubii.dk":1,"jumpy.it":1,"juno.com":1,"kabelmail.de":1,"kabsi.at":1,"katamail.com":1,"keemail.me":1,"keromail.com":1,"kissfans.com":1,"kittymail.com":1,"kolumbus.fi":1,"koreamail.com":1,"kozacki.pl":1,"kpnmail.nl":1,"kpnplanet.nl":1,"laposte.net":1,"latinmail.com":1,"latnet.lv":1,"lawyer.com":1,"legislator.com":1,"lenta.ru":1,"letterboxes.org":1,"libero.it":1,"libertysurf.fr":1,"lineone.net":1,"linuxmail.org":1,"list.ru":1,"live.at":1,"live.be":1,"live.ca":1,"live.cl":1,"live.cn":1,"live.co.uk":1,"live.com":1,"live.com.ar":1,"live.com.au":1,"live.com.mx":1,"live.com.pt":1,"live.de":1,"live.dk":1,"live.fi":1,"live.fr":1,"live.ie":1,"live.it":1,"live.jp":1,"live.nl":1,"live.no":1,"live.ru":1,"live.se":1,"liwest.at":1,"lobbyist.com":1,"love.com":1,"lovecat.com":1,"luukku.com":1,"lycos.com":1,"lycos.de":1,"lycos.fr":1,"lykamspam.pl":1,"mac.com":1,"madonnafan.com":1,"mageos.com":1,"mail-central.com":1,"mail-me.com":1,"mail-page.com":1,"mail.bg":1,"mail.by":1,"mail.com":1,"mail.de":1,"mail.dk":1,"mail.ee":1,"mail.lt":1,"mail.ru":1,"mailandftp.com":1,"mailas.com":1,"mailbolt.com":1,"mailbox.org":1,"mailc.net":1,"mailcan.com":1,"mailforce.net":1,"mailftp.com":1,"mailhaven.com":1,"mailingaddress.org":1,"mailite.com":1,"mailmight.com":1,"mailmix.pl":1,"mailnew.com":1,"mailplus.pl":1,"mailsent.net":1,"mailservice.ms":1,"mailup.net":1,"mailworks.org":1,"marchmail.com":1,"mchsi.com":1,"me.com":1,"meo.pt":1,"meta.ua":1,"metrocast.net":1,"mindspring.com":1,"minister.com":1,"mixbox.pl":1,"mixmail.com":1,"ml1.net":1,"mm.st":1,"moscowmail.com":1,"movistar.es":1,"msn.com":1,"msn.de":1,"multimania.fr":1,"multimedia.pl":1,"munich.com":1,"musician.org":1,"muslim.com":1,"mweb.co.za":1,"my.com":1,"mybox.cz":1,"myfastmail.com":1,"mymacmail.com":1,"mynet.com":1,"myrambler.ru":1,"myself.com":1,"narod.ru":1,"nate.com":1,"naver.com":1,"navigator.lv":1,"nazwa.pl":1,"neostrada.pl":1,"net-shopping.com":1,"net.hr":1,"netcabo.pt":1,"netcologne.de":1,"netcourrier.com":1,"neti.ee":1,"netia.pl":1,"netlab.sk":1,"netscape.net":1,"netti.fi":1,"netzero.net":1,"neuf.fr":1,"nexgo.de":1,"nextgentel.no":1,"nifty.com":1,"nightmail.com":1,"ninfan.com":1,"nomade.fr":1,"nonpartisan.com":1,"noos.fr":1,"nordnet.fr":1,"nos.pt":1,"nospammail.net":1,"notowany.pl":1,"ntlworld.com":1,"numericable.fr":1,"nycmail.com":1,"o2.co.uk":1,"o2.pl":1,"ocn.ne.jp":1,"ogarnij.se":1,"oi.com.br":1,"one.lt":1,"one.lv":1,"onet.com.pl":1,"onet.eu":1,"onet.pl":1,"oninet.pt":1,"online.de":1,"online.ee":1,"online.nl":1,"online.no":1,"online.ua":1,"ono.com":1,"op.pl":1,"open.by":1,"operamail.com":1,"opoczta.pl":1,"optician.com":1,"optonline.net":1,"optusnet.com.au":1,"orange.es":1,"orange.fr":1,"orange.net":1,"orange.pl":1,"orangemail.sk":1,"orthodontist.net":1,"os.pl":1,"osnanet.de":1,"otenet.gr":1,"outlook.at":1,"outlook.be":1,"outlook.cl":1,"outlook.co.id":1,"outlook.co.il":1,"outlook.co.nz":1,"outlook.co.th":1,"outlook.com":1,"outlook.com.au":1,"outlook.com.br":1,"outlook.com.gr":1,"outlook.com.pe":1,"outlook.com.tr":1,"outlook.com.vn":1,"outlook.cz":1,"outlook.de":1,"outlook.dk":1,"outlook.es":1,"outlook.fr":1,"outlook.hu":1,"outlook.ie":1,"outlook.in":1,"outlook.it":1,"outlook.jp":1,"outlook.kr":1,"outlook.lv":1,"outlook.my":1,"outlook.ph":1,"outlook.pt":1,"outlook.sa":1,"outlook.sg":1,"outlook.sk":1,"ownmail.net":1,"pacbell.net":1,"pacz.to":1,"pandora.be":1,"passagen.se":1,"passport.com":1,"pediatrician.com":1,"personal.ro":1,"petlover.com":1,"petml.com":1,"pf.pl":1,"photographer.net":1,"physicist.net":1,"pisz.to":1,"planet.nl":1,"planetmail.com":1,"planetmail.net":1,"plus.net":1,"plus.pl":1,"plusnet.pl":1,"pm.me":1,"pobox.sk":1,"poczta.fm":1,"poczta.onet.eu":1,"poczta.onet.pl":1,"poczta.pl":1,"poczta.wp.pl":1,"polandmail.com":1,"politician.com":1,"post.com":1,"post.cz":1,"post.sk":1,"post.tele.dk":1,"posteo.de":1,"posteo.net":1,"postinbox.com":1,"postpro.net":1,"pp.inet.fi":1,"presidency.com":1,"priest.com":1,"priv.pl":1,"privat.dk":1,"prodigy.net":1,"prodigy.net.mx":1,"programmer.net":1,"proinbox.com":1,"prokonto.pl":1,"promessage.com":1,"proton.me":1,"protonmail.ch":1,"protonmail.com":1,"proximus.be":1,"ptd.net":1,"publicist.com":1,"qq.com":1,"qualityservice.com":1,"quick.cz":1,"quicknet.nl":1,"r0.ru":1,"radiologist.net":1,"rambler.ru":1,"ravemail.com":1,"rdslink.ro":1,"realemail.net":1,"reallyfast.biz":1,"reallyfast.info":1,"realtyagent.com":1,"rediffmail.com":1,"reggaefan.com":1,"registerednurses.com":1,"reincarnate.com":1,"religious.com":1,"repairman.com":1,"representative.com":1,"rescueteam.com":1,"retemail.es":1,"revenue.com":1,"ro.ru":1,"roadrunner.com":1,"rocketmail.com":1,"rocketship.com":1,"rogers.com":1,"romantyczka.pl":1,"rr.com":1,"rubikon.pl":1,"rushpost.com":1,"safrica.com":1,"saintly.com":1,"salesperson.net":1,"samerica.com":1,"sanfranmail.com":1,"sapo.pt":1,"satfilm.pl":1,"saunalahti.fi":1,"sbcglobal.net":1,"scarlet.be":1,"sci.fi":1,"scientist.com":1,"scotlandmail.com":1,"secretary.net":1,"seductive.com":1,"sent.as":1,"sent.at":1,"sent.com":1,"serwus.pl":1,"seznam.cz":1,"sferia.pl":1,"sfr.fr":1,"shaw.ca":1,"sify.com":1,"sina.cn":1,"sina.com":1,"siol.net":1,"sky.com":1,"skynet.be":1,"snakebite.com":1,"socialworker.net":1,"sociologist.com":1,"softbank.ne.jp":1,"sohu.com":1,"sol.dk":1,"solution4u.com":1,"songwriter.net":1,"spainmail.com":1,"speedymail.org":1,"spoko.pl":1,"spray.pl":1,"spray.se":1,"ssl-mail.com":1,"starman.ee":1,"start.no":1,"stofanet.dk":1,"stonline.sk":1,"student.pl":1,"suddenlink.net":1,"sunrise.ch":1,"suomi24.fi":1,"supanet.com":1,"superbox.pl":1,"supereva.it":1,"superonline.com":1,"swbell.net":1,"swift-mail.com":1,"swing.be":1,"swipnet.se":1,"swissonline.ch":1,"sympatico.ca":1,"szeptem.pl":1,"t-mobile.pl":1,"t-online.de":1,"t-online.hu":1,"takas.lt":1,"talk21.com":1,"talktalk.net":1,"tdcadsl.dk":1,"teachers.org":1,"tech-center.com":1,"techie.com":1,"techno-link.com":1,"technologist.com":1,"tele2.fr":1,"tele2.it":1,"tele2.nl":1,"tele2.se":1,"telefonica.net":1,"teleline.es":1,"telemach.net":1,"telenet.be":1,"telenor.no":1,"teletu.it":1,"telewest.co.uk":1,"telfort.nl":1,"telia.com":1,"telia.se":1,"telkomsa.net":1,"telus.net":1,"tenbit.pl":1,"terra.com.br":1,"terra.es":1,"the-fastest.net":1,"the-quickest.com":1,"theinternetemail.com":1,"theplate.com":1,"therapist.net":1,"theweb2mail.com":1,"tim.it":1,"tin.it":1,"tiscali.be":1,"tiscali.co.uk":1,"tiscali.cz":1,"tiscali.fr":1,"tiscali.it":1,"tlen.pl":1,"toke.com":1,"tom.com":1,"toothfairy.com":1,"toya.net.pl":1,"toya.pl":1,"tpg.com.au":1,"ttmail.com":1,"tut.by":1,"tuta.com":1,"tuta.io":1,"tutamail.com":1,"tutanota.com":1,"tutanota.de":1,"tvnet.lv":1,"tvstar.com":1,"twc.com":1,"ukr.net":1,"umpire.com":1,"unitybox.de":1,"uol.com.br":1,"upc.com.pl":1,"upcmail.hu":1,"upcmail.nl":1,"upcpoczta.pl":1,"usa.com":1,"utanet.at":1,"uymail.com":1,"vectra.pl":1,"verizon.net":1,"versanet.de":1,"versatel.nl":1,"videotron.ca":1,"vip.hr":1,"vip.interia.pl":1,"vipmail.hu":1,"virgilio.it":1,"virgin.net":1,"virginmedia.com":1,"vodafone.de":1,"vodafone.it":1,"voila.fr":1,"volja.net":1,"volny.cz":1,"voo.be":1,"vp.pl":1,"vtxnet.ch":1,"wanadoo.co.uk":1,"wanadoo.es":1,"wanadoo.fr":1,"wanadoo.nl":1,"warpmail.net":1,"web.de":1,"webmail.co.za":1,"webname.com":1,"webspeed.dk":1,"wind.it":1,"windowslive.com":1,"windstream.net":1,"wir.pl":1,"worker.com":1,"workmail.com":1,"worldonline.fr":1,"wow.com":1,"wowway.com":1,"wp.eu":1,"wp.pl":1,"writeme.com":1,"xboxer.pl":1,"xs4all.nl":1,"xsmail.com":1,"xtra.co.nz":1,"ya.com":1,"ya.ru":1,"yahoo.at":1,"yahoo.be":1,"yahoo.ca":1,"yahoo.ch":1,"yahoo.cl":1,"yahoo.cn":1,"yahoo.co.id":1,"yahoo.co.in":1,"yahoo.co.jp":1,"yahoo.co.kr":1,"yahoo.co.nz":1,"yahoo.co.th":1,"yahoo.co.uk":1,"yahoo.co.za":1,"yahoo.com":1,"yahoo.com.ar":1,"yahoo.com.au":1,"yahoo.com.br":1,"yahoo.com.cn":1,"yahoo.com.co":1,"yahoo.com.hk":1,"yahoo.com.mx":1,"yahoo.com.my":1,"yahoo.com.pe":1,"yahoo.com.ph":1,"yahoo.com.sg":1,"yahoo.com.tr":1,"yahoo.com.tw":1,"yahoo.com.ve":1,"yahoo.com.vn":1,"yahoo.cz":1,"yahoo.de":1,"yahoo.dk":1,"yahoo.es":1,"yahoo.fi":1,"yahoo.fr":1,"yahoo.gr":1,"yahoo.hu":1,"yahoo.ie":1,"yahoo.in":1,"yahoo.it":1,"yahoo.nl":1,"yahoo.no":1,"yahoo.pl":1,"yahoo.pt":1,"yahoo.ro":1,"yahoo.se":1,"yandex.by":1,"yandex.com":1,"yandex.com.tr":1,"yandex.kz":1,"yandex.ru":1,"yandex.ua":1,"yeah.net":1,"yepmail.net":1,"ygm.com":1,"ymail.com":1,"youmail.dk":1,"your-mail.com":1,"zebra.lt":1,"zen.co.uk":1,"ziggo.nl":1,"zipmail.com.br":1,"zoho.com":1,"zoho.eu":1,"zohomail.com":1,"zonnet.nl":1,"zoznam.sk":1};
var FREE_MAIL_NEVER_BLOCK = {"apple.com":1,"bt.com":1,"google.com":1,"microsoft.com":1,"orange.com":1,"proximus.com":1,"sfr.com":1,"t-mobile.com":1,"telefonica.com":1,"telekom.de":1,"vodafone.com":1};
function freeMailRegistrableDomain(domain) {
  if (!domain) return null;
  var d = String(domain).toLowerCase().trim();
  var parts = d.split(".").filter(Boolean);
  if (parts.length < 2) return d;
  var multi = {
    "co.uk": 1, "com.au": 1, "com.br": 1, "com.pl": 1, "net.pl": 1,
    "com.mx": 1, "com.tr": 1, "com.ar": 1, "co.jp": 1, "co.nz": 1,
    "co.il": 1, "co.th": 1, "co.kr": 1, "co.id": 1, "com.cn": 1,
    "com.hk": 1, "com.sg": 1, "com.tw": 1, "com.ph": 1, "com.vn": 1,
    "com.pe": 1, "com.ve": 1, "com.co": 1, "com.my": 1, "com.gr": 1,
    "ne.jp": 1, "on.net": 1
  };
  var last2 = parts.slice(-2).join(".");
  if (multi[last2] && parts.length >= 3) return parts.slice(-3).join(".");
  return last2;
}
function companyDomainKeyFromEmail(rawEmail) {
  if (!rawEmail) return null;
  var s = String(rawEmail).trim().toLowerCase().replace(/\s+/g, "");
  var at = s.lastIndexOf("@");
  if (at < 1 || s.indexOf("@") !== at) return null;
  var domain = s.substring(at + 1);
  if (!domain || domain.indexOf(" ") >= 0 || domain.charAt(0) === "." || domain.charAt(domain.length - 1) === ".") return null;
  if (domain === "googlemail.com") domain = "gmail.com";
  var reg = freeMailRegistrableDomain(domain);
  if (!reg) return null;
  if (FREE_MAIL_NEVER_BLOCK[reg]) return reg;
  if (FREE_MAIL_EXACT[reg]) return null;
  return reg;
}
// === FREE_MAIL_SHIELD_END ===

function extractEventParamValue(v) {
  if (!v || typeof v !== "object") return undefined;
  if (v.stringValue !== undefined && v.stringValue !== null)
    return v.stringValue;
  if (v.string_value !== undefined && v.string_value !== null)
    return v.string_value;
  if (v.intValue !== undefined && v.intValue !== null)
    return makeString(v.intValue);
  if (v.int_value !== undefined && v.int_value !== null)
    return makeString(v.int_value);
  if (v.doubleValue !== undefined && v.doubleValue !== null)
    return makeString(v.doubleValue);
  if (v.double_value !== undefined && v.double_value !== null)
    return makeString(v.double_value);
  return undefined;
}

function getEventParamFromEventParams(key) {
  var eventParams = getEventData("event_params");
  if (!eventParams) return undefined;
  if (typeof eventParams === "object" && eventParams[key] !== undefined) {
    var direct = eventParams[key];
    if (direct && typeof direct === "object") {
      return extractEventParamValue(direct);
    }
    return direct;
  }
  if (typeof eventParams.length === "number") {
    var i = 0;
    while (i < eventParams.length) {
      var item = eventParams[i];
      if (item && item.key === key && item.value) {
        return extractEventParamValue(item.value);
      }
      i = i + 1;
    }
  }
  return undefined;
}

function normalizeEmailForEnv(email) {
  if (!email) return "";
  return makeString(email).toLowerCase().trim();
}

function isSandboxTestEmail(email) {
  var normalized = normalizeEmailForEnv(email);
  if (!normalized) return false;
  var suffixes = ["@fastman.eu", "@example.com"];
  var i = 0;
  while (i < suffixes.length) {
    var sfx = suffixes[i];
    if (normalized.indexOf(sfx) === normalized.length - sfx.length) {
      return true;
    }
    i = i + 1;
  }
  return false;
}

function resolveTaskEnvironment(bizEmail) {
  var raw =
    getEventDataWithFallback("environment") ||
    getEventDataWithFallback("runtime_environment");
  if (!raw && data && data.runtimeEnvironment) {
    raw = data.runtimeEnvironment;
  }
  if (raw) {
    var norm = makeString(raw).toLowerCase().trim();
    return norm === "sandbox" ? "sandbox" : "prod";
  }
  if (isSandboxTestEmail(bizEmail)) {
    logToConsole(
      "SORTOWNIA: environment=sandbox (test email domain):",
      bizEmail,
    );
    return "sandbox";
  }
  return "prod";
}

function resolveCtxIpAddress(fallbackFromProfile) {
  var ip =
    getEventDataWithFallback("ctx_ip_address") ||
    getEventDataWithFallback("ip_address") ||
    getEventDataWithFallback("client_ip") ||
    getEventDataWithFallback("ip_override");
  if (!ip && data && data.clientIp) {
    ip = data.clientIp;
  }
  if (!ip && fallbackFromProfile) {
    ip = fallbackFromProfile;
  }
  return ip || null;
}

function getUserDataParam(key) {
  var ud = getEventData("user_data");
  if (!ud || typeof ud !== "object") return undefined;
  var v = ud[key];
  if (v === null || v === undefined) return undefined;
  return v;
}

function getEventDataWithFallback(key) {
  var result = getEventData(key);
  if (
    (result === null || result === undefined) &&
    data &&
    data.eventData &&
    typeof data.eventData === "object"
  ) {
    result = data.eventData[key];
  }
  if (result === null || result === undefined) {
    result = getEventParamFromEventParams(key);
    if (result !== undefined) {
    }
  }
  return result;
}

function getEventDataNonempty(key) {
  var result = getEventDataWithFallback(key);
  if (result === null || result === undefined) return null;
  if (typeof result === "string" && !makeString(result).trim()) return null;
  return result;
}

data.gtmOnSuccess();

function parseUrlParams(url) {
  if (!url) return {};
  const params = {};
  const queryIndex = url.indexOf("?");
  if (queryIndex === -1) return params;

  const queryString = url.substring(queryIndex + 1);
  const pairs = queryString.split("&");

  let i = 0;
  while (i < pairs.length) {
    const pair = pairs[i];
    const equalIndex = pair.indexOf("=");
    if (equalIndex !== -1) {
      const key = pair.substring(0, equalIndex);
      const value = pair.substring(equalIndex + 1);
      params[key] = value;
    }
    i = i + 1;
  }

  return params;
}

function getCharAt(s, idx) {
  if (!s || typeof s !== "string" || idx < 0 || idx >= s.length) return "";
  return s.substring(idx, idx + 1);
}

function normalizeEmail(raw) {
  if (raw === null || raw === undefined) return undefined;

  var str = typeof raw === "string" ? raw : raw + "";
  if (typeof str !== "string") {
    return undefined;
  }

  function trimString(s) {
    if (!s || typeof s !== "string") return "";
    var start = 0;
    var end = s.length;
    while (
      start < end &&
      (getCharAt(s, start) === " " ||
        getCharAt(s, start) === "\t" ||
        getCharAt(s, start) === "\n" ||
        getCharAt(s, start) === "\r")
    ) {
      start = start + 1;
    }
    while (
      end > start &&
      (getCharAt(s, end - 1) === " " ||
        getCharAt(s, end - 1) === "\t" ||
        getCharAt(s, end - 1) === "\n" ||
        getCharAt(s, end - 1) === "\r")
    ) {
      end = end - 1;
    }
    if (start < end) {
      return s.substring(start, end);
    }
    return "";
  }

  var trimmed = trimString(str);
  if (!trimmed || trimmed.length === 0) {
    return undefined;
  }

  var extractFirstEmail = function (s) {
    if (!s || typeof s !== "string") return "";
    var separators = [";", ",", "|"];
    var result = s;
    var i = 0;
    while (i < separators.length) {
      var sepIndex = result.indexOf(separators[i]);
      if (sepIndex !== -1) {
        var afterSep = result.substring(sepIndex + 1);
        afterSep = trimString(afterSep);
        if (afterSep.indexOf("@") !== -1) {
          result = result.substring(0, sepIndex);
        }
      }
      i = i + 1;
    }
    return trimString(result);
  };

  var unwrapEmail = function (s) {
    if (!s || typeof s !== "string") return "";
    var e = trimString(s);
    if (e.length < 7) return e;
    if (e.substring(0, 7).toLowerCase() === "mailto:") {
      e = e.substring(7);
    }
    var ltIndex = e.indexOf("<");
    var gtIndex = e.indexOf(">");
    if (ltIndex !== -1 && gtIndex > ltIndex) {
      e = e.substring(ltIndex + 1, gtIndex);
    }
    return trimString(e);
  };

  var stripTrailingPunctuation = function (s) {
    if (!s || typeof s !== "string") return s;
    var punctuation = ".,;:!?)]}>\"'`";
    var result = s;
    var keepGoing = true;
    while (keepGoing && result.length > 0) {
      var lastChar = getCharAt(result, result.length - 1);
      var foundPunct = false;
      var punctIdx = 0;
      while (punctIdx < punctuation.length && !foundPunct) {
        if (lastChar === getCharAt(punctuation, punctIdx)) {
          foundPunct = true;
        }
        punctIdx = punctIdx + 1;
      }
      if (foundPunct) {
        result = result.substring(0, result.length - 1);
      } else {
        keepGoing = false;
      }
    }
    return result;
  };

  var stripAllWhitespace = function (s) {
    if (s === null || s === undefined) return "";
    if (typeof s !== "string") {
      s = s + "";
    }
    if (typeof s !== "string") return "";
    if (s.length === undefined || s.length === null) return "";
    var result = "";
    var len = s.length;
    var i = 0;
    while (i < len) {
      var ch = getCharAt(s, i);
      var isWhitespace = false;
      if (ch === " ") isWhitespace = true;
      if (ch === "\t") isWhitespace = true;
      if (ch === "\n") isWhitespace = true;
      if (ch === "\r") isWhitespace = true;
      if (!isWhitespace) {
        result = result + ch;
      }
      i = i + 1;
    }
    return result;
  };

  var fixCommas = function (s) {
    if (!s || typeof s !== "string") return "";
    var result = "";
    var i = 0;
    while (i < s.length) {
      var c = getCharAt(s, i);
      result = result + (c === "," ? "." : c);
      i = i + 1;
    }
    return result;
  };

  var compressDoubleDots = function (s) {
    if (!s || typeof s !== "string") return "";
    var result = s;
    while (result.indexOf("..") !== -1) {
      var newResult = "";
      var prevDot = false;
      var i = 0;
      while (i < result.length) {
        var c = getCharAt(result, i);
        if (c === ".") {
          if (!prevDot) newResult = newResult + c;
          prevDot = true;
        } else {
          newResult = newResult + c;
          prevDot = false;
        }
        i = i + 1;
      }
      result = newResult;
    }
    return result;
  };

  var validateDomain = function (domain) {
    if (domain.length < 4) return false;

    var first = getCharAt(domain, 0);
    var last = getCharAt(domain, domain.length - 1);
    if (first === "." || first === "-") return false;
    if (last === "." || last === "-") return false;
    if (domain.indexOf(".") === -1) return false;

    var prevWasDot = false;
    var prevWasDash = false;

    var i = 0;
    while (i < domain.length) {
      var c = getCharAt(domain, i);
      var validChar =
        (c >= "a" && c <= "z") ||
        (c >= "0" && c <= "9") ||
        c === "-" ||
        c === ".";
      if (!validChar) return false;
      if (c === "." && prevWasDot) return false;
      if (c === "." && prevWasDash) return false;
      if (c === "-" && prevWasDot) return false;
      prevWasDot = c === ".";
      prevWasDash = c === "-";
      i = i + 1;
    }

    var lastDotIndex = domain.lastIndexOf(".");
    var tld = domain.substring(lastDotIndex + 1);
    if (tld.length < 2) return false;

    var j = 0;
    while (j < tld.length) {
      var tc = getCharAt(tld, j);
      if (
        !((tc >= "a" && tc <= "z") || (tc >= "0" && tc <= "9") || tc === "-")
      ) {
        return false;
      }
      j = j + 1;
    }

    return true;
  };

  var email = extractFirstEmail(trimmed);
  if (!email || typeof email !== "string" || email.length === 0) {
    return undefined;
  }

  email = unwrapEmail(email);
  if (!email || typeof email !== "string") {
    return undefined;
  }

  email = email.toLowerCase();
  if (typeof email !== "string") {
    return undefined;
  }

  email = stripTrailingPunctuation(email);
  if (typeof email !== "string") return undefined;
  if (email.length === 0) {
    return undefined;
  }

  email = stripAllWhitespace(email);
  if (typeof email !== "string") return undefined;
  if (email.length === 0) {
    return undefined;
  }

  email = fixCommas(email);
  if (typeof email !== "string") return undefined;
  if (email.length === 0) {
    return undefined;
  }

  email = compressDoubleDots(email);
  if (typeof email !== "string") return undefined;
  if (email.length === 0) {
    return undefined;
  }

  if (email.length < 6 || email.length > 254) {
    return undefined;
  }

  var atIndex = email.indexOf("@");
  if (atIndex === -1) return undefined;
  if (email.indexOf("@", atIndex + 1) !== -1) return undefined;

  var localPart = email.substring(0, atIndex);
  var domain = email.substring(atIndex + 1);
  if (domain === "gmail.com" || domain === "googlemail.com") {
    domain = "gmail.com";

    var plusIdx = localPart.indexOf("+");
    if (plusIdx !== -1) {
      localPart = localPart.substring(0, plusIdx);
    }

    var lp2 = "";
    var g = 0;
    while (g < localPart.length) {
      var ch2 = getCharAt(localPart, g);
      if (ch2 !== ".") lp2 = lp2 + ch2;
      g = g + 1;
    }
    localPart = lp2;
    if (localPart.length === 0) {
      return undefined;
    }
  }

  if (localPart.length === 0 || localPart.length > 64) {
    return undefined;
  }
  if (getCharAt(localPart, 0) === ".") {
    return undefined;
  }
  if (getCharAt(localPart, localPart.length - 1) === ".") {
    return undefined;
  }

  var hasAlphaNum = false;
  var k = 0;
  while (k < localPart.length && !hasAlphaNum) {
    var lc = getCharAt(localPart, k);
    if ((lc >= "a" && lc <= "z") || (lc >= "0" && lc <= "9")) {
      hasAlphaNum = true;
    }
    k = k + 1;
  }
  if (!hasAlphaNum) {
    return undefined;
  }

  var domainValid = validateDomain(domain);
  if (!domainValid) {
    return undefined;
  }

  var finalEmail = localPart + "@" + domain;
  return finalEmail;
}

function decodeLoosePercentEncoding(s) {
  var out = makeString(s);
  out = out.split("%253A").join(":");
  out = out.split("%253a").join(":");
  out = out.split("%3A").join(":");
  out = out.split("%3a").join(":");
  out = out.split("%2520").join(" ");
  out = out.split("%20").join(" ");
  out = out.split("<br>").join("\n");
  out = out.split("<BR>").join("\n");
  out = out.split("<br/>").join("\n");
  out = out.split("<BR/>").join("\n");
  return out;
}

function extractDigitsFromFragment(fragment) {
  var digits = "";
  var i = 0;
  while (i < fragment.length) {
    var c = getCharAt(fragment, i);
    if (c >= "0" && c <= "9") {
      digits = digits + c;
    }
    i = i + 1;
  }
  if (digits.length < 7 || digits.length > 15) {
    return undefined;
  }
  return digits;
}

function extractPhoneFromBizMessage(raw) {
  var s = decodeLoosePercentEncoding(raw);
  if (!s) {
    return undefined;
  }
  var lower = s.toLowerCase();
  var marker = "telefon:";
  var idx = lower.indexOf(marker);
  if (idx < 0) {
    idx = lower.indexOf("telefon");
    if (idx < 0) {
      return undefined;
    }
    return extractDigitsFromFragment(s.substring(idx));
  }
  return extractDigitsFromFragment(s.substring(idx + marker.length));
}

function normalizePhone(raw) {
  if (raw === null || raw === undefined) return undefined;

  function trimString(s) {
    if (!s || typeof s !== "string") return "";
    var start = 0;
    var end = s.length;
    while (
      start < end &&
      (getCharAt(s, start) === " " ||
        getCharAt(s, start) === "\t" ||
        getCharAt(s, start) === "\n" ||
        getCharAt(s, start) === "\r")
    ) {
      start = start + 1;
    }
    while (
      end > start &&
      (getCharAt(s, end - 1) === " " ||
        getCharAt(s, end - 1) === "\t" ||
        getCharAt(s, end - 1) === "\n" ||
        getCharAt(s, end - 1) === "\r")
    ) {
      end = end - 1;
    }
    if (start < end) {
      return s.substring(start, end);
    }
    return "";
  }

  var DEFAULT_COUNTRY_CODE = "48";

  var str;
  if (typeof raw === "string") {
    str = trimString(raw);
  } else if (typeof raw === "number") {
    if (raw !== raw || raw <= 0 || raw % 1 !== 0) return undefined;
    if (raw > 9007199254740991) return undefined;
    str = raw + "";
    if (str.indexOf("e") !== -1 || str.indexOf("E") !== -1) return undefined;
  } else {
    return undefined;
  }

  if (str.length === 0) return undefined;

  var stripExtension = function (ph) {
    var p = ph.toLowerCase();
    var markers = ["wew.", "wew ", "ext.", "ext ", " x ", " x", "#"];
    var m = 0;
    while (m < markers.length) {
      var idx = p.indexOf(markers[m]);
      if (idx !== -1) {
        return trimString(ph.substring(0, idx));
      }
      m = m + 1;
    }
    return ph;
  };

  var extractFirstPhone = function (s) {
    var separators = ["/", ";", "|"];
    var result = s;
    var i = 0;
    while (i < separators.length) {
      var sepIndex = result.indexOf(separators[i]);
      if (sepIndex !== -1) {
        result = result.substring(0, sepIndex);
      }
      i = i + 1;
    }
    return trimString(result);
  };

  var phone = extractFirstPhone(str);
  phone = stripExtension(phone);

  var hadPlusPrefix = getCharAt(phone, 0) === "+";
  var hadDoubleZeroPrefix =
    phone.length >= 2 &&
    getCharAt(phone, 0) === "0" &&
    getCharAt(phone, 1) === "0";

  var digits = "";
  var i = 0;
  while (i < phone.length) {
    var c = getCharAt(phone, i);
    if (c >= "0" && c <= "9") {
      digits = digits + c;
    }
    i = i + 1;
  }

  if (digits.length === 0) return undefined;

  if (hadPlusPrefix) {
    if (digits.length >= 7 && digits.length <= 15) {
      return "+" + digits;
    }
  }

  if (hadDoubleZeroPrefix) {
    var digitsWithout00 = digits.substring(2);
    if (digitsWithout00.length >= 7 && digitsWithout00.length <= 15) {
      return "+" + digitsWithout00;
    }
  }

  if (digits.length === 9) {
    return "+" + DEFAULT_COUNTRY_CODE + digits;
  }

  if (digits.length === 10 && getCharAt(digits, 0) === "0") {
    return "+" + DEFAULT_COUNTRY_CODE + digits.substring(1);
  }

  if (
    digits.substring(0, 2) === "48" &&
    digits.length >= 10 &&
    digits.length <= 12
  ) {
    return "+" + digits;
  }

  if (
    digits.length >= 10 &&
    digits.length <= 15 &&
    getCharAt(digits, 0) !== "0"
  ) {
    return "+" + digits;
  }

  return undefined;
}

function normalizeSsoEventName(name) {
  if (!name) return name;
  if (name === "lead_won" || name === "closed_won") return "purchase";
  if (name === "lead_rejected") return "rejected_lead";
  return name;
}

const eventName = normalizeSsoEventName(
  getEventDataWithFallback("event_name") ||
    getEventDataWithFallback("event") ||
    "generate_lead",
);

logToConsole("=== SORTOWNIA V2 START === event_name =", eventName);

const BASE_URL = "https://uinpcbwf.eug.stape.io";
const API_KEY = "2d389d8d0875343a76c07c6ff388c586bbd9347duinpcbwf";
const API_BASE = BASE_URL + "/stape-api/" + API_KEY + "/v2/store/collections";

function generateULID() {
  const chars = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  const charsArray = chars.split("");
  let result = "";
  let i = 0;
  while (i < 26) {
    const randomIndex = generateRandom(0, 31);
    result = result + charsArray[randomIndex];
    i = i + 1;
  }
  return result;
}

function getFirstCookie(name) {
  const vals = getCookieValues(name);
  return vals && vals.length ? vals[0] : null;
}

function extractGaClientIdFromGaCookie() {
  const gaRaw = getFirstCookie("_ga");
  if (!gaRaw) return null;
  var parts = makeString(gaRaw).split(".");
  if (parts.length >= 4) {
    var p2 = parts[2];
    var p3 = parts[3];
    if (p2 && p3) return p2 + "." + p3;
  }
  return null;
}

if (eventName === "oid_init") {
  logToConsole("=== OID_INIT START ===");

  const gaClientId =
    getEventDataWithFallback("ga_client_id") ||
    extractGaClientIdFromGaCookie() ||
    getEventDataWithFallback("client_id") ||
    getEventDataWithFallback("cid");
  const attrFbp = getEventDataWithFallback("attr_fbp");
  const ctxPageUrl =
    getEventDataWithFallback("ctx_page_url") ||
    getEventDataWithFallback("page_location");
  const ctxUserAgent =
    getEventDataWithFallback("ctx_user_agent") ||
    getEventDataWithFallback("user_agent");
  const ctxReferrer =
    getEventDataWithFallback("ctx_referrer") ||
    getEventDataWithFallback("page_referrer") ||
    getEventDataWithFallback("referrer");

  const urlParams = parseUrlParams(ctxPageUrl);
  const attrGclid =
    getEventDataWithFallback("attr_gclid") ||
    getEventDataWithFallback("gclid") ||
    urlParams.gclid ||
    "";
  const attrGbraid =
    getEventDataWithFallback("attr_gbraid") || urlParams.gbraid || "";
  const attrWbraid =
    getEventDataWithFallback("attr_wbraid") || urlParams.wbraid || "";
  const attrFbc =
    getEventDataWithFallback("attr_fbc") || urlParams.fbclid || "";
  const attrUtmSource = getEventDataWithFallback("attr_utm_source");
  const attrUtmMedium = getEventDataWithFallback("attr_utm_medium");
  const attrUtmCampaign = getEventDataWithFallback("attr_utm_campaign");

  logToConsole("OID_INIT: ctx_page_url =", ctxPageUrl);
  logToConsole("OID_INIT: attr_gclid (z Event Data lub URL) =", attrGclid);
  logToConsole("OID_INIT: attr_fbc (z Event Data lub URL) =", attrFbc);

  logToConsole("OID_INIT: ga_client_id =", gaClientId);
  logToConsole("OID_INIT: attr_gclid =", attrGclid);

  if (!gaClientId) {
    logToConsole("OID_INIT: ❌ Brak ga_client_id - SKIP");
    return;
  }

  if (!attrGclid && !attrFbc && !attrGbraid && !attrWbraid) {
    logToConsole("OID_INIT: ❌ Brak click-ID - SKIP");
    return;
  }

  const timestamp = makeString(getTimestampMillis());
  const encodedGaClientId = encodeUriComponent(gaClientId);
  const lookupUrl = API_BASE + "/identity_map/documents/" + encodedGaClientId;

  sendHttpRequest(lookupUrl, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  })
    .then(function (lookupResponse) {
      let idOid;
      let existingData = {};

      if (lookupResponse.statusCode === 200) {
        const profileBody = JSON.parse(lookupResponse.body);
        existingData =
          profileBody.data && profileBody.data.data
            ? profileBody.data.data
            : {};
        idOid = existingData.id_oid || generateULID();
        logToConsole("OID_INIT: ✅ Update profilu, id_oid =", idOid);
      } else {
        idOid = generateULID();
        logToConsole("OID_INIT: ✨ Nowy profil, id_oid =", idOid);
      }

      const updatedData = {
        id_oid: idOid,
        ga_client_id: gaClientId,
        attr_gclid: attrGclid || existingData.attr_gclid,
        attr_fbc: attrFbc || existingData.attr_fbc,
        attr_fbp: attrFbp || existingData.attr_fbp,
        attr_gbraid: attrGbraid || existingData.attr_gbraid,
        attr_wbraid: attrWbraid || existingData.attr_wbraid,
        attr_utm_source: attrUtmSource || existingData.attr_utm_source,
        attr_utm_medium: attrUtmMedium || existingData.attr_utm_medium,
        attr_utm_campaign: attrUtmCampaign || existingData.attr_utm_campaign,
        oid_init_page_url: ctxPageUrl,
        ctx_user_agent: ctxUserAgent || existingData.ctx_user_agent || null, // ✅ DODANO: dla Meta CAPI EMQ
        ctx_ip_address:
          resolveCtxIpAddress(existingData.ctx_ip_address) || null,
        ctx_referrer: ctxReferrer || existingData.ctx_referrer || null, // ✅ DODANO: dla analizy
        oid_init_timestamp: timestamp,
        updated_at: timestamp,
      };

      if (existingData.biz_email)
        updatedData.biz_email = existingData.biz_email;
      if (existingData.biz_phone)
        updatedData.biz_phone = existingData.biz_phone;
      if (existingData.biz_name) updatedData.biz_name = existingData.biz_name;
      if (existingData.owner) updatedData.owner = existingData.owner;
      if (existingData.assist !== undefined)
        updatedData.assist = existingData.assist;
      if (existingData.order_id) updatedData.order_id = existingData.order_id;
      if (existingData.AktTimestamp)
        updatedData.AktTimestamp = existingData.AktTimestamp;

      logToConsole("OID_INIT: Zapisuję...");

      const saveUrl = API_BASE + "/identity_map/documents/" + encodedGaClientId;
      sendHttpRequest(
        saveUrl,
        { method: "PUT", headers: { "Content-Type": "application/json" } },
        JSON.stringify(updatedData),
      )
        .then(function () {
          logToConsole("OID_INIT: ✅ Zapisano - gclid zachowany!");

          setCookie("_oid", idOid, {
            "max-age": 7776000, // 90 dni w sekundach (90 * 24 * 60 * 60)
            path: "/",
            secure: true,
            httponly: true, // UWAGA: małe litery 'httponly', nie 'httpOnly'!
            samesite: "Lax", // UWAGA: małe litery 'samesite', nie 'sameSite'!
          });

          logToConsole("OID_INIT: ✅ Cookie _oid ustawione:", idOid);
          logToConsole("=== OID_INIT SUKCES ===");
        })
        .catch(function (err) {
          logToConsole("OID_INIT: ❌ Błąd:", err);
        });
    })
    .catch(function (lookupError) {
      logToConsole("OID_INIT: Lookup error - tworzę nowy");

      const fallbackIdOid = generateULID();
      const fallbackData = {
        id_oid: fallbackIdOid,
        ga_client_id: gaClientId,
        attr_gclid: attrGclid,
        attr_fbc: attrFbc,
        attr_fbp: attrFbp,
        attr_gbraid: attrGbraid,
        attr_wbraid: attrWbraid,
        oid_init_page_url: ctxPageUrl,
        ctx_user_agent: ctxUserAgent || null, // ✅ DODANO: dla Meta CAPI EMQ
        ctx_referrer: ctxReferrer || null, // ✅ DODANO: dla analizy
        oid_init_timestamp: timestamp,
        updated_at: timestamp,
      };

      const fallbackUrl =
        API_BASE + "/identity_map/documents/" + encodedGaClientId;
      sendHttpRequest(
        fallbackUrl,
        { method: "PUT", headers: { "Content-Type": "application/json" } },
        JSON.stringify(fallbackData),
      ).then(function () {
        logToConsole("OID_INIT: ✅ Fallback - nowy profil");

        setCookie("_oid", fallbackIdOid, {
          "max-age": 7776000, // 90 dni w sekundach (90 * 24 * 60 * 60)
          path: "/",
          secure: true,
          httponly: true, // UWAGA: małe litery 'httponly', nie 'httpOnly'!
          samesite: "Lax", // UWAGA: małe litery 'samesite', nie 'sameSite'!
        });

        logToConsole(
          "OID_INIT: ✅ Cookie _oid ustawione (fallback):",
          fallbackIdOid,
        );
        logToConsole("=== OID_INIT SUKCES ===");
      });
    });

  return; // oid_init kończy się tutaj!
}

function getProfileByKey(key, cbOk, cbFail) {
  const encoded = encodeUriComponent(key);
  const url = API_BASE + "/identity_map/documents/" + encoded;

  sendHttpRequest(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  })
    .then(function (res) {
      if (res.statusCode === 200) cbOk(res);
      else cbFail(res);
    })
    .catch(function (err) {
      cbFail({ statusCode: 0, error: err });
    });
}

logToConsole("=== SORTOWNIA + AKT START ===");

const rawEmail =
  getEventDataWithFallback("biz_email") ||
  getEventDataWithFallback("email") ||
  getUserDataParam("email") ||
  getUserDataParam("email_address");
var earlyBizMessage =
  getEventDataWithFallback("biz_message") ||
  getEventDataWithFallback("message") ||
  null;
function pickPhoneFromAnswers(obj) {
  if (!obj || typeof obj !== "object") {
    return null;
  }
  var keys = ["phone", "tel", "telefon", "phone_number", "mobile", "numer_telefonu"];
  var i = 0;
  while (i < keys.length) {
    var v = obj[keys[i]];
    if (v !== null && v !== undefined && makeString(v).trim()) {
      return makeString(v).trim();
    }
    i = i + 1;
  }
  return null;
}

function parseAnswersContactObject(raw) {
  if (!raw) {
    return null;
  }
  if (typeof raw === "object") {
    return raw;
  }
  var s = makeString(raw).trim();
  if (s.length < 2) {
    return null;
  }
  if (s.charAt(0) === '"') {
    s = JSON.parse(s);
  }
  if (typeof s === "string" && s.charAt(0) === "{") {
    var parsed = JSON.parse(s);
    if (parsed && typeof parsed === "object") {
      return parsed;
    }
  }
  if (typeof s === "object" && s) {
    return s;
  }
  return null;
}

var answersForContact =
  getEventDataWithFallback("answers") ||
  getEventDataWithFallback("biz_form_answers") ||
  null;
var answersContactObj = parseAnswersContactObject(answersForContact);
var phoneFromAnswers = pickPhoneFromAnswers(answersContactObj);
const rawPhone =
  getEventDataNonempty("biz_phone") ||
  getEventDataNonempty("phone") ||
  getEventDataNonempty("telefon") ||
  getEventDataNonempty("tel") ||
  getEventDataNonempty("phone_number") ||
  getUserDataParam("phone_number") ||
  getUserDataParam("phone") ||
  phoneFromAnswers ||
  extractPhoneFromBizMessage(earlyBizMessage);

logToConsole("SORTOWNIA: rawEmail (przed normalizeEmail) =", rawEmail);
logToConsole("SORTOWNIA: rawPhone (przed normalizePhone) =", rawPhone);

const email = normalizeEmail(rawEmail);
logToConsole("SORTOWNIA: email (po normalizeEmail) =", email);
var phone = normalizePhone(rawPhone);
logToConsole("SORTOWNIA: phone (po normalizePhone) =", phone);
if (phone && !getEventDataWithFallback("biz_phone") && earlyBizMessage) {
  logToConsole(
    "SORTOWNIA: phone wyciągnięty z biz_message (brak ep.biz_phone w evencie)",
    phone,
  );
}

const name =
  getEventDataWithFallback("biz_name") ||
  getEventDataWithFallback("name") ||
  getUserDataParam("first_name") ||
  (answersForContact && typeof answersForContact === "object"
    ? answersForContact.name
    : null);
const gaClientId =
  getEventDataWithFallback("ga_client_id") ||
  extractGaClientIdFromGaCookie() ||
  getEventDataWithFallback("client_id") ||
  getEventDataWithFallback("cid");
const rawBizProduct =
  getEventDataWithFallback("biz_product") ||
  getEventDataWithFallback("form_type");
const rawBizPricingKey = getEventDataWithFallback("biz_pricing_key");
function pricingKeyToProduct(pricingKey) {
  if (!pricingKey) return null;
  if (pricingKey.indexOf("lead_") === 0) return pricingKey.slice(5);
  if (pricingKey.indexOf("sql_") === 0) return pricingKey.slice(4);
  if (pricingKey.indexOf("rejected_") === 0) return pricingKey.slice(9);
  if (pricingKey.indexOf("won_") === 0) return pricingKey.slice(4);
  return pricingKey;
}

function normalizeBizProductSlug(product) {
  if (!product) return null;
  var s = makeString(product).toLowerCase().trim();
  if (s === "strona") return "strony";
  if (s === "kontakt" || s === "main") return null;
  return s;
}

function inferBizProductFromUrl(url) {
  if (!url) return null;
  var u = makeString(url).toLowerCase();
  if (u.indexOf("projektowanie-logo") >= 0 || u.indexOf("/logo") >= 0)
    return "logo";
  if (
    u.indexOf("tworzenie-stron") >= 0 ||
    u.indexOf("strony.owocni") >= 0 ||
    u.indexOf("/strony") >= 0
  )
    return "strony";
  if (u.indexOf("nazwa") >= 0 || u.indexOf("naming") >= 0) return "nazwa";
  if (u.indexOf("strategia") >= 0) return "strategia";
  if (u.indexOf("konsultacje") >= 0) return "konsultacje";
  if (u.indexOf("copywriting") >= 0) return "copywriting";
  if (u.indexOf("/cennik") >= 0) return null;
  return null;
}

var bizProduct =
  normalizeBizProductSlug(rawBizProduct) ||
  pricingKeyToProduct(rawBizPricingKey);
const bizValue = getEventDataWithFallback("biz_value"); // Rzeczywista wartość dla purchase
const ctxPageUrl =
  getEventDataWithFallback("ctx_page_url") ||
  getEventDataWithFallback("page_location");
const ctxLandingPageUrl =
  getEventDataWithFallback("ctx_landing_page_url") || ctxPageUrl;
if (!bizProduct || rawBizProduct === "kontakt" || rawBizProduct === "main") {
  bizProduct =
    inferBizProductFromUrl(ctxLandingPageUrl) ||
    inferBizProductFromUrl(ctxPageUrl) ||
    normalizeBizProductSlug(rawBizProduct) ||
    bizProduct;
}
const bizPricingKey = rawBizPricingKey || bizProduct; // Klucz cennika (np. sql_strony)
const ctxUserAgent =
  getEventDataWithFallback("ctx_user_agent") ||
  getEventDataWithFallback("user_agent");
var ctxIpAddress = resolveCtxIpAddress(null);
const ctxReferrer =
  getEventDataWithFallback("ctx_referrer") ||
  getEventDataWithFallback("page_referrer") ||
  getEventDataWithFallback("referrer");
const srcSystem = getEventDataWithFallback("src_system") || "web";
const timeOccurredIso = getEventDataWithFallback("time_occurred_iso_utc");
var ctxTimeOnPageMs =
  getEventDataWithFallback("ctx_time_on_page_ms") ||
  getEventDataWithFallback("time_on_page_ms") ||
  getEventDataWithFallback("time_on_page") ||
  null;
var bizMessage =
  earlyBizMessage || getEventDataWithFallback("description") || null;

var rawFormAnswers =
  getEventDataWithFallback("answers") ||
  getEventDataWithFallback("biz_form_answers") ||
  null;
var bizFormAnswers = null;
if (rawFormAnswers) {
  if (typeof rawFormAnswers === "object") {
    bizFormAnswers = JSON.stringify(rawFormAnswers);
  } else {
    bizFormAnswers = makeString(rawFormAnswers);
  }
}
var bizFormProduct =
  getEventDataWithFallback("product") ||
  getEventDataWithFallback("biz_form_product") ||
  null;

if (!phone) {
  var phoneFromFormAnswers = pickPhoneFromAnswers(
    parseAnswersContactObject(rawFormAnswers),
  );
  if (!phoneFromFormAnswers && bizFormAnswers) {
    phoneFromFormAnswers = pickPhoneFromAnswers(
      parseAnswersContactObject(bizFormAnswers),
    );
  }
  if (!phoneFromFormAnswers && bizMessage) {
    phoneFromFormAnswers = extractPhoneFromBizMessage(bizMessage);
  }
  if (phoneFromFormAnswers) {
    phone = normalizePhone(phoneFromFormAnswers);
    logToConsole(
      "SORTOWNIA: phone fallback z answers/biz_form_answers/message =",
      phone,
    );
  }
}

const urlParams = parseUrlParams(ctxPageUrl);
const landingUrlParams = parseUrlParams(ctxLandingPageUrl);
const attrGclid =
  getEventDataWithFallback("attr_gclid") ||
  getEventDataWithFallback("gclid") ||
  urlParams.gclid ||
  landingUrlParams.gclid ||
  "";
const attrGbraid =
  getEventDataWithFallback("attr_gbraid") ||
  urlParams.gbraid ||
  landingUrlParams.gbraid ||
  "";
const attrWbraid =
  getEventDataWithFallback("attr_wbraid") ||
  urlParams.wbraid ||
  landingUrlParams.wbraid ||
  "";
const attrFbc =
  getEventDataWithFallback("attr_fbc") ||
  urlParams.fbclid ||
  landingUrlParams.fbclid ||
  "";
const attrUtmSource = (
  getEventDataWithFallback("attr_utm_source") ||
  urlParams.utm_source ||
  landingUrlParams.utm_source ||
  ""
).toLowerCase();

logToConsole("SORTOWNIA: ctx_page_url =", ctxPageUrl);
logToConsole("SORTOWNIA: ctx_landing_page_url =", ctxLandingPageUrl);
logToConsole("SORTOWNIA: ctx_user_agent =", ctxUserAgent);
logToConsole("SORTOWNIA: ctx_ip_address =", ctxIpAddress);
logToConsole("SORTOWNIA: attr_gclid (z Event Data lub URL) =", attrGclid);
logToConsole("SORTOWNIA: attr_fbc (z Event Data lub URL) =", attrFbc);
logToConsole("SORTOWNIA: attr_gbraid (z Event Data lub URL) =", attrGbraid);
logToConsole("SORTOWNIA: attr_wbraid (z Event Data lub URL) =", attrWbraid);
logToConsole(
  "SORTOWNIA: attr_utm_source (z Event Data lub URL) =",
  attrUtmSource || "(brak)",
);

function computeOwnerFromCurrentEvent(
  gclid,
  fbc,
  gbraid,
  wbraid,
  src,
  utmSource,
) {
  if (src === "meta_instant_form") return "platform:meta_ads";
  if (gclid) return "platform:google_ads";
  if (gbraid || wbraid) return "platform:google_ads";
  if (fbc) return "platform:meta_ads";
  if (utmSource) {
    if (
      utmSource.indexOf("meta") !== -1 ||
      utmSource.indexOf("facebook") !== -1 ||
      utmSource.indexOf("fb") !== -1
    )
      return "platform:meta_ads";
    if (utmSource.indexOf("google") !== -1 || utmSource.indexOf("cpc") !== -1)
      return "platform:google_ads";
  }
  return "platform:none";
}

logToConsole("SORTOWNIA: email =", email);
logToConsole("SORTOWNIA: phone =", phone);
logToConsole("SORTOWNIA: ga_client_id =", gaClientId);

const timestamp = makeString(getTimestampMillis());

const oidCookie = getFirstCookie("_oid");
logToConsole("SORTOWNIA: _oid cookie =", oidCookie);

const resolveKeys = [];
if (oidCookie) resolveKeys.push(oidCookie);
if (email) resolveKeys.push(email);
if (phone) resolveKeys.push(phone);
if (gaClientId) resolveKeys.push(gaClientId);

if (resolveKeys.length === 0) {
  logToConsole(
    "SORTOWNIA ERROR: Brak kluczy resolve (_oid/email/phone/ga_client_id) - SKIP",
  );
  return;
}

function resolveProfile(keys, idx) {
  if (idx >= keys.length) {
    logToConsole("SORTOWNIA: Wszystkie klucze 404 - nowy profil");
    processNewProfile();
    return;
  }

  const key = keys[idx];
  logToConsole(
    "SORTOWNIA: Resolve lookup key =",
    key,
    "(" + (idx + 1) + "/" + keys.length + ")",
  );

  getProfileByKey(
    key,
    function (res) {
      var resolveKeyType = "unknown";
      if (key === oidCookie) resolveKeyType = "_oid";
      else if (key === email) resolveKeyType = "email";
      else if (key === phone) resolveKeyType = "phone";
      else if (key === gaClientId) resolveKeyType = "ga_client_id";

      logToConsole(
        "SORTOWNIA: ✅ Found profile by key =",
        key,
        "(typ:",
        resolveKeyType + ")",
      );
      processExistingProfile(res);
    },
    function () {
      resolveProfile(keys, idx + 1);
    },
  );
}

resolveProfile(resolveKeys, 0);

function processExistingProfile(lookupResponse) {
  const profileBody = JSON.parse(lookupResponse.body);
  const existing =
    profileBody.data && profileBody.data.data ? profileBody.data.data : {};

  const idOid = existing.id_oid || generateULID();

  var hasNewEmail = email && !existing.biz_email;
  var hasNewPhone = phone && !existing.biz_phone;
  var hasNewGaClientId = gaClientId && !existing.ga_client_id;

  if (hasNewEmail || hasNewPhone || hasNewGaClientId) {
    var newKeysList = [];
    if (hasNewEmail) newKeysList.push("email");
    if (hasNewPhone) newKeysList.push("phone");
    if (hasNewGaClientId) newKeysList.push("ga_client_id");
    logToConsole(
      "SORTOWNIA: ⭐ Nowe klucze w evencie (pierwszy raz):",
      newKeysList,
    );
    logToConsole(
      "SORTOWNIA: ⚠️ Multi-key write będzie zapisać profil pod nowymi kluczami:",
      newKeysList,
    );
  }

  let owner = existing.owner || "platform:none";
  var taskOwner = owner; // domyślnie = owner; przy SKIP nadpisane na "last click"
  let assist = existing.assist || null;
  let orderId = existing.order_id;
  let aktTimestamp = existing.AktTimestamp;
  const existingGclid = existing.attr_gclid;
  const existingFbc = existing.attr_fbc;

  logToConsole("SORTOWNIA: id_oid =", idOid);
  logToConsole("SORTOWNIA: owner =", owner, ", order_id =", orderId);
  logToConsole("SORTOWNIA: gclid z profilu =", existingGclid);

  let aktTimestampMs = null;
  var enqueueTwentyCreateLead = false;
  if (eventName === "generate_lead") {
    const nowMs = timestamp * 1;

    if (existing.AktTimestampMs) {
      aktTimestampMs = existing.AktTimestampMs * 1;
    } else if (existing.AktTimestamp) {
      var parsedMs;
      if (
        existing.AktTimestamp.endsWith &&
        existing.AktTimestamp.endsWith("_iso")
      ) {
        var timestampPart = existing.AktTimestamp.replace("_iso", "");
        parsedMs = timestampPart * 1;
      } else {
        var isoStr = existing.AktTimestamp;
        parsedMs = isoStr * 1;
        if (parsedMs !== parsedMs) {
          parsedMs = nowMs;
        }
      }
      aktTimestampMs = parsedMs;
    }

    if (aktTimestampMs !== null) {
      const ageDays = (nowMs - aktTimestampMs) / 86400000; // 86400000 ms = 1 dzień

      if (ageDays < 90 && ageDays === ageDays) {
        var daysRounded = (ageDays + 0.5) | 0;
        logToConsole(
          "SORTOWNIA: ⏭️ SKIP - Akt istnieje i jest młodszy niż 90 dni (",
          daysRounded,
          " dni, AktTimestampMs =",
          aktTimestampMs,
          ")",
        );
        orderId = existing.order_id || orderId;
        aktTimestamp = existing.AktTimestamp;
        aktTimestampMs = existing.AktTimestampMs || aktTimestampMs;
        owner = existing.owner || owner;
        assist = existing.assist !== undefined ? existing.assist : assist;
        var mergedGclid = attrGclid || existingGclid;
        var mergedFbc = attrFbc || existingFbc;
        var taskOwner = computeOwnerFromCurrentEvent(
          mergedGclid,
          mergedFbc,
          attrGbraid,
          attrWbraid,
          srcSystem,
          attrUtmSource,
        );
        if (taskOwner !== owner) {
          logToConsole(
            "SORTOWNIA: Task owner =",
            taskOwner,
            ", profil owner (first touch) =",
            owner,
          );
        }
        enqueueTwentyCreateLead = false;
      } else {
        var daysRounded = (ageDays + 0.5) | 0;
        logToConsole(
          "SORTOWNIA: ✅ Akt jest starszy niż 90 dni (",
          daysRounded,
          " dni, AktTimestampMs =",
          aktTimestampMs,
          ") - tworzę nowy",
        );
        var finalGclid = attrGclid || existingGclid;
        var finalFbc = attrFbc || existingFbc;
        owner = computeOwnerFromCurrentEvent(
          finalGclid,
          finalFbc,
          attrGbraid,
          attrWbraid,
          srcSystem,
          attrUtmSource,
        );
        if (owner === "platform:google_ads" && finalGclid)
          logToConsole("SORTOWNIA: Owner = Google (gclid:", finalGclid, ")");
        taskOwner = owner;

        assist = null;
        orderId = timestamp + "_generate_lead";
        aktTimestamp = timeOccurredIso || timestamp + "_iso";
        aktTimestampMs = nowMs;
        logToConsole(
          "SORTOWNIA: ✅ Akt: owner =",
          owner,
          ", AktTimestampMs =",
          aktTimestampMs,
        );
        enqueueTwentyCreateLead = true;
      }
    } else {
      logToConsole("SORTOWNIA: ✨ Brak Akt - tworzę nowy");
      var finalGclid = attrGclid || existingGclid;
      var finalFbc = attrFbc || existingFbc;
      owner = computeOwnerFromCurrentEvent(
        finalGclid,
        finalFbc,
        attrGbraid,
        attrWbraid,
        srcSystem,
        attrUtmSource,
      );
      if (owner === "platform:google_ads" && finalGclid)
        logToConsole("SORTOWNIA: Owner = Google (gclid:", finalGclid, ")");
      taskOwner = owner;

      assist = null;
      orderId = timestamp + "_generate_lead";
      aktTimestamp = timeOccurredIso || timestamp + "_iso";
      aktTimestampMs = nowMs;
      logToConsole(
        "SORTOWNIA: ✅ Akt: owner =",
        owner,
        ", AktTimestampMs =",
        aktTimestampMs,
      );
      enqueueTwentyCreateLead = true;
    }
  } else {
    aktTimestampMs = existing.AktTimestampMs || null;
  }

  if (eventName === "generate_lead" && email) {
    enqueueTwentyCreateLead = true;
    logToConsole(
      "SORTOWNIA: crm:twenty_create_lead enabled (generate_lead + email)",
    );
  }

  saveProfileAndTask(
    idOid,
    owner,
    taskOwner,
    assist,
    orderId,
    aktTimestamp,
    aktTimestampMs,
    existingGclid,
    existingFbc,
    existing.ga_client_id || null,
    existing.biz_product || null,
    existing.ctx_ip_address || null,
    enqueueTwentyCreateLead,
  );
}

function processMergedProfile(oidInitResponse) {
  const oidInitBody = JSON.parse(oidInitResponse.body);
  const oidInitData =
    oidInitBody.data && oidInitBody.data.data ? oidInitBody.data.data : {};

  const idOid = oidInitData.id_oid || generateULID();
  const existingGclid = oidInitData.attr_gclid;
  const existingFbc = oidInitData.attr_fbc;

  logToConsole("SORTOWNIA: ✨ Merge z oid_init - id_oid =", idOid);

  var hasNewEmail = email && !oidInitData.biz_email;
  var hasNewPhone = phone && !oidInitData.biz_phone;
  var hasNewGaClientId = gaClientId && !oidInitData.ga_client_id;

  if (hasNewEmail || hasNewPhone || hasNewGaClientId) {
    var newKeysList = [];
    if (hasNewEmail) newKeysList.push("email");
    if (hasNewPhone) newKeysList.push("phone");
    if (hasNewGaClientId) newKeysList.push("ga_client_id");
    logToConsole(
      "SORTOWNIA: ⭐ Merge z oid_init - nowe klucze w evencie:",
      newKeysList,
    );
  }

  logToConsole("SORTOWNIA: gclid z oid_init =", existingGclid);

  let owner = "platform:none";
  let assist = null;
  let orderId;
  let aktTimestamp;
  let aktTimestampMs = null;

  var enqueueTwentyCreateLead = false;
  if (eventName === "generate_lead") {
    logToConsole("SORTOWNIA: Obliczam Akt Własności (merge oid_init)...");

    const finalGclid = attrGclid || existingGclid;
    const finalFbc = attrFbc || existingFbc;
    owner = computeOwnerFromCurrentEvent(
      finalGclid,
      finalFbc,
      attrGbraid,
      attrWbraid,
      srcSystem,
      attrUtmSource,
    );
    if (owner === "platform:google_ads" && finalGclid)
      logToConsole(
        "SORTOWNIA: Owner = Google (gclid z oid_init:",
        finalGclid,
        ")",
      );

    assist = null;
    orderId = timestamp + "_generate_lead";
    aktTimestamp = timeOccurredIso || timestamp + "_iso";
    aktTimestampMs = timestamp * 1;

    logToConsole(
      "SORTOWNIA: ✅ Akt: owner =",
      owner,
      ", AktTimestampMs =",
      aktTimestampMs,
    );
    enqueueTwentyCreateLead = true;
  }

  saveProfileAndTask(
    idOid,
    owner,
    owner,
    assist,
    orderId,
    aktTimestamp,
    aktTimestampMs,
    existingGclid,
    existingFbc,
    oidInitData.ga_client_id || null,
    oidInitData.biz_product || null,
    oidInitData.ctx_ip_address || null,
    enqueueTwentyCreateLead,
  );
}

function processNewProfile() {
  const idOid = generateULID();

  logToConsole("SORTOWNIA: ✨ Nowy id_oid =", idOid);
  var newKeysList = [];
  if (email) newKeysList.push("email");
  if (phone) newKeysList.push("phone");
  if (gaClientId) newKeysList.push("ga_client_id");
  if (newKeysList.length > 0) {
    logToConsole(
      "SORTOWNIA: ⭐ Nowy profil - wszystkie klucze są nowe:",
      newKeysList,
    );
  }

  let owner = "platform:none";
  let assist = null;
  let orderId;
  let aktTimestamp;
  let aktTimestampMs = null;

  var enqueueTwentyCreateLead = false;
  if (eventName === "generate_lead") {
    logToConsole("SORTOWNIA: Obliczam Akt Własności...");

    owner = computeOwnerFromCurrentEvent(
      attrGclid,
      attrFbc,
      attrGbraid,
      attrWbraid,
      srcSystem,
      attrUtmSource,
    );

    assist = null;
    orderId = timestamp + "_generate_lead";
    aktTimestamp = timeOccurredIso || timestamp + "_iso";
    aktTimestampMs = timestamp * 1;

    logToConsole(
      "SORTOWNIA: ✅ Akt: owner =",
      owner,
      ", AktTimestampMs =",
      aktTimestampMs,
    );
    enqueueTwentyCreateLead = true;
  }

  saveProfileAndTask(
    idOid,
    owner,
    owner,
    assist,
    orderId,
    aktTimestamp,
    aktTimestampMs,
    null,
    null,
    null,
    null,
    null,
    enqueueTwentyCreateLead,
  );
}

function uniqKeys(arr) {
  const out = [];
  let i = 0;
  while (i < arr.length) {
    const k = arr[i];
    let found = false;
    let j = 0;
    while (j < out.length) {
      if (out[j] === k) {
        found = true;
        break;
      }
      j = j + 1;
    }
    if (!found && k) out.push(k);
    i = i + 1;
  }
  return out;
}

function enqueueCrmTwentyCreateLeadTask(baseTaskData) {
  var crmTaskId =
    baseTaskData.id_oid + "_" + timestamp + "_crm_twenty_create_lead";
  var crmTaskData = {
    id_oid: baseTaskData.id_oid,
    id_event: timestamp + "_crm_twenty_create_lead",
    event_name: "generate_lead",
    job_type: "crm:twenty_create_lead",
    status: "pending",
    created_at: timestamp,
    environment: baseTaskData.environment,
    adapter: "crm:twenty_create_lead",
    biz_email: baseTaskData.biz_email,
    biz_phone: baseTaskData.biz_phone,
    biz_name: baseTaskData.biz_name,
    biz_product: baseTaskData.biz_product,
    biz_pricing_key: baseTaskData.biz_pricing_key,
    biz_value: baseTaskData.biz_value,
    attr_gclid: baseTaskData.attr_gclid,
    attr_fbc: baseTaskData.attr_fbc,
    attr_gbraid: baseTaskData.attr_gbraid,
    attr_wbraid: baseTaskData.attr_wbraid,
    ctx_page_url: baseTaskData.ctx_page_url,
    ctx_user_agent: baseTaskData.ctx_user_agent,
    ctx_ip_address: baseTaskData.ctx_ip_address,
    ctx_referrer: baseTaskData.ctx_referrer,
    ctx_time_on_page_ms: baseTaskData.ctx_time_on_page_ms,
    biz_message: baseTaskData.biz_message,
    biz_form_answers: baseTaskData.biz_form_answers,
    biz_form_product: baseTaskData.biz_form_product,
    ga_client_id: baseTaskData.ga_client_id,
    owner: baseTaskData.owner,
    order_id: baseTaskData.order_id,
    src_system: baseTaskData.src_system,
    src_action_source: baseTaskData.src_action_source,
    consent_analytics_storage: baseTaskData.consent_analytics_storage,
    consent_ad_storage: baseTaskData.consent_ad_storage,
    time_occurred_iso_utc: baseTaskData.time_occurred_iso_utc,
  };

  var encodedId = encodeUriComponent(crmTaskId);
  var saveUrl = API_BASE + "/task_queue/documents/" + encodedId;

  logToConsole("SORTOWNIA: Enqueue crm:twenty_create_lead", crmTaskId);

  sendHttpRequest(
    saveUrl,
    { method: "PUT", headers: { "Content-Type": "application/json" } },
    JSON.stringify(crmTaskData),
  )
    .then(function (res) {
      logToConsole(
        "SORTOWNIA: ✅ crm:twenty_create_lead task saved, status =",
        res.statusCode,
      );
    })
    .catch(function (err) {
      logToConsole(
        "SORTOWNIA: ⚠️ crm:twenty_create_lead enqueue error (best-effort):",
        err,
      );
    });
}

function saveProfileAndTask(
  idOid,
  profileOwner,
  taskOwner,
  assist,
  orderId,
  aktTimestamp,
  aktTimestampMs,
  existingGclid,
  existingFbc,
  existingGaClientId,
  existingBizProduct,
  existingCtxIpAddress,
  enqueueTwentyCreateLead,
) {
  const resolvedGaClientId = gaClientId || existingGaClientId || null;
  const resolvedBizProduct =
    bizProduct ||
    normalizeBizProductSlug(existingBizProduct) ||
    existingBizProduct ||
    null;
  const resolvedCtxIp = resolveCtxIpAddress(existingCtxIpAddress);
  const taskEnvironment = resolveTaskEnvironment(email);

  const fullProfileData = {
    id_oid: idOid,
    biz_email: email,
    biz_phone: phone,
    company_domain_key: companyDomainKeyFromEmail(email),
    biz_name: name,
    ga_client_id: resolvedGaClientId,
    biz_product: resolvedBizProduct,
    attr_gclid: attrGclid || existingGclid,
    attr_fbc: attrFbc || existingFbc,
    updated_at: timestamp,
    owner: profileOwner,
    assist: assist,
    order_id: orderId,
    AktTimestamp: aktTimestamp,
    AktTimestampMs: aktTimestampMs,
    ctx_ip_address: resolvedCtxIp,
  };

  const keys = [];
  keys.push(idOid);
  if (email) keys.push(email);
  if (phone) keys.push(phone);
  if (resolvedGaClientId) keys.push(resolvedGaClientId);

  const saveKeys = uniqKeys(keys);

  logToConsole("SORTOWNIA: Multi-key write, klucze:", saveKeys);
  logToConsole(
    "SORTOWNIA: Multi-key write: PUT pod",
    saveKeys.length,
    "kluczy (primary:",
    saveKeys[0] + ", pozostałe:",
    saveKeys.length - 1 + ")",
  );

  const primaryKey = saveKeys[0];
  const encodedPrimaryKey = encodeUriComponent(primaryKey);
  const saveIdentityUrl =
    API_BASE + "/identity_map/documents/" + encodedPrimaryKey;

  logToConsole(
    "SORTOWNIA: Zapisuję Identity Map (primary key:",
    primaryKey,
    ")...",
  );

  sendHttpRequest(
    saveIdentityUrl,
    { method: "PUT", headers: { "Content-Type": "application/json" } },
    JSON.stringify(fullProfileData),
  )
    .then(function (saveIdentityResponse) {
      logToConsole(
        "SORTOWNIA: ✅ Identity saved (primary key:",
        primaryKey,
        "), status =",
        saveIdentityResponse.statusCode,
      );

      let keyIdx = 1;
      while (keyIdx < saveKeys.length) {
        const nextKey = saveKeys[keyIdx];
        const encodedNextKey = encodeUriComponent(nextKey);
        const saveNextUrl =
          API_BASE + "/identity_map/documents/" + encodedNextKey;

        sendHttpRequest(
          saveNextUrl,
          { method: "PUT", headers: { "Content-Type": "application/json" } },
          JSON.stringify(fullProfileData),
        )
          .then(function (response) {
            logToConsole(
              "SORTOWNIA: ✅ Identity saved (key:",
              nextKey,
              "), status =",
              response.statusCode,
            );
          })
          .catch(function (err) {
            logToConsole(
              "SORTOWNIA: ⚠️ Identity error (key:",
              nextKey,
              "):",
              err,
              "(best-effort, kontynuuję)",
            );
          });

        keyIdx = keyIdx + 1;
      }

      const taskId = idOid + "_" + timestamp + "_" + eventName;
      const srcActionSource =
        getEventDataWithFallback("src_action_source") || "website";
      const consentAnalytics = getEventDataWithFallback(
        "consent_analytics_storage",
      );
      const consentAd = getEventDataWithFallback("consent_ad_storage");
      logToConsole("SORTOWNIA: consent_analytics_storage =", consentAnalytics);
      logToConsole("SORTOWNIA: consent_ad_storage =", consentAd);
      logToConsole("SORTOWNIA: environment =", taskEnvironment);
      const taskData = {
        id_oid: idOid,
        id_event: timestamp + "_" + eventName,
        event_name: eventName,
        job_type: "analytics:ga4_mp",
        status: "pending",
        created_at: timestamp,
        environment: taskEnvironment,
        biz_email: email,
        biz_phone: phone,
        biz_name: name,
        biz_product: resolvedBizProduct,
        biz_pricing_key: bizPricingKey, // Klucz cennika dla Lookup Table
        biz_value: bizValue, // Rzeczywista wartość dla purchase
        attr_gclid: attrGclid || existingGclid,
        attr_fbc: attrFbc || existingFbc || null, // ✅ Dodano: Meta Click ID
        attr_gbraid: attrGbraid || null, // ✅ Dodano: Google Braid
        attr_wbraid: attrWbraid || null, // ✅ Dodano: Google Wbraid
        ctx_page_url: ctxPageUrl,
        ctx_user_agent: ctxUserAgent || null, // ✅ DODANO: dla Meta CAPI EMQ (wymagane)
        ctx_ip_address: resolvedCtxIp,
        ctx_referrer: ctxReferrer || null, // ✅ DODANO: dla analizy (opcjonalne)
        ctx_time_on_page_ms:
          ctxTimeOnPageMs !== undefined && ctxTimeOnPageMs !== null
            ? makeString(ctxTimeOnPageMs)
            : null, // ✅ Czas na stronie (jak w mailu)
        biz_message: bizMessage || null, // ✅ Treść wiadomości (jak w mailu)
        biz_form_answers: bizFormAnswers || null,
        biz_form_product: bizFormProduct || null,
        ga_client_id: resolvedGaClientId,
        owner: taskOwner, // last click (przy SKIP) lub first touch (nowy Akt)
        order_id: orderId,
        src_system: srcSystem, // ✅ Dodano zgodnie z SSOT
        src_action_source: srcActionSource, // ✅ Dodano zgodnie z SSOT
        consent_analytics_storage: consentAnalytics || null, // ✅ Consent Gate dla GA4
        consent_ad_storage: consentAd || null, // ✅ Consent Gate dla Google/Meta Ads
        time_occurred_iso_utc: timeOccurredIso || null,
      };

      const encodedTaskId = encodeUriComponent(taskId);
      const saveTaskUrl = API_BASE + "/task_queue/documents/" + encodedTaskId;

      logToConsole("SORTOWNIA: Zapisuję task...");

      sendHttpRequest(
        saveTaskUrl,
        { method: "PUT", headers: { "Content-Type": "application/json" } },
        JSON.stringify(taskData),
      )
        .then(function (saveTaskResponse) {
          logToConsole(
            "SORTOWNIA: ✅ Task saved, status =",
            saveTaskResponse.statusCode,
          );
          if (eventName === "generate_lead" && enqueueTwentyCreateLead) {
            enqueueCrmTwentyCreateLeadTask(taskData);
          }
          logToConsole("=== SORTOWNIA + AKT SUKCES ===");
          logToConsole(
            "FINAL: id_oid =",
            idOid,
            ", task owner =",
            taskOwner,
            ", order_id =",
            orderId,
          );
        })
        .catch(function (taskError) {
          logToConsole("SORTOWNIA: ❌ Task error:", taskError);
        });
    })
    .catch(function (identityError) {
      logToConsole("SORTOWNIA: ❌ Identity error:", identityError);
    });
}

logToConsole("SORTOWNIA V2: Processing started...");
