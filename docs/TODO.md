# CycloWatt — To-Do / Backlog

Zoznam väčších vecí, ku ktorým sa vrátime. Hotové každodenné úpravy tu nevedieme.

---

## 🟥 Vyžaduje server + webovú appku (vrátiť sa pri riešení backendu)

### Zdieľanie trasy jazdy s priateľmi (vrátane avíza Prijať/Odmietnuť)
**Stav:** odložené — čaká na backend. Diskutované 2026-06.

**Cieľ:** používateľ zdieľa trasu s konkrétnym priateľom; priateľovi príde **avízo
v appke** (a ideálne aj push, keď je appka zatvorená), ktoré vie **prijať** (trasa
sa pridá do jeho Histórie jázd) alebo **odmietnuť**.

**Čo treba doplniť:**
- [ ] **Účty a prihlásenie** (e-mail / Google / Apple).
- [ ] **Zoznam priateľov** (párovanie, pozvánky).
- [ ] **Backend + databáza** — zdieľanie so stavom `čaká / prijaté / odmietnuté`
      (odosielateľ, príjemca, trasa).
- [ ] **In-app inbox „Zdieľania"** — pri otvorení appky zobraziť čakajúce
      zdieľania s tlačidlami *Prijať / Odmietnuť*.
- [ ] **Push notifikácie** cez Web Push — vyžaduje spraviť z appky **PWA**
      (service worker, „Pridať na plochu"; iOS push len pre nainštalované PWA).
- [ ] **Akcie:** *Prijať* → pridať do Histórie jázd; *Odmietnuť* → zahodiť;
      odosielateľ vidí stav.

**Odporúčaná cesta:** postaviť na hotovom backende (**Firebase** alebo **Supabase**)
— auth + databáza + push „z krabice“, výrazne rýchlejšie než vlastný server.

**Fázovanie:**
1. *(Bez servera, dá sa hneď)* Zdieľanie **GPX cez Web Share API** — kamarát súbor
   naimportuje. Bez avíza, ale funkčné. — **Nezávisí na backende, môže ísť skôr.**
2. *(Backend)* Účty + priatelia + **inbox zdieľaní s Prijať/Odmietnuť** (in-app avízo).
3. *(PWA)* **Push notifikácie** aj keď je appka zatvorená.

---

### Online tracking (živé nahrávanie jazdy + živé zdieľanie polohy)
**Stav:** odložené. Diskutované 2026-07.

**Cieľ:** naživo nahrávať jazdu (poloha, rýchlosť, vzdialenosť, prevýšenie,
odhad výkonu) a voliteľne umožniť priateľom sledovať polohu naživo online.

**Dve úrovne:**
1. *(Bez servera, dá sa skôr)* **Živé nahrávanie jazdy** vo web appke:
   - [ ] `navigator.geolocation.watchPosition` → živá trasa na mape.
   - [ ] Živé metriky (rýchlosť, vzdialenosť, prevýšenie, odhad výkonu z fyziky).
   - [ ] **Wake Lock** (držať obrazovku zapnutú) + upozornenie na spotrebu batérie.
   - [ ] Po skončení uložiť jazdu do Histórie (GPX).
   - ⚠️ **Limit webu:** iOS Safari pozastaví JS na pozadí / pri zamknutej
         obrazovke → tracking sa zastaví. Spoľahlivé background GPS až v
         natívnej appke / **Capacitor** wrapperi.
   - ⚠️ BLE snímače (tep/výkon) cez Web Bluetooth len Android/Chrome, nie iOS Safari.
2. *(Backend)* **Živé zdieľanie polohy** – priateľ vidí cez odkaz, kde práve som:
   - [ ] Účty + real-time kanál (WebSocket / Firebase / Supabase).
   - [ ] Publikovanie polohy + verejný/priateľský živý náhľad.
   - [ ] Súvisí s účtami a zdieľaním z bodu „Zdieľanie trasy".

**Odporúčaná cesta pre background GPS:** zabaliť web cez **Capacitor** (alebo
natívna appka) – umožní GPS na pozadí aj pri zamknutom telefóne.

---

### Cloudová história jázd / ukladanie na server
**Stav:** odložené — spomenuté pri limite localStorage.
- [ ] Ukladanie celej histórie jázd (napr. všetky GPX za rok) na server namiesto
      lokálneho úložiska prehliadača.
- [ ] Synchronizácia medzi zariadeniami.
- [ ] Súvisí s účtami z bodu „Zdieľanie trasy".

---

## 🟨 Integrácie (čaká na dohodu s tretími stranami)

### Prepojenie s Kalorickými tabuľkami (prijaté kalórie)
**Stav:** podklad pripravený — viď [`integracia-kaloricke-tabulky.md`](./integracia-kaloricke-tabulky.md).
- [ ] Dohoda s prevádzkovateľom KT (OAuth 2.0 read-only + endpoint na denný príjem).
- [ ] DPA / súhlas používateľa (GDPR).
- [ ] V appke: prepojenie účtu + zobrazenie **energetickej bilancie**
      (prijaté z KT − spálené z jazdy; spálené si appka dopočíta sama).

---

## 🟩 Nápady bez závislosti na serveri (dajú sa kedykoľvek)
- [ ] Zdieľanie trasy **GPX cez Web Share** (Fáza 1 vyššie).
- [ ] Editovateľný **Profil jazdca** (hmotnosť atď.) uložený lokálne a použitý vo
      výpočte výkonu (teraz natvrdo 75 kg).
- [ ] Odhad **spálených kcal** ku každej jazde v Analýze.
