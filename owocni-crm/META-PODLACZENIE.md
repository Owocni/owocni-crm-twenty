> **Zakres dokumentu:** Meta Lead Ads / Conversions API (leadgen_id, action_source, field_data). **Nie** opisuje pipeline Twenty → Sortownia → GCP (`EVENT_CONTRACT.md`, `ARCHITECTURE.md`). Lead z Meta Insta FORM wchodzi osobną ścieżką — patrz `IDENTITY_AND_INBOUND.md`.

Co dokładnie dostajesz — dwie warstwy

Warstwa 1 — Webhook (przychodzi natychmiast z Facebooka, push):

leadgen_id, page_id, form_id, adgroup_id, ad_id, created_time

Warstwa 2 — Retrieval (pobierasz sam, pull, callem po leadgen_id):

id (= leadgen_id), created_time, ad_id, form_id, field_data[...]

Tu dochodzi field_data (odpowiedzi z formularza).
Ale w retrieval NIE ma adgroup_id — jest tylko ad_id.
Adgroup masz wyłącznie z webhooka.

ad_id — kiedy przychodzi, kiedy nie

Przychodzi domyślnie, z jednym udokumentowanym wyjątkiem: brakuje ad_id/adgroup_id, gdy:

    lead jest organiczny (wtedy is_organic=1 w eksporcie) — nie z reklamy

    lead z Ad Preview (testowy)

    osoba pobierająca nie ma uprawnień advertiser na koncie reklamowym

Dla realnych leadów z płatnej reklamy ad_id jest.
Zakładam, że u Ciebie (płatny lead-gen B2B) ad_id przychodzi ~zawsze poza testami.

Co to znaczy dla atrybucji i pipeline przez CAPI

Nie potrzebujesz fbclid — masz ad_id, który jest lepszy dla Twojego celu.
ad_id w webhooku daje Ci deterministyczną atrybucję do konkretnej reklamy (i adgroup_id do zestawu). To pełna atrybucja reklamowa, tyle że przez identyfikator reklamy, nie kliknięcia.

Dla CAPI event przy SQL kluczowy jest leadgen_id (jako lead_id w payloadzie CAPI)
— to on domyka pętlę do konkretnego leada i przez niego Meta zna też reklamę. ad_id przechowaj do własnego raportowania (która reklama daje SQL), ale do samego CAPI-CL wystarcza lead_id.
Minimalny pipeline

Krok

Co zapisać/wysłać

Webhook
(capture)

leadgen_id (→ Twój „lead_id"), ad_id, adgroup_id

Retrieval (opcjonalnie)

call po leadgen_id → field_data, jeśli chcesz treść formularza do obsługi

Storage

leadgen_id trwale (klucz CAPI); ad_id do raportowania

Wysyłka przy
SQL (CAPI)

event_name, event_time, event_id, lead_id=leadgen_id, action_source=system

Bez

fbc, email, phone, value

Ważne: Przy prompcie należy wpisać kontekst mocno.

Że jest to non purchase z “Insta FORM” low-n. - Bo to zmienia wynik.
W porównaniu np z Insta form + WEB.

Chodzi o to, że w tym kontekście META ma pełne panowanie nad userem.
I w tym - wyłącznie w tym wąskim przypadku LEAD ID ma w sobie komplet informacji.

Powoduje to że samo odesłanie ten LEAD ID to SQL - Wystarczy.
Bez oglądania się na CAPI, EMQ czy Pipeline Health Score.

EMQ liczy się TYLKO dla action_source=website.
Dotyczy wyłącznie eventów website przez CAPI.

Twój event to action_source=system (CRM lead).

EMQ jako metryka nie jest liczony dla eventów CRM-system w ten sam sposób.
Dla offline/CRM Meta używa osobnego Offline Data Quality (ODQ), nie EMQ.

Niedopasowany identyfikator = ignorowany, nie karany.

Wielokrotnie potwierdzone: niedopasowane eventy dają „zero optimisation value" — Meta ich nie używa, ale nie ma mechanizmu kary za obecność niedopasowanego parametru przy jednoczesnym pewnym kluczu. Model jest addytywny („more parameters = better matching"), a nie odejmujący. Sprzeczność obniża EMQ jako score, ale nie ma dowodu, że psuje samo dopasowanie, gdy istnieje silniejszy klucz.

ALE RYZYKO, KTÓRE POZOSTAJE NIEJASNE:

Ryzyko: dosyłając firmowy email/phone karmisz Andromedę dodatkowym fałszywym profilem behawioralnym „użytkownika firmowego - jeśli też zostanie zmaczowany", więc gdy część tych hashy przypadkowo zmatchuje realne konta, algorytm zaczyna traktować ich jako wzorzec konwersji i poluje na podobnych — rozwadniając sygnał SQL leadami-sobowtórami zamiast prawdziwych SQL.

Nie mam twardego dowodu Meta, że sprzeczne PII w jednym evencie CL na pewno szkodzi — ale mam wystarczająco, by rozstrzygnąć decyzję: szkoda jest możliwa i niezmierzalna, a zysk jest zerowy (lead_id sam wpina usera).

Przy Twoim wymaganiu „ominięcie realnej szkody jest najważniejsze przy low-n"
— decyzja jest jednoznaczna, bo asymetria jest jednostronna.

Kręcimy się w kółko, bo szukamy dowodu na mechanikę, której Meta nie publikuje.
Ale decyzja nie wymaga tego dowodu — wymaga tylko oceny asymetrii.

A ta jest jednostronna:

Wysyłasz firmowe PII

Nie wysyłasz (lead_id-only)

Zysk

zero (lead_id już wpina usera — payload spec: Highest, wystarczający)

—

Ryzyko

wektor sprzeczności lead_id≠email, niezbadany, niezmierzalny

zero — brak sprzeczności do rozstrzygnięcia

Nie musisz wiedzieć, czy pesymistyczny scenariusz się realizuje.
Musisz tylko zauważyć, że nie ma nic po stronie zysku, co uzasadniałoby wzięcie nawet małego ryzyka. To rozstrzyga jednoznacznie: przy zerowym upside każdy niezerowy, niezbadany downside przechyla na „nie wysyłać".
