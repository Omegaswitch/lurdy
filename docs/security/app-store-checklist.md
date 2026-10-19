# App Store and Google Play checklist

What the stores require, and where the app stands. "Done" means in the code and tested; "Before submission" items need the organisers or a store account.

## Done in the code
| Requirement | Where |
|---|---|
| Account deletion inside the app (Apple 5.1.1(v), Google Play account deletion policy) | Home → *Účet a soukromí* → *Smazat můj účet* (two steps). Edge Function `delete-account` + `public.delete_my_account`; e2e `account.spec.ts`. The registration stays with the organisers until they erase it; the admin shows "účet smazán" and can restore access. |
| Privacy policy reachable in the app and at a public address | Screen `/privacy`, linked from the login screen and from *Účet a soukromí*; on the web build the same page is at `https://<app address>/privacy`. Text in `platform/app/src/lib/privacy.ts`. |
| Purpose strings for every permission | `app.json`: camera (scanning badges only), location when in use (map only). Microphone, background location and overlay permissions are blocked on Android. |
| iOS privacy manifest | `app.json` → `ios.privacyManifests`: no tracking, no tracking domains; collected: name, user ID and "other user content" (the team's incident reports), linked to the person, for app functionality only; UserDefaults reason CA92.1. Expo packages ship their own manifests. |
| Secrets on the device | the phone's badge code is kept in the keychain/keystore (`expo-secure-store`), Android cloud backup of app data is off (`android.allowBackup: false`); sign-out wipes the offline copy and the badge code. The Supabase session (refresh token) is still in plain app storage — see the audit report for the planned encrypted storage. |
| Splash screen | `expo-splash-screen` plugin with the shield on red (`assets/splash-icon.png`). |
| Encryption export compliance | `ios.config.usesNonExemptEncryption: false` (only standard HTTPS). |
| No tracking, ads or third-party analytics | none in the app. |
| Works without an account being created by the person | sign-in codes are issued by the organisers; no sign-up screen. |
| iPad | `supportsTablet: false`: the phone layout runs on iPad (Apple still reviews it there — check once on an iPad simulator). |
| Accessibility | big buttons, text scaling, screen-reader labels; axe (WCAG 2.2 AA rules) on the web build. |

## Before submission (organisers / store accounts)
1. **Controller name and contact** in the privacy text (STATUS Q2), then publish the web build so `/privacy` has a real address.
2. **Apple Developer Program** and **Google Play Console** accounts in the organisation's name (an organisation account needs a D-U-N-S number). Who owns them should be the Grand Priory, not a private person.
3. **App Store Connect "App Privacy"** answers — match the manifest: Name and User ID, linked, app functionality, no tracking. **Google Play "Data safety"** — the same, plus "data is encrypted in transit" and "users can request deletion" (in-app).
4. **Reviewer access**: give App Review and Google a sign-in that works without the event — a fictional participant code in a dedicated *review* edition (never a real person's code), and for the team view a code + event code valid during the review window. Note in the review notes that codes are issued by the organisers.
5. **Content rating** questionnaires (no objectionable content).
6. **Screenshots** from the fictional development data only (`platform/e2e/tests/screenshots.spec.ts`).
7. **Google Play target API level**: built by EAS with the SDK's default target, which meets Play's current minimum; re-check when building.
8. **Test on real devices** (camera scanning, GPS, brightness) with an EAS development build before submitting.
9. Map photos (STATUS Q7) and OpenStreetMap tiles: before heavy use, switch to a tile provider that allows it (`EXPO_PUBLIC_MAP_TILES`).
