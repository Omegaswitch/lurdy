# Third-party content and licences

| What | Where used | Licence / terms | Obligation met by |
|---|---|---|---|
| Leaflet 1.9.4 | map in the app (`platform/app/src/components/LourdesMap.tsx`) | BSD-2-Clause, © Volodymyr Agafonkin | the Leaflet prefix in the map's attribution control; this file |
| OpenStreetMap tiles and data | map tiles, place coordinates (`supabase/migrations/*places*`) | ODbL (data); tile usage policy for `tile.openstreetmap.org` | attribution in the map control, on the map screen and in the privacy notice. Before heavy use (an app in the stores), switch `EXPO_PUBLIC_MAP_TILES` to a provider that allows it — OSM's policy forbids distributing an app that uses its tile server without permission |
| Photographs of places | the map's place card (`public.places.photo_*`) | CC BY-SA 2.0 / 3.0 / 4.0, from Wikimedia Commons | author, licence and a link to the source page under each photo; the database refuses a photo without credit (`places_photo_credited`) |
| Asap typeface | admin, app, website | SIL Open Font License 1.1 (© Omnibus-Type) | `OFL.txt` alongside the font files |
| Emblem of the Order of Malta | admin header, app icon, badges | property of the Sovereign Order of Malta; used for the Czech Grand Priory's own pilgrimage | use authorised by the organisers for this platform only (record who, in `docs/STATUS.md`); never redistributed as a standalone asset |
| Supabase JS, Expo, React, Vite, Playwright, pptxgenjs… | tooling and runtime | MIT / Apache-2.0 (see `platform/pnpm-lock.yaml`) | notice files ship inside `node_modules`; `pnpm licenses list` for an inventory |
