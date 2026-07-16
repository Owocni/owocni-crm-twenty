# SSOT — `free_mail_domains` v1.0.0

> **Lista domen, dla których CRM NIE tworzy i NIE łączy firmy po domenie e-maila.**
> Dokument roboczy OWOCNI.PL · wersja 1.0.0 · 2026-07-15 · **918 domen**
> Pliki towarzyszące: `free_mail_domains_v1.json` (maszynowy), `free_mail_domains_v1.txt` (płaski)

---

## 0. Sedno

**Jedna reguła: `is_free_mail(eTLD+1) == true` → `company_domain_key = null` → CRM nie wolno stworzyć ani dopiąć firmy po tej domenie. Kontakt powstaje, firma nie.**

**Blokujemy agresywnie, bo koszty są asymetryczne: fałszywe zablokowanie kosztuje jedno ręczne przypisanie firmy, a fałszywe przepuszczenie tworzy w CRM firmę-widmo, która zjada dziesiątki niepowiązanych leadów i której rozplątanie jest ręczne i kosztowne.**

---

## 1. Zakres

### 1.1 Co ta lista robi
Odpowiada na jedno pytanie: **czy z domeny po `@` wolno wywnioskować firmę?** Nic więcej.

### 1.2 Czego ta lista NIE robi — świadomie poza zakresem
| Poza zakresem | Dlaczego |
|---|---|
| Ocena jakości leada | `@gmail.com` bywa realnym klientem. Blokujemy **mintowanie firmy**, nie leada. |
| Walidacja istnienia skrzynki | To robi weryfikator (Kickbox/ZeroBounce), nie ta lista. |
| Adresy rolowe (`biuro@`, `info@`, `kontakt@`) | To problem *local-part*, nie domeny. `biuro@firma.pl` → `firma.pl` jest **poprawnym** kluczem firmy. Rola wpływa na tworzenie *osoby*, nie *firmy*. |
| Domeny jednorazowe (temp-mail) | Osobna warstwa, tysiące pozycji, nie da się ich utrzymywać ręcznie → rozdz. 6.9. |
| Domeny `.edu.pl` / `.gov.pl` | Uczelnia i urząd **są** instytucją. Mintowanie firmy z `uw.edu.pl` jest poprawne. Nie blokujemy. |

---

## 2. Model decyzyjny — dlaczego blokujemy agresywnie

Macierz kosztów jest **skrajnie asymetryczna**:

| | Blokujemy | Nie blokujemy |
|---|---|---|
| **Domena konsumencka** (`gmail.com`) | ✅ poprawnie | ❌ **firma-widmo „Gmail" z 200 kontaktami** — trucizna w bazie, rozplątanie ręczne |
| **Domena firmowa** (`owocni.pl`) | ⚠️ jedno ręczne przypisanie firmy | ✅ poprawnie |

Koszt fałszywego pozytywu = **minuta pracy**. Koszt fałszywego negatywu = **skażony graf relacji**, który psuje raportowanie, deduplikację i atrybucję przychodu.

**Wniosek operacyjny:** przy wątpliwości → blokuj. Dlatego domeny typu `orange.pl`, `home.pl`, `netia.pl` są na liście, mimo że Orange Polska i Netia to realne firmy (rozdz. 7.1).

---

## 3. Poprawki vs. wersja robocza v0 — przeczytaj, zanim wdrożysz

### 3.1 🔴 KILL: reguła „domena **zawiera** ciąg znaków"

Wersja v0 zawierała regułę: *„Jeśli domena zawiera jeden z ciągów: `gmail`, `live`, `me.com`, `aim`, `inbox`, `terra`, `proton`, `tuta`… → NIE ŁĄCZ"*.

**To jest błąd, nie optymalizacja. Ta reguła kasuje realne firmy z CRM-a.** Dowody:

| Ciąg z v0 | Trafia też w | Skutek |
|---|---|---|
| `me.com` | **`acme.com`**, `home.com`, `frame.com`, `theme.com` | Każda domena kończąca się na „me.com" przestaje mintować firmę |
| `live` | **`livechat.com`**, `livechatinc.com` (LiveChat Software S.A., Wrocław, GPW), `livesport.pl`, `deliveroo.co.uk`, `olive*` | Tracisz realny polski target B2B |
| `terra` | **`terravita.pl`** (Terravita, Poznań), `mediterranean.*`, `terrabit.*` | jw. |
| `aim` | `claims.com`, `aimtec.com`, `maimon.*` | jw. |
| `proton` | `protonet.de`, `protonpower.com` | jw. |
| `tuta` | `tutaj.pl` | jw. |
| `mac.com` | `pharmac.com` | jw. |

**Co ważne: v0 sam sobie przeczy.** Rozdział 3 v0 (`is_free_mail(domain_reg)` → sprawdzenie obecności w `free_mail_domains_v1.json`) jest **poprawny**. Reguła substring jest z nim sprzeczna. Zostaje rozdz. 3, substring wypada.

### 3.2 ✅ Zamiennik: dokładne dopasowanie + **zakotwiczone** wzorce rodzin

Prawdziwy problem, który substring miał rozwiązać, jest realny: Microsoft ma ~100 wariantów ccTLD (`outlook.de`, `hotmail.fr`, `live.com.pt`…) i dopisuje kolejne. Ręczna lista zawsze będzie miała dziurę.

Rozwiązanie: **wzorzec zakotwiczony obustronnie** (`^…$`), nie „zawiera":

```
^(hotmail|outlook|live|msn)\.[a-z]{2,3}(\.[a-z]{2,3})?$
```

Wymusza kropkę zaraz po nazwie rodziny i koniec stringa po TLD. Test wykonany na tej liście:

| Wejście | Wynik | |
|---|---|---|
| `live.com`, `hotmail.co.uk`, `outlook.com.br`, `gmx.net`, `yahoo.com.tw`, `pm.me` | **BLOK** | ✅ zamierzone |
| `livechat.com`, `livechatinc.com`, `msnbc.com`, `acme.com`, `terravita.pl`, `claims.com`, `deliveroo.co.uk`, `protonet.de`, `orange.com`, `telekom.de`, `owocni.pl`, `tutaj.pl` | **przechodzi** | ✅ zero false-positive |

Wzorce są **opcjonalne** (`patterns_optional: true`). Dokładne dopasowanie jest warstwą podstawową; wzorce włącz dopiero po okresie obserwacji.

### 3.3 ⚠️ Subdomeny kolapsują przez PSL

`poczta.wp.pl`, `poczta.onet.pl`, `vip.interia.pl` **nie są** eTLD+1 — po normalizacji PSL stają się `wp.pl`, `onet.pl`, `interia.pl`. W liście lookup są **martwe** (nigdy nie zostaną odpytane).

**Decyzja: zostają w JSON**, oznaczone polem `psl_collapses_to`. Powód: obrona w głąb — jeśli ktoś (np. zewnętrzny współpracownik) użyje listy bez PSL, subdomena nadal zadziała. Koszt: 4 klucze.

### 3.4 ➕ Uzupełnienie normalizacji: kanonikalizacja `googlemail.com`

v0 dla Gmaila zdejmuje `+tag` i kropki — dobrze. Brakuje kroku: `googlemail.com` → `gmail.com`. Bez tego `j.k+x@googlemail.com` i `jk@gmail.com` to ta sama skrzynka o dwóch kluczach. Dla *blokowania firmy* bez znaczenia (obie na liście), dla **tożsamości osoby** — istotne.

### 3.5 ➕ Brak w v0: warstwa domen jednorazowych → rozdz. 6.9

---

## 4. Algorytm

### 4.1 `normalize_email(raw)` → `email_normalized`
1. `trim` + `lowercase`
2. usuń **wszystkie** białe znaki (także w środku)
3. jeśli liczba `@` ≠ 1 → `sys_invalid_email = true`, **nie używaj e-maila do resolve**
4. `local`, `domain` = split po ostatnim `@`
5. `domain` → IDN → **punycode** (`ąę.pl` → `xn--2da4b.pl`)
6. jeśli `domain ∈ {googlemail.com}` → `domain = gmail.com`
7. jeśli `domain ∈ {gmail.com}`:
   - `local` = wszystko przed pierwszym `+`
   - usuń kropki z `local`
8. **żadnego innego providera nie ruszaj** (KISS — plus-addressing i kropki mają różną semantykę na różnych serwerach; agresywna normalizacja = fałszywe merge'e)

### 4.2 `compute_registrable_domain(domain)` → `domain_reg`
`domain_reg` = **eTLD+1 wg Public Suffix List** (`https://publicsuffix.org/list/`) — nie „ostatnie 2 segmenty".

| Wejście | eTLD+1 | Dlaczego „ostatnie 2 segmenty" zawodzi |
|---|---|---|
| `mail.firma.pl` | `firma.pl` | ok |
| `firma.co.uk` | `firma.co.uk` | naiwnie → `co.uk` ❌ |
| `onet.com.pl` | `onet.com.pl` | `com.pl` jest sufiksem publicznym |
| `toya.net.pl` | `toya.net.pl` | `net.pl` jest sufiksem publicznym |
| `poczta.onet.pl` | `onet.pl` | ok |

Biblioteki: JS `tldts` / `psl`, Python `tldextract`, Go `publicsuffix`.
**Wersjonuj snapshot PSL** — lista żyje, a zmiana sufiksu po cichu zmienia klucze firm.

### 4.3 `is_free_mail(domain_reg)` → `bool`
```
true  ⟸  domain_reg ∈ free_mail_domains_v1.json.domains
      ∨  (patterns_enabled ∧ ∃ p ∈ patterns : p.match(domain_reg))
false ⟸  w przeciwnym razie
```

### 4.4 `company_domain_key`
```
is_free_mail == true   → company_domain_key = null      # NIE mintuj, NIE łącz
is_free_mail == false  → company_domain_key = domain_reg # wolno mintować/łączyć
```

### 4.5 Implementacja referencyjna (JS)
```js
import { parse } from 'tldts';
import LIST from './free_mail_domains_v1.json' assert { type: 'json' };

const SET = new Set(Object.keys(LIST.domains));
const PATTERNS_ENABLED = false;              // włącz po okresie obserwacji
const RX = LIST.patterns.map(p => new RegExp(p.re));

export function normalizeEmail(raw) {
  const s = String(raw ?? '').trim().toLowerCase().replace(/\s+/g, '');
  const at = s.lastIndexOf('@');
  if (at < 1 || s.indexOf('@') !== at) return { invalid: true };
  let local = s.slice(0, at);
  let domain = parse(s.slice(at + 1)).hostname;   // tldts robi IDN→punycode
  if (!domain) return { invalid: true };
  if (domain === 'googlemail.com') domain = 'gmail.com';
  if (domain === 'gmail.com') local = local.split('+')[0].replace(/\./g, '');
  return { invalid: false, email: `${local}@${domain}`, domain };
}

export function registrableDomain(domain) {
  return parse(domain).domain || null;          // eTLD+1 wg PSL
}

export function isFreeMail(domainReg) {
  if (!domainReg) return true;                  // brak domeny → nie mintuj
  if (SET.has(domainReg)) return true;
  return PATTERNS_ENABLED && RX.some(rx => rx.test(domainReg));
}

export function companyDomainKey(rawEmail) {
  const n = normalizeEmail(rawEmail);
  if (n.invalid) return null;
  const reg = registrableDomain(n.domain);
  return isFreeMail(reg) ? null : reg;
}
```

### 4.6 Punkt wpięcia w Twenty CRM
Twenty ma własną utylitę `isWorkEmail` (używaną m.in. przy pobieraniu logo firmy) — jej lista jest anglocentryczna i **najprawdopodobniej nie zawiera `wp.pl` / `interia.pl` / `o2.pl` / `onet.pl`**.
*Nie wiem* dokładnie, gdzie leży ta stała w 2.8.x — zweryfikuj `grep -r "isWorkEmail" packages/`. Rekomendacja: nie forkuj Twenty — wepnij `companyDomainKey()` **przed** zapisem, w n8n/webhooku, i podawaj `company` tylko gdy klucz ≠ null.

---

## 5. Taksonomia

**`tier`** — ryzyko, nie pewność:
- **A** — czysty freemail/portal. Blokada twarda, ryzyko false-positive ≈ zero.
- **B** — ISP / telco / hosting. Domena **dual-use**: siedzą pod nią abonenci-konsumenci **i** pracownicy operatora. Blokujemy mimo to (rozdz. 2), ale warto oznaczyć rekord flagą do przeglądu.

**`c` (confidence)** — moja pewność, **nie wpływa na blokadę** (blokuje sama obecność w `domains`); to metadana dla utrzymującego:
- **high** — pewne.
- **med** — prawdopodobne, odtworzone z pamięci → zweryfikuj przed użyciem krytycznym.
- **low** — niepewne, może już nie istnieć. Zostawione, bo **martwa domena w denyliście nie szkodzi, brakująca żywa szkodzi**.

Rozkład: **tier A: 709 · tier B: 209** · **med: 532 · high: 378 · low: 8**

---

## 6. Listy
Łącznie **918** domen. Kolumna **T** = tier (A = czysty freemail, B = ISP/telco/hosting dual-use). Kolumna **C** = moja pewność (nie wpływa na blokadę — patrz rozdz. 5).

### 6.1. Polska — 88 domen

> Największa luka rynkowa: zachodnie listy (`Kikobeats/free-email-domains`, HubSpot, `disposable-email-domains`) **nie mają** `tlen.pl`, `go2.pl`, `int.pl`, `buziaczek.pl` ani aliasów WP/o2. Ten blok trzeba utrzymywać samodzielnie.

**Wirtualna Polska (WP / o2 / tlen)** · 🔴 A · pewne · 26

> WP przejela o2.pl (razem z go2.pl / tlen.pl / prokonto.pl / int.pl). Jedna infrastruktura, wiele aliasow.

```
10g.pl
cmoki.pl
dobramama.pl
dobrytata.pl
fajne.to
fejm.pl
go2.pl
int.pl
jadamspam.pl
kozacki.pl
lykamspam.pl
mailmix.pl
mailplus.pl
mixbox.pl
notowany.pl
o2.pl
poczta.wp.pl
prokonto.pl
romantyczka.pl
superbox.pl
szeptem.pl
tenbit.pl
tlen.pl
wir.pl
wp.pl
xboxer.pl
```

**Grupa Interia** · 🔴 A · pewne · 11

> Zrodlo prawdy: https://konto-pocztowe.interia.pl/app/poczta/domainlist (oficjalny endpoint z lista domen).

```
adresik.net
interia.com
interia.eu
interia.pl
interiowy.pl
intmail.pl
ogarnij.se
pacz.to
pisz.to
poczta.fm
vip.interia.pl
```

**Onet (Ringier Axel Springer)** · 🔴 A · pewne · 12

```
amorki.pl
autograf.pl
buziaczek.pl
onet.com.pl
onet.eu
onet.pl
op.pl
opoczta.pl
poczta.onet.eu
poczta.onet.pl
spoko.pl
vp.pl
```

**Agora** · 🔴 A · pewne · 1

```
gazeta.pl
```

**PL - pozostale portale / freemail** · 🔴 A · med — do weryfikacji · 13

> Czesc to relikty (portale z lat 2000-2010). Nadal zyja jako adresy w bazach leadow - dlatego zostaja.

```
1gb.pl
akcja.pl
box43.pl
hoga.pl
os.pl
pf.pl
poczta.pl
priv.pl
rubikon.pl
serwus.pl
spray.pl
student.pl
wp.eu
```

**PL - telco / ISP (dual-use)** · 🟠 B · pewne · 22

> Domeny abonenckie. Sa TEZ domenami realnych firm (Orange Polska, Netia SA). Patrz rozdzial 7.1 - i tak blokujemy.

```
aster.pl
astercity.net
chello.pl
dialog.pl
era.pl
icpnet.pl
inea.pl
internetia.pl
multimedia.pl
neostrada.pl
netia.pl
orange.pl
plus.pl
plusnet.pl
satfilm.pl
sferia.pl
t-mobile.pl
toya.net.pl
toya.pl
upc.com.pl
upcpoczta.pl
vectra.pl
```

**PL - hosting (dual-use)** · 🟠 B · med — do weryfikacji · 3

> Nie jestem pewien, czy nadal wydaja darmowe skrzynki konsumenckie. Blokujemy prewencyjnie - koszt bledu jest niski.

```
az.pl
home.pl
nazwa.pl
```

### 6.2. Niemcy / Austria / Szwajcaria — 47 domen

> Pełna lista GMX (~130 domen) jest poza moją pamięcią — uzupełnij ze źródła i/lub polegaj na wzorcu `^gmx\.<tld>$`. Referencja: <https://www.spamresource.com/2020/03/reference-webde-gmx-and-mailcom-domains.html>

**United Internet - GMX** · 🔴 A · pewne · 14

> Nie mam pewnej pelnej listy (krazy liczba ~130). Zrodlo referencyjne: https://www.spamresource.com/2020/03/reference-webde-gmx-and-mailcom-domains.html . Uzupelnij regula wzorcowa `^gmx\.<tld>$`.

```
gmx.at
gmx.biz
gmx.ch
gmx.co.uk
gmx.com
gmx.de
gmx.eu
gmx.fr
gmx.info
gmx.li
gmx.net
gmx.org
gmx.tm
gmx.us
```

**United Internet - web.de / 1&1** · 🔴 A · pewne · 2

```
online.de
web.de
```

**DE - freemail** · 🔴 A · pewne · 9

> posteo / mailbox.org sa platne, ale konsumenckie - z punktu widzenia mintowania firmy zachowuja sie identycznie jak darmowe.

```
arcor.de
freenet.de
lycos.de
mail.de
mailbox.org
nexgo.de
posteo.de
posteo.net
t-online.de
```

**DE - telco / ISP (dual-use)** · 🟠 B · med — do weryfikacji · 8

```
ewetel.net
htp-tel.de
kabelmail.de
netcologne.de
osnanet.de
unitybox.de
versanet.de
vodafone.de
```

**AT - freemail / ISP** · 🟠 B · med — do weryfikacji · 7

```
a1.net
aon.at
chello.at
inode.at
kabsi.at
liwest.at
utanet.at
```

**CH - freemail / ISP** · 🟠 B · med — do weryfikacji · 7

```
bluemail.ch
bluewin.ch
freesurf.ch
hispeed.ch
sunrise.ch
swissonline.ch
vtxnet.ch
```

### 6.3. Francja — 31 domen

> Warianty ccTLD Microsoftu (`hotmail.fr`, `outlook.fr`, `live.fr`) i Yahoo (`yahoo.fr`) są w bloku globalnym 6.5 — nie duplikuję ich tutaj.

**FR - Orange / Wanadoo** · 🟠 B · pewne · 4

> UWAGA: orange.fr = konsument, orange.com = korporacja Orange S.A. NIE blokuj orange.com.

```
nordnet.fr
orange.fr
voila.fr
wanadoo.fr
```

**FR - Free / Iliad** · 🟠 B · pewne · 3

```
alice.fr
aliceadsl.fr
free.fr
```

**FR - SFR / Numericable** · 🟠 B · pewne · 7

```
9online.fr
cegetel.net
club-internet.fr
neuf.fr
noos.fr
numericable.fr
sfr.fr
```

**FR - Bouygues** · 🟠 B · pewne · 1

```
bbox.fr
```

**FR - freemail** · 🔴 A · pewne · 8

```
caramail.com
infonie.fr
laposte.net
libertysurf.fr
lycos.fr
netcourrier.com
tiscali.fr
worldonline.fr
```

**FR - do weryfikacji** · 🔴 A · low — może nie żyć · 8

> Nie wiem, czy nadal dzialaja. Nie usuwam - martwa domena w denyliscie nie szkodzi, brakujaca zywa szkodzi.

```
caramail.fr
chez.com
freesurf.fr
ifrance.com
mageos.com
multimania.fr
nomade.fr
tele2.fr
```

### 6.4. Wielka Brytania / Irlandia — 25 domen

**UK - BT** · 🟠 B · pewne · 4

> btconnect.com = BT Business. Realne firmy tam siedza - ale sa to RÓŻNE firmy, wiec i tak nie wolno po tym mergowac.

```
btconnect.com
btinternet.com
btopenworld.com
talk21.com
```

**UK - Virgin Media** · 🟠 B · pewne · 5

```
blueyonder.co.uk
ntlworld.com
telewest.co.uk
virgin.net
virginmedia.com
```

**UK - pozostali ISP** · 🟠 B · med — do weryfikacji · 12

> o2.co.uk (UK, Telefonica) to INNA firma niz o2.pl (PL, WP). Nie laczyc.

```
freeserve.co.uk
fsnet.co.uk
lineone.net
o2.co.uk
orange.net
plus.net
sky.com
supanet.com
talktalk.net
tiscali.co.uk
wanadoo.co.uk
zen.co.uk
```

**IE - ISP** · 🟠 B · med — do weryfikacji · 4

```
eir.ie
eircom.net
indigo.ie
iol.ie
```

### 6.5. Globalne (EN) — wielkie platformy — 449 domen

> Rdzeń listy. Blok `mail.com vanity` jest najważniejszy dla Twojego problemu: to domeny, które **wyglądają jak firmowe**, a są darmowymi skrzynkami.

**Google** · 🔴 A · pewne · 2

```
gmail.com
googlemail.com
```

**Microsoft - rdzen** · 🔴 A · pewne · 6

```
hotmail.com
live.com
msn.com
outlook.com
passport.com
windowslive.com
```

**Microsoft - warianty ccTLD** · 🔴 A · med — do weryfikacji · 81

> Ta lista NIE jest kompletna i nigdy nie bedzie - Microsoft dodaje ccTLD-y. To wlasnie po to jest regula wzorcowa `^(hotmail|outlook|live|msn)\.<tld>$` (rozdz. 4.6).

```
hotmail.at
hotmail.be
hotmail.ca
hotmail.ch
hotmail.co.il
hotmail.co.jp
hotmail.co.kr
hotmail.co.nz
hotmail.co.th
hotmail.co.uk
hotmail.com.ar
hotmail.com.au
hotmail.com.br
hotmail.com.mx
hotmail.com.tr
hotmail.cz
hotmail.de
hotmail.dk
hotmail.es
hotmail.fi
hotmail.fr
hotmail.gr
hotmail.hu
hotmail.it
hotmail.nl
hotmail.no
hotmail.ru
hotmail.se
live.at
live.be
live.ca
live.cl
live.cn
live.co.uk
live.com.ar
live.com.au
live.com.mx
live.com.pt
live.de
live.dk
live.fi
live.fr
live.ie
live.it
live.jp
live.nl
live.no
live.ru
live.se
msn.de
outlook.at
outlook.be
outlook.cl
outlook.co.id
outlook.co.il
outlook.co.nz
outlook.co.th
outlook.com.au
outlook.com.br
outlook.com.gr
outlook.com.pe
outlook.com.tr
outlook.com.vn
outlook.cz
outlook.de
outlook.dk
outlook.es
outlook.fr
outlook.hu
outlook.ie
outlook.in
outlook.it
outlook.jp
outlook.kr
outlook.lv
outlook.my
outlook.ph
outlook.pt
outlook.sa
outlook.sg
outlook.sk
```

**Yahoo** · 🔴 A · pewne · 49

```
rocketmail.com
yahoo.at
yahoo.be
yahoo.ca
yahoo.ch
yahoo.cl
yahoo.cn
yahoo.co.id
yahoo.co.in
yahoo.co.jp
yahoo.co.kr
yahoo.co.nz
yahoo.co.th
yahoo.co.uk
yahoo.co.za
yahoo.com
yahoo.com.ar
yahoo.com.au
yahoo.com.br
yahoo.com.cn
yahoo.com.co
yahoo.com.hk
yahoo.com.mx
yahoo.com.my
yahoo.com.pe
yahoo.com.ph
yahoo.com.sg
yahoo.com.tr
yahoo.com.tw
yahoo.com.ve
yahoo.com.vn
yahoo.cz
yahoo.de
yahoo.dk
yahoo.es
yahoo.fi
yahoo.fr
yahoo.gr
yahoo.hu
yahoo.ie
yahoo.in
yahoo.it
yahoo.nl
yahoo.no
yahoo.pl
yahoo.pt
yahoo.ro
yahoo.se
ymail.com
```

**AOL** · 🔴 A · med — do weryfikacji · 14

```
aim.com
aol.co.uk
aol.com
aol.de
aol.es
aol.fr
aol.it
compuserve.com
cs.com
games.com
love.com
netscape.net
wow.com
ygm.com
```

**Apple** · 🔴 A · pewne · 3

```
icloud.com
mac.com
me.com
```

**Proton** · 🔴 A · pewne · 4

```
pm.me
proton.me
protonmail.ch
protonmail.com
```

**Tuta (Tutanota)** · 🔴 A · pewne · 6

```
keemail.me
tuta.com
tuta.io
tutamail.com
tutanota.com
tutanota.de
```

**Zoho** · 🔴 A · pewne · 3

> UWAGA: Zoho hostuje TEZ domeny firmowe klientow. Blokujemy tylko @zoho.com/@zohomail.com - nie MX Zoho.

```
zoho.com
zoho.eu
zohomail.com
```

**Yandex** · 🔴 A · pewne · 8

```
narod.ru
ya.ru
yandex.by
yandex.com
yandex.com.tr
yandex.kz
yandex.ru
yandex.ua
```

**VK / Mail.ru** · 🔴 A · pewne · 6

```
bk.ru
inbox.ru
internet.ru
list.ru
mail.ru
my.com
```

**Rambler** · 🔴 A · med — do weryfikacji · 6

```
autorambler.ru
lenta.ru
myrambler.ru
r0.ru
rambler.ru
ro.ru
```

**Pozostale globalne freemail** · 🔴 A · pewne · 12

```
duck.com
email.com
fastmail.com
fastmail.fm
gawab.com
hush.com
hushmail.com
hushmail.me
inbox.com
lycos.com
mail.com
operamail.com
```

**mail.com - domeny vanity (FALSE CORPORATE!)** · 🔴 A · med — do weryfikacji · 156

> NAJWAZNIEJSZY blok dla Twojego problemu: `consultant.com`, `lawyer.com`, `engineer.com`, `revenue.com` wygladaja jak domeny firmowe, a sa darmowymi skrzynkami mail.com. Odtworzone z pamieci, NIE zweryfikowane 1:1. Zrodlo prawdy: https://www.mail.com/mail/domains/ oraz https://tavel.net/en/2018/07/04/list-of-all-mail-com-domains/ (zrzut 190 domen).

```
accountant.com
activist.com
adexec.com
allergist.com
alumni.com
alumnidirector.com
archaeologist.com
arcticmail.com
artlover.com
asia.com
atheist.com
auctioneer.com
bartender.net
bikerider.com
birdlover.com
brew-master.com
cash4u.com
catlover.com
cheerful.com
chef.net
chemist.com
chinamail.com
clerk.com
collector.org
columnist.com
comic.com
computer4u.com
consultant.com
contractor.net
coolsite.net
counsellor.com
cutey.com
cyber-wizard.com
cyberdude.com
cybergal.com
cyberservices.com
dallasmail.com
deliveryman.com
diplomats.com
disciples.com
doctor.com
doglover.com
doramail.com
dr.com
dublin.com
earthling.net
elvisfan.com
engineer.com
europe.com
execs.com
fastservice.com
feelings.com
financier.com
fireman.net
gardener.com
geologist.com
graduate.org
graphic-designer.com
greenmail.net
groupmail.com
hackermail.com
hairdresser.net
hot-shot.com
iname.com
innocent.com
inorbit.com
instruction.com
instructor.net
insurer.com
irelandmail.com
israelmail.com
italymail.com
job4u.com
journalist.com
keromail.com
kissfans.com
kittymail.com
koreamail.com
lawyer.com
legislator.com
linuxmail.org
lobbyist.com
lovecat.com
madonnafan.com
mail-me.com
marchmail.com
minister.com
moscowmail.com
munich.com
musician.org
muslim.com
myself.com
net-shopping.com
nightmail.com
ninfan.com
nonpartisan.com
nycmail.com
optician.com
orthodontist.net
pediatrician.com
petlover.com
photographer.net
physicist.net
planetmail.com
planetmail.net
polandmail.com
politician.com
post.com
presidency.com
priest.com
programmer.net
publicist.com
qualityservice.com
radiologist.net
ravemail.com
realtyagent.com
reggaefan.com
registerednurses.com
reincarnate.com
religious.com
repairman.com
representative.com
rescueteam.com
revenue.com
rocketship.com
safrica.com
saintly.com
salesperson.net
samerica.com
sanfranmail.com
scientist.com
scotlandmail.com
secretary.net
seductive.com
snakebite.com
socialworker.net
sociologist.com
solution4u.com
songwriter.net
spainmail.com
teachers.org
tech-center.com
techie.com
technologist.com
theplate.com
therapist.net
toke.com
toothfairy.com
tvstar.com
umpire.com
usa.com
uymail.com
webname.com
worker.com
workmail.com
writeme.com
```

**Fastmail - domeny aliasowe** · 🔴 A · med — do weryfikacji · 93

> Odtworzone z pamieci, do weryfikacji. Zrodlo prawdy: https://www.spamresource.com/2022/10/reference-all-fastmail-email-domains.html

```
150mail.com
150ml.com
16mail.com
2-mail.com
4email.net
50mail.com
allmail.net
bestmail.us
cluemail.com
elitemail.org
emailcorner.net
emailengine.net
emailengine.org
emailgroups.net
emailplus.org
emailuser.net
eml.cc
f-m.fm
fastmail.ca
fastmail.co.uk
fastmail.de
fastmail.es
fastmail.fr
fastmail.in
fastmail.jp
fastmail.mx
fastmail.net
fastmail.nl
fastmail.se
fastmail.to
fastmail.us
fea.st
fmail.co.uk
fmgirl.com
fmguy.com
hailmail.net
imap-mail.com
imap.cc
imapmail.org
inoutbox.com
internet-e-mail.com
internet-mail.org
internetemails.net
internetmailing.net
jetemail.net
letterboxes.org
mail-central.com
mail-page.com
mailandftp.com
mailas.com
mailbolt.com
mailc.net
mailcan.com
mailforce.net
mailftp.com
mailhaven.com
mailingaddress.org
mailite.com
mailmight.com
mailnew.com
mailsent.net
mailservice.ms
mailup.net
mailworks.org
ml1.net
mm.st
myfastmail.com
mymacmail.com
nospammail.net
ownmail.net
petml.com
postinbox.com
postpro.net
proinbox.com
promessage.com
realemail.net
reallyfast.biz
reallyfast.info
rushpost.com
sent.as
sent.at
sent.com
speedymail.org
ssl-mail.com
swift-mail.com
the-fastest.net
the-quickest.com
theinternetemail.com
theweb2mail.com
warpmail.net
xsmail.com
yepmail.net
your-mail.com
```

### 6.6. Reszta Europy — 193 domen

**NL** · 🟠 B · pewne · 18

```
caiway.nl
casema.nl
chello.nl
hetnet.nl
home.nl
kpnmail.nl
kpnplanet.nl
online.nl
planet.nl
quicknet.nl
tele2.nl
telfort.nl
upcmail.nl
versatel.nl
wanadoo.nl
xs4all.nl
ziggo.nl
zonnet.nl
```

**BE** · 🟠 B · pewne · 11

```
base.be
belgacom.net
edpnet.be
pandora.be
proximus.be
scarlet.be
skynet.be
swing.be
telenet.be
tiscali.be
voo.be
```

**IT** · 🔴 A · pewne · 20

```
alice.it
blu.it
email.it
fastwebnet.it
infinito.it
interfree.it
inwind.it
iol.it
jumpy.it
katamail.com
libero.it
supereva.it
tele2.it
teletu.it
tim.it
tin.it
tiscali.it
virgilio.it
vodafone.it
wind.it
```

**ES** · 🔴 A · pewne · 15

```
eresmas.com
euskaltel.net
jazzfree.com
jazztel.es
latinmail.com
mixmail.com
movistar.es
ono.com
orange.es
retemail.es
telefonica.net
teleline.es
terra.es
wanadoo.es
ya.com
```

**PT** · 🔴 A · med — do weryfikacji · 7

```
clix.pt
iol.pt
meo.pt
netcabo.pt
nos.pt
oninet.pt
sapo.pt
```

**SE** · 🟠 B · med — do weryfikacji · 11

```
bahnhof.se
bredband.net
comhem.se
glocalnet.se
home.se
passagen.se
spray.se
swipnet.se
tele2.se
telia.com
telia.se
```

**NO** · 🟠 B · med — do weryfikacji · 9

```
broadpark.no
c2i.net
chello.no
frisurf.no
getmail.no
nextgentel.no
online.no
start.no
telenor.no
```

**DK** · 🟠 B · med — do weryfikacji · 11

```
get2net.dk
image.dk
jubii.dk
mail.dk
post.tele.dk
privat.dk
sol.dk
stofanet.dk
tdcadsl.dk
webspeed.dk
youmail.dk
```

**FI** · 🟠 B · med — do weryfikacji · 9

```
dnainternet.net
elisanet.fi
kolumbus.fi
luukku.com
netti.fi
pp.inet.fi
saunalahti.fi
sci.fi
suomi24.fi
```

**CZ** · 🔴 A · pewne · 11

```
atlas.cz
centrum.cz
chello.cz
email.cz
iol.cz
mybox.cz
post.cz
quick.cz
seznam.cz
tiscali.cz
volny.cz
```

**SK** · 🔴 A · pewne · 11

```
atlas.sk
azet.sk
centrum.sk
chello.sk
inmail.sk
netlab.sk
orangemail.sk
pobox.sk
post.sk
stonline.sk
zoznam.sk
```

**HU** · 🔴 A · pewne · 9

```
chello.hu
citromail.hu
freemail.hu
hu.inter.net
indamail.hu
invitel.hu
t-online.hu
upcmail.hu
vipmail.hu
```

**RO** · 🟠 B · med — do weryfikacji · 4

```
clicknet.ro
home.ro
personal.ro
rdslink.ro
```

**BG** · 🔴 A · pewne · 5

```
abv.bg
dir.bg
gbg.bg
mail.bg
techno-link.com
```

**GR** · 🔴 A · med — do weryfikacji · 5

```
forthnet.gr
freemail.gr
hol.gr
in.gr
otenet.gr
```

**LT** · 🔴 A · med — do weryfikacji · 7

```
centras.lt
delfi.lt
inbox.lt
mail.lt
one.lt
takas.lt
zebra.lt
```

**LV** · 🔴 A · med — do weryfikacji · 7

```
apollo.lv
delfi.lv
inbox.lv
latnet.lv
navigator.lv
one.lv
tvnet.lv
```

**EE** · 🔴 A · med — do weryfikacji · 5

```
hot.ee
mail.ee
neti.ee
online.ee
starman.ee
```

**UA** · 🔴 A · pewne · 5

```
bigmir.net
i.ua
meta.ua
online.ua
ukr.net
```

**BY** · 🔴 A · med — do weryfikacji · 3

```
mail.by
open.by
tut.by
```

**HR / SI / RS** · 🔴 A · med — do weryfikacji · 7

```
eunet.rs
inet.hr
net.hr
siol.net
telemach.net
vip.hr
volja.net
```

**TR** · 🔴 A · med — do weryfikacji · 3

```
mynet.com
superonline.com
ttmail.com
```

### 6.7. Reszta świata — 85 domen

> Blok US/CA/AU to głównie ISP — dopisane, bo agencja pracująca w EN dostaje takie leady.

**US - ISP (dual-use)** · 🟠 B · pewne · 34

```
ameritech.net
atlanticbb.net
att.net
bellsouth.net
cableone.net
centurylink.net
charter.net
comcast.net
cox.net
earthlink.net
embarqmail.com
epix.net
flash.net
frontier.com
gci.net
insightbb.com
juno.com
mchsi.com
metrocast.net
mindspring.com
netzero.net
optonline.net
pacbell.net
prodigy.net
ptd.net
roadrunner.com
rr.com
sbcglobal.net
suddenlink.net
swbell.net
twc.com
verizon.net
windstream.net
wowway.com
```

**CA - ISP (dual-use)** · 🟠 B · med — do weryfikacji · 8

```
bell.net
cogeco.ca
eastlink.ca
rogers.com
shaw.ca
sympatico.ca
telus.net
videotron.ca
```

**AU / NZ - ISP (dual-use)** · 🟠 B · med — do weryfikacji · 7

```
bigpond.com
bigpond.net.au
iinet.net.au
internode.on.net
optusnet.com.au
tpg.com.au
xtra.co.nz
```

**CN** · 🔴 A · pewne · 11

```
126.com
163.com
21cn.com
aliyun.com
foxmail.com
qq.com
sina.cn
sina.com
sohu.com
tom.com
yeah.net
```

**JP / KR** · 🔴 A · med — do weryfikacji · 10

```
biglobe.ne.jp
daum.net
docomo.ne.jp
ezweb.ne.jp
hanmail.net
nate.com
naver.com
nifty.com
ocn.ne.jp
softbank.ne.jp
```

**IN** · 🔴 A · med — do weryfikacji · 3

```
indiatimes.com
rediffmail.com
sify.com
```

**BR / LATAM** · 🔴 A · med — do weryfikacji · 9

```
bol.com.br
globo.com
globomail.com
ig.com.br
oi.com.br
prodigy.net.mx
terra.com.br
uol.com.br
zipmail.com.br
```

**ZA / MEA** · 🔴 A · med — do weryfikacji · 3

```
mweb.co.za
telkomsa.net
webmail.co.za
```

### 6.8. Wzorce rodzin (opcjonalne, zakotwiczone)

Uzupełniają listę o warianty ccTLD, których nikt nie nadąży wpisać ręcznie. Domyślnie **wyłączone** (`patterns_optional: true`) — włącz po okresie obserwacji.

```
microsoft  ^(hotmail|outlook|live|msn)\.[a-z]{2,3}(\.[a-z]{2,3})?$
yahoo      ^(yahoo|ymail|rocketmail)\.[a-z]{2,3}(\.[a-z]{2,3})?$
gmx        ^gmx\.[a-z]{2,3}(\.[a-z]{2,3})?$
fastmail   ^fastmail\.[a-z]{2,3}(\.[a-z]{2,3})?$
yandex     ^yandex\.[a-z]{2,3}(\.[a-z]{2,3})?$
interia    ^interia\.(pl|eu|com)$
proton     ^(protonmail|proton)\.(com|ch|me)$
tuta       ^(tutanota|tutamail|tuta)\.(com|de|io)$
```

### 6.9. Warstwa domen jednorazowych (zewnętrzna, NIE utrzymywana ręcznie)

Tysiące pozycji, zmienne co dobę → **pobieraj cronem, nie wklejaj tutaj.** Dla Twojego use case traktuj tak samo: `company_domain_key = null`.

| Źródło | Raw | Uwaga |
|---|---|---|
| `disposable-email-domains/disposable-email-domains` | `raw.githubusercontent.com/disposable-email-domains/disposable-email-domains/main/disposable_email_blocklist.conf` | Standard de facto (używa go PyPI). Weź też `allowlist.conf`. |
| `disposable/disposable-email-domains` | `raw.githubusercontent.com/disposable/disposable-email-domains/master/domains.txt` | Aktualizacja **codzienna**. `domains_mx.txt` ≠ mapa MX (rozdz. 7.3). |
| `FGRibreau/mailchecker` | `raw.githubusercontent.com/FGRibreau/mailchecker/master/list.txt` | Deklaruje 55 734+ pozycji. MIT. |
| Kickbox open API | `https://open.kickbox.com/v1/disposable/{domena}` | Bez klucza, zwraca `{"disposable":true/false}`. Zero utrzymania. |

**Rekomendacja:** zacznij od Kickbox open API (0 utrzymania) — plik ściągaj dopiero, gdy latencja zacznie przeszkadzać.

### 6.10. Źródła zewnętrzne do scalenia (uzupełnienie tej listy)

| Źródło | Co daje | Licencja |
|---|---|---|
| `Kikobeats/free-email-domains` → `domains.json` | Rdzeń freemail, oparty na blocklist HubSpota — **najbliżej tego use case** | MIT |
| HubSpot „blocked domains" (CSV) | ~4 700 pozycji; ten sam problem co Twój (blok mintowania firm z formularzy) | własnościowa — sprawdź warunki przed redystrybucją |
| `willwhite/freemail` → `free.txt` | Rozdziela free od disposable | MIT |
| `konto-pocztowe.interia.pl/app/poczta/domainlist` | **Oficjalny** endpoint Interii | — |
| `mail.com/mail/domains/` | Oficjalna lista vanity mail.com | — |
| spamresource.com (GMX/web.de/mail.com, Fastmail) | Najlepsze referencje dla DACH i Fastmaila | — |


---

## 7. Czego NIE blokować — pułapki

### 7.1 Korporacyjni bliźniacy domen konsumenckich
Operator ma **dwie** domeny: konsumencką i korporacyjną. Blokuj tylko konsumencką.

| Konsumencka (blokuj) | Korporacyjna (**NIE blokuj**) |
|---|---|
| `orange.fr`, `orange.pl` | `orange.com` |
| `t-online.de` | `telekom.de` |
| `vodafone.de` | `vodafone.com` |
| `btinternet.com` | `bt.com` |
| `sfr.fr` | `sfr.com` |

Lista `never_block` w JSON jest **bezpiecznikiem** — jeśli ktoś kiedyś doda `orange.com`, walidator ma rzucić błąd.

**Uwaga na kolizję marek:** `o2.pl` (Polska, grupa WP) i `o2.co.uk` (UK, Telefónica) to **różne firmy**. Nie traktuj ich jako jednej rodziny.

### 7.2 🔴 Pułapka MX — dlaczego NIE budujemy blokady po rekordzie MX
Kuszące: „złapmy nowe domeny providera po MX". **Dla większości providerów to katastrofa.**

| MX | Co za nim stoi | Można blokować po MX? |
|---|---|---|
| `aspmx.l.google.com` | Google Workspace — **tysiące domen firmowych klientów** | ❌ **NIGDY** |
| `*.mail.protection.outlook.com` | Microsoft 365 — jw. | ❌ **NIGDY** |
| OVH, home.pl, nazwa.pl, cyberFolks | hosting — domeny klienckie | ❌ **NIGDY** |
| Zoho Mail (custom domains) | jw. | ❌ **NIGDY** |
| `mx0*.gmx.net`, MX wp.pl, MX interia.pl, MX mail.ru | **wyłącznie** skrzynki konsumenckie | ✅ bezpiecznie |

Blokada po MX Google Workspace zablokowałaby mintowanie **każdej** firmy używającej Google — czyli większości Twoich klientów B2B.

**Reguła: MX wolno używać tylko dla providerów freemail-only, i tylko jako uzupełnienie listy — nigdy jako źródło prawdy.**

### 7.3 Uwaga do `domains_mx.txt` (repo `disposable/disposable-email-domains`)
Nazwa myli. **To nie jest mapa domena→MX.** To zwykła lista domen **przefiltrowana** po tym, że mają żywy rekord MX. Publicznego, gotowego datasetu „domena → host MX" praktycznie nie ma — trzeba go zbudować samemu przez lookup DNS.

---

## 8. Utrzymanie

### 8.1 Kryterium wejścia na listę
Domena wchodzi, jeśli: **wiele niepowiązanych osób fizycznych może mieć adres w tej domenie.**
Domena **nie** wchodzi, jeśli: adresy w niej należą do jednej organizacji.

### 8.2 Procedura dodania
1. Dodaj do właściwej grupy w `gen_free_mail.py` (jedno źródło prawdy).
2. Ustaw `tier` i `c`.
3. Uruchom generator — musi przejść: brak duplikatów, brak konfliktu z `never_block`, **canary pusty**.
4. Bump `version` (semver: patch = domeny, minor = struktura, major = zmiana kontraktu).
5. Regeneruj `.json` + `.txt` + ten dokument.

### 8.3 Canary — test regresji
Generator sprawdza, że **żadna** z tych domen nie wpada w blokadę:
`acme.com`, `livechat.com`, `livechatinc.com`, `terravita.pl`, `claims.com`, `home.com`, `protonet.de`, `orange.com`, `telekom.de`, `msnbc.com`, `deliveroo.co.uk`
Dopisz tu **każdego realnego klienta OWOCNI**, którego domena wygląda podejrzanie.

### 8.4 Rytm
- Ręcznie: **raz na kwartał** (freemail konsumencki zmienia się wolno).
- Automatycznie: warstwa disposable — cron **codziennie** (rozdz. 6.9).
- Zawsze: gdy handlowiec zgłosi firmę-widmo w CRM → dopisz domenę + dopisz canary.

---

## 9. Znane luki — czego ten dokument NIE wie

Uczciwie, żeby nikt nie budował na fałszywej pewności:

1. **Pełna lista GMX** — krąży liczba ~130 domen. **Nie znam jej.** Mam 14 + wzorzec `^gmx\.<tld>$`. Źródło: spamresource (link w rozdz. 6.2).
2. **`mail.com` vanity (~150 pozycji)** — odtworzone z pamięci, **nie zweryfikowane 1:1**. To jednocześnie **najcenniejszy blok** (`consultant.com`, `lawyer.com` = idealne false-corporate). Źródło prawdy: `mail.com/mail/domains/`.
3. **Fastmail (~90 aliasów)** — jw., odtworzone z pamięci.
4. **Aliasy WP** — lista pochodzi ze źródeł wtórnych, nie z oficjalnego endpointu WP (Interia taki endpoint ma, WP **nie wiem** czy ma).
5. **`home.pl` / `nazwa.pl` / `az.pl`** — **nie wiem**, czy nadal wydają darmowe skrzynki konsumenckie. Blokuję prewencyjnie.
6. **`pf.pl`, `wp.eu`, `spray.pl`, `hoga.pl`, `1gb.pl`** — pochodzą z Twojej listy v0; **nie wiem**, czyje są ani czy żyją. Zostawione (koszt zerowy).
7. **Twenty CRM `isWorkEmail`** — **nie wiem**, gdzie dokładnie w 2.8.x leży stała ani czy zawiera PL. Do weryfikacji w repo.
8. **Brak repozytorium PL** — nie istnieje utrzymywane repo GitHub z polskimi freemailami. Ten plik jest de facto próbą jego zastąpienia.
9. **`.pl` i PSL** — nie sprawdziłem, czy któryś polski provider figuruje w **prywatnej** sekcji PSL. Gdyby figurował, eTLD+1 dla jego subdomen liczyłby się inaczej.

---

## 10. Changelog

| Wersja | Data | Zmiana |
|---|---|---|
| 1.0.0 | 2026-07-15 | Pierwsza wersja. Rozszerzenie listy v0 do **918** domen (PL/DE/FR/UK/global + reszta EU/świata). **Usunięto regułę substring** (rozdz. 3.1). Dodano zakotwiczone wzorce, `never_block`, `psl_collapses_to`, tiering A/B, confidence, canary. |
