# Integračný brief — prepojenie CycloWatt ↔ Kalorické tabuľky

**Účel:** umožniť používateľovi, ktorý si vedie jedálniček v aplikácii *Kalorické
tabuľky* (ďalej „KT"), aby sa jeho **prijaté kalórie** automaticky zobrazovali v
aplikácii **CycloWatt** a porovnali so **spálenými kalóriami z jazdy**. Cieľom je
**energetická bilancia bez duplicitného zadávania** — používateľ dáta zapisuje len
raz, v KT.

**Čo NEpotrebujeme:** žiadne GPS trasy, jedlá receptov ani úprava dát v KT.
Potrebujeme len **čítanie príjmu kalórií** so súhlasom používateľa.

---

## 1. Technická požiadavka (read-only)

### 1.1 Autorizácia — OAuth 2.0
- **Authorization Code flow + refresh token.** Používateľ v CycloWatt klikne
  „Prepojiť s Kalorickými tabuľkami", prihlási sa na strane KT a **autorizuje
  čítanie**. CycloWatt nikdy nevidí jeho heslo.
- Od KT potrebujeme: `client_id`, `client_secret`, **authorize URL**, **token URL**
  a dokumentáciu.
- **Scope** obmedzený na čítanie výživy, napr. `nutrition.read`.
- Možnosť **odvolania súhlasu** (revoke tokenu) na strane KT aj na náš podnet.

### 1.2 Kľúčový endpoint — denný súhrn príjmu
Stačí jeden:

```
GET /api/v1/nutrition/daily?from=YYYY-MM-DD&to=YYYY-MM-DD
Authorization: Bearer <access_token>
```

Odpoveď (JSON), príklad:

```json
{
  "timezone": "Europe/Bratislava",
  "days": [
    {
      "date": "2026-06-28",
      "energy_kcal": 2180,
      "energy_kj": 9121,
      "protein_g": 118,
      "carbs_g": 240,
      "fat_g": 72,
      "fiber_g": 31
    }
  ]
}
```

Požiadavky na endpoint:
- **rozsah dátumov** (`from`/`to`) a **stránkovanie** pri väčších rozsahoch,
- **jednotky jednoznačne** — `kcal` aj `kJ` (alebo definovať, ktorá),
- **časové pásmo**, aby „deň" sedel s dňom jazdy,
- vracia **skutočne zaznamenaný príjem** za deň (nie cieľ/plán).

### 1.3 Voliteľné (bonus, nie podmienka)
- **Per-jedlo položky** (raňajky/obed/večera/snack) pre detailnejší rozpis.
- **Webhook** „nová/zmenená položka denníka", aby sme nemuseli pravidelne dopytovať.
- **Telesná hmotnosť** (`weight.read`) — využili by sme ju vo výpočte výkonu.

### 1.4 Prevádzka
- **Sandbox / testovací účet** + ukážkové dáta.
- **Rate limity** a kontakt na technickú podporu.
- Komunikácia výhradne cez **HTTPS**, tokeny uložené bezpečne, **minimalizácia
  scope** (len čítanie výživy).

### Náhradné riešenie, ak nie je plné API
- **Server-to-server dátový feed** alebo **podpísaný strojový export (JSON/CSV)**
  na vyžiadanie. Horšie UX (nie je to živé), ale tiež bez ručného prepisovania.

---

## 2. Identita používateľa
Cez OAuth token sa používateľ CycloWatt **automaticky napáruje** na svoj KT účet.
Netreba zdieľať e-maily ani manuálne párovať účty.

---

## 3. Právne / GDPR
- **Partnerská zmluva + Data Processing Agreement (DPA)** — príjem kalórií je
  zdravotne-citlivý údaj; jasne určiť roly **správca / spracovateľ**.
- **Súhlas používateľa** so zdieľaním (pokrytý OAuth súhlasom).
- **Povolenie použiť dáta** v CycloWatt (zobraziť, počítať bilanciu, uložiť).
- Úprava **zásad ochrany súkromia** na oboch stranách + mechanizmus **odvolania**.
- Prípadné **komerčné podmienky** (poplatok / revenue share).

---

## 4. Otvorené otázky na prevádzkovateľa KT
1. Vracia API **skutočne zaznamenaný príjem za deň** (nie cieľ/plán)?
2. Stačí **denný súčet**, alebo viete poskytnúť aj **per-jedlo**?
3. Sú dostupné **historické dáta** (spätné načítanie), alebo len nové?
4. **kcal vs kJ** a aké **zaokrúhľovanie**?
5. Existuje **sandbox** a aké sú **rate limity**?
6. Je možný **webhook** na nové položky?

---

## 5. Minimálne životaschopné riešenie (MVP)
> **OAuth 2.0 (read-only) + endpoint na denný príjem kalórií + DPA/súhlas.**

To samo stačí. Spálené kalórie z jazdy si CycloWatt **dopočíta sám** z výkonu a
času (práca v kJ ≈ spálené kcal vďaka ~24 % účinnosti), takže výsledná
**energetická bilancia funguje úplne bez ručného zadávania**.

---

*Kontakt za CycloWatt: doplniť. Verzia briefu: v1.*
