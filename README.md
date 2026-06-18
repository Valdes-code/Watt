# Watt

[![CI](https://github.com/Valdes-code/Watt/actions/workflows/ci.yml/badge.svg)](https://github.com/Valdes-code/Watt/actions/workflows/ci.yml)

**CycloWatt** – odhad výkonu na bicykli z fyziky, tepovej frekvencie a GPX trasy.

Aplikácia dopočíta výkon (watty) aj bez wattmetra: kombinuje fyzikálny model
(gravitácia, odpor vzduchu, valivý odpor) s odhadom z tepu a s reálnymi dátami
z GPX súborov.

## Spustenie

```bash
npm install
npm run dev      # vývojový server (Vite)
npm run build    # produkčný build
npm test         # unit testy (Vitest)
```

## Štruktúra

```
src/
  lib/
    physics.js           # zdieľaný fyzikálny engine (výkon, CdA, hustota vzduchu, fúzia)
    rollingResistance.js # model valivého odporu + samoučenie Crr z wattmetra
    gpx.js               # parser GPX + dopočet výkonu pre každý úsek trasy
    sampleGpx.js         # ukážkové GPX trasy pre demo
  components/
    CycloWattPreview.jsx # náhľad mobilnej appky (jazda / snímače / profil)
    RideAnalysis.jsx     # analýza jazdy na mape + scrub graf výkonu
    GpxImport.jsx        # import jazdy z GPX (používa lib/gpx.js)
    PoseDetectionDemo.jsx# detekcia polohy tela → CdA
```

## Import GPX (`lib/gpx.js`)

- `parseGpx(xml)` – z GPX textu vytiahne trackpointy (`lat`, `lon`, `ele`,
  `time`) a prípadný výkon z `<extensions><power>`. Beží v prehliadači aj v Node.
- `analyzeRide(points, profile?)` – spočíta vzdialenosť (haversine), prevýšenie,
  trvanie a pre každý úsek rýchlosť, sklon a výkon. Ak v súbore chýba wattmeter,
  výkon dopočíta z fyziky; inak použije namerané hodnoty.
- `importGpx(xml, profile?)` – pohodlný obal: z textu rovno vráti súhrn jazdy.
