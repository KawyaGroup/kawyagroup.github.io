# Kawya Group website

Static website for **GitHub Pages**, with an admin page that saves to **Firebase Firestore** (free Spark plan, no paid Storage needed).

| Page | What it is |
|---|---|
| `index.html` | The website: Home, About us, Products (Concrete items / Transport / Hardware), item pages, Transport, Contact. |
| `admin.html` | Owner-only admin page. It is not linked from the website. Open `https://<your-site>/admin.html`. |

## What the admin can change
- **Products & vehicles**: add, edit, hide, reorder or delete items in the three sections. Each item has photos (up to 8), a short and full description, details (size, capacity…), an SLS badge, a custom badge, "show on home page" and "available for hire". No prices are shown on the site.
- **Categories**: categories and sub-categories in each section, nested as deep as needed. You can rename, reorder or delete them, or move one into another category. Deleting one moves its sub-categories and items up a level, so nothing is lost.
- **Home page**: title texts, the curved photo row, the numbers row, the three service texts and the SLS band.
- **About us**: company story and photo, **owner photo, name, position and message**, SLS text and **certificate photos**, mission, vision and values.
- **Transport page**: texts and highlights. Vehicles themselves are edited under *Products & vehicles → Transport*.
- **Contact details**: phone numbers, **WhatsApp number**, email, address, open hours, Google Maps link and pin location, Facebook.

Photos are resized and re-encoded in the browser before upload. This removes hidden data such as GPS location. A small thumbnail is stored with the item and the full photo in the `media` collection.

## 1. Put the site on GitHub Pages
1. Create a GitHub repository, for example `kawya-group`.
2. Upload **everything in this folder** to the repository root (keep the `.nojekyll` file).
3. Repository **Settings → Pages → Deploy from a branch → `main` / root → Save**.
4. After a minute the site is live at `https://<username>.github.io/kawya-group/`.

Until Firebase is connected, the live site shows the built-in sample content and `admin.html` shows the setup steps.

## 2. Connect Firebase (once)
1. Go to https://console.firebase.google.com, choose **Add project**, and create it (Analytics not needed).
2. **Build → Firestore Database → Create database**, choose **production mode** and a location near Sri Lanka (e.g. `asia-south1`).
3. **Build → Authentication → Get started → Email/Password → Enable**.
4. **Authentication → Users → Add user**: enter the owner's email and a strong password. Copy the **User UID** shown in the list.
5. Open `firestore.rules`, replace `OWNER_UID_HERE` with that UID (to allow two people, use `['UID1', 'UID2']`), then paste the whole file into **Firestore → Rules** and press **Publish**.
6. **Project settings (gear) → General → Your apps → Web (</>)**: register an app, then copy the `firebaseConfig` values into `js/firebase-config.js`.
7. **Authentication → Settings → Authorized domains → Add domain**: `<username>.github.io`.
8. Upload the changed `js/firebase-config.js` to GitHub.
9. Open `admin.html`, sign in, and press **Publish starting content** on the Overview. Then replace the sample items, numbers and photos with Kawya Group's real ones.

The Firebase web config is **not a secret**. The Firestore rules are what stop other people from editing.

## Security
- Only the owner UID in `firestore.rules` can write. Every field is type-checked and size-limited by the rules, and anything not listed is closed.
- Hidden items cannot be read by the public. Full-size photos can be fetched by id but not listed.
- The website never inserts saved text as HTML (no XSS), and links are checked (`tel:`, `wa.me`, Google Maps and Facebook only).
- Both pages have a strict Content-Security-Policy. The admin page refuses to run inside a frame, has `noindex`, and is blocked in `robots.txt`.
- Admin sign-in lasts only until the tab is closed, or 30 minutes without activity. Repeated wrong passwords are slowed down.

**Recommended extra steps in Google Cloud / Firebase:**
1. **Restrict the API key**: Google Cloud Console → APIs & Services → Credentials → the "Browser key" → *Website restrictions* → add `https://<username>.github.io/*` (and `http://localhost:8782/*` for testing).
2. **Turn off public sign-up**: Authentication → Settings → User actions → untick *Enable create (sign-up)*. Even without this, new accounts cannot edit anything, because the rules only trust the owner UID.
3. Optional: **App Check** with reCAPTCHA Enterprise, to reduce abuse of your free read quota.
4. Use a strong, unique password for the owner account.

## Free-plan limits
The free Spark plan allows 50,000 reads a day. One visit reads about one document per item and category, plus a few site documents. A returning visitor re-uses the content for 5 minutes. That is enough for a local business. If the site ever outgrows it, switch the project to the Blaze plan; small sites usually stay within the free allowance.

## Preview on this computer
The site uses JavaScript modules, so open it through a local server:

```
python -m http.server 8782
```
Then visit http://localhost:8782 and http://localhost:8782/admin.html.

While `js/firebase-config.js` is not filled in, **localhost runs in test mode**. Sign in to admin with `demo@local` / `demo1234`. Changes are stored only in that browser, so you can try everything safely. Test mode never runs on the live site.

## Files
- `js/data.js`: data layer, default content, input cleaning.
- `js/app.js`: website pages, routing and animations.
- `js/admin.js`: admin page.
- `js/ui.js`: safe DOM helper and icons.
- `css/site.css`, `css/admin.css`: styles.
- `assets/img/`: logo (`logo.svg`, `mark.svg`), SLS mark, yard photos and sample product drawings (`p-*.svg`). Replace the sample items with real photos in admin.
