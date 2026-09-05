# 🛡️ SafeSearch — Personal Search & Website Blocker

<p align="center">
  <img src="https://img.shields.io/badge/Manifest-V3-blue?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Manifest V3">
  <img src="https://img.shields.io/badge/Platform-Chrome%20%7C%20Edge%20%7C%20Firefox%20%7C%20Android-orange?style=for-the-badge" alt="Browsers">
  <img src="https://img.shields.io/badge/Privacy-100%25%20Local-success?style=for-the-badge" alt="100% Local">
  <img src="https://img.shields.io/badge/Version-1.3-informational?style=for-the-badge" alt="Version 1.3">
  <img src="https://img.shields.io/badge/License-MIT-purple?style=for-the-badge" alt="License">
</p>

A powerful, privacy-first cross-browser extension (Manifest V3) designed to eliminate digital distractions, protect your attention, and build unbreakable self-discipline across **Google Chrome**, **Microsoft Edge**, **Mozilla Firefox Desktop**, and **Firefox for Android**.

Unlike standard blockers that are easy to disable on a whim or bypass with simple typos, **SafeSearch** incorporates **phonetic fuzzy matching**, **irreversible search keyword blocking**, **granularity down to exact URL paths**, and **tamper-resistant time-locked defense mechanisms**.

---

## ✨ Key Features

### 1. 🔒 Irreversible Search Keyword Blocking
- Block unwanted queries across major search engines: **Google**, **YouTube**, **Bing**, **DuckDuckGo**, and **Yahoo**.
- **Psychological Commitment Lock:** Once a keyword is added, it is permanently locked and deliberately hidden from the interface. You cannot simply open the popup and delete it during a moment of weakness or craving.

### 2. 🧠 Smart Phonetic & Fuzzy Normalization Engine
People often unconsciously or deliberately bypass keyword filters using typos, slang, or alternative spellings. SafeSearch includes an intelligent normalization engine:
- **Sound-Alike Substitutions:** Handles common phonetic variations (e.g., `z` ⇄ `j`, `w` ⇄ `v`, `ee`/`ea` ⇄ `i`, `oo`/`ou` ⇄ `u`).
- **Aspirated / Silent Consonants:** Normalizes common letter patterns (`bh` ⇄ `b`, `dh` ⇄ `d`, `th` ⇄ `t`, `kh` ⇄ `k`, `ph` ⇄ `f`, `sh` ⇄ `s`).
- **Duplicate Letter Collapse:** Strips excessive repeating characters (e.g., `goooogle` ➔ `google`, `loool` ➔ `lol`).
- **Space-Insensitive Matching:** Detects queries whether spaced or compressed (e.g., `onlinecasino` vs `online casino`).
- **Word Reordering:** Catches queries even when words are reversed (e.g., `gossip celebrity` vs `celebrity gossip`).
- **Levenshtein Distance Typo Tolerance:** Catches 1-character typos on words with 4 or more characters.

### 3. 🌐 Domain & Granular URL Path Blocking
- **Full Domain Blocking:** Block entire domains and all subdomains (e.g., `distractingsite.com`).
- **Exact Path Filtering:** Block specific high-distraction sections while preserving productive parts of a platform (e.g., block `youtube.com/shorts` while keeping long-form tutorials accessible).
- **Instant Tab Sweep:** Adding a block rule immediately scans all currently open tabs and redirects matching sessions in real time.

### 4. ⏱️ Time-Locked Self-Control
- Schedule website blocks with a specific unlock time (e.g., `Lock Access Until: 22:00` / 10:00 PM).
- **Quick Presets:** `+30m`, `+1h`, `+2h`, `10 PM`, or `Always` (Permanent Block).
- **Tamper-Resistant:** The delete/unblock button is strictly **disabled and locked** with a live countdown ticker until the designated time has elapsed.

### 5. ⚡ Native Manifest V3 Performance & Zero Bypass
- Powered by modern **`declarativeNetRequest`** for instantaneous, zero-flicker network-level redirects.
- Dedicated SPA (Single-Page Application) observer handles YouTube dynamic in-page navigation (`yt-navigate-finish`, `popstate`, URL changes).

### 6. 🛡️ 100% Private & Offline
- **Zero data collection.**
- **Zero analytics or external network requests.**
- Everything is stored strictly inside your browser's local sandbox via `storage.local`.

---

## 📸 How It Works

```text
User Action: Search or Visit URL
           │
           ├─── Is it a blocked website or URL path?
           │         │
           │         ├── Yes ──► Redirected via declarativeNetRequest to blocked.html
           │         └── No  ──► Continue
           │
           └─── Is it a search engine query?
                     │
                     ├── Phonetic Canonicalization (collapse repeats, sound-alikes)
                     ├── Levenshtein Typo Tolerance Check
                     ├── Space-less & Reorder Comparison
                     │
                     ├── Match Found ──► Page halted & custom focus shield mounted
                     └── No Match    ──► Normal search results displayed
```

---

## 📂 Project Structure

```text
SafeSearch/
│
├── src/                         # Universal source code
│   ├── background/
│   │   └── background.js        # DNR rules manager & tab sweeping
│   ├── content/
│   │   └── content.js           # Search inspector & phonetic matching engine
│   ├── popup/
│   │   ├── popup.html           # Extension popup layout
│   │   └── popup.js             # Timer locks & local storage controller
│   ├── blocked/
│   │   ├── blocked.html         # Focus redirect screen
│   │   └── blocked.js           # Safe navigation controller
│   └── shared/
│       └── style.css            # Responsive dark mode design system
│
├── manifests/                   # Browser-specific manifest files
│   ├── manifest.chrome.json     # Chrome & Microsoft Edge (MV3)
│   └── manifest.firefox.json    # Firefox Desktop & Firefox Android (MV3)
│
├── dist/                        # Ready-to-load distribution builds
│   ├── chrome/                  # Ready for Chrome & Edge Developer Mode
│   └── firefox/                 # Ready for Firefox Desktop & Android
│
├── build.js                     # Cross-platform build script (Node.js)
├── build.bat                    # One-click Windows builder
└── README.md                    # Documentation
```

---

## 🚀 Installation & Testing Instructions

SafeSearch provides ready-to-load builds under `dist/chrome/` and `dist/firefox/`.

### 1. Google Chrome Desktop

1. Open Chrome and navigate to `chrome://extensions`.
2. Turn on **Developer mode** using the toggle in the top-right corner.
3. Click the **Load unpacked** button in the top-left corner.
4. Select the **`dist/chrome`** directory from this project.
5. SafeSearch is now active! Click the puzzle icon on your toolbar and pin **SafeSearch 🛡️**.

---

### 2. Microsoft Edge Desktop

1. Open Edge and navigate to `edge://extensions`.
2. Enable **Developer mode** using the switch in the bottom-left sidebar.
3. Click the **Load unpacked** button at the top.
4. Select the **`dist/chrome`** directory from this project.
5. Pin **SafeSearch 🛡️** to the toolbar.

---

### 3. Mozilla Firefox Desktop

#### Temporary Testing (Developer / Debug Mode)
1. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on...**.
3. Navigate to the **`dist/firefox`** directory and select the **`manifest.json`** file.
4. The extension will load immediately.
*(Note: Temporary extensions remain loaded until Firefox is restarted. To install permanently without publishing, use Firefox Developer Edition or Nightly with `xpinstall.signatures.required = false` in `about:config`, or sign via AMO).*

---

### 4. Firefox for Android

Firefox for Android supports Manifest V3 extensions using the Gecko engine. You have three primary ways to test and install custom extensions on Android:

#### Option A: One-Click Testing via `web-ext` (Recommended for Developers)
1. On your Android device:
   - Enable **Developer Options** and turn on **USB Debugging**.
   - Install **Firefox Nightly** (or **Firefox Beta**) from Google Play.
   - In Firefox settings, tap **Settings** ➔ enable **Remote debugging via USB**.
2. Connect your Android device to your computer via USB cable.
3. In a terminal on your computer:
   ```bash
   npx web-ext run --target=firefox-android --source-dir=dist/firefox
   ```
4. SafeSearch is automatically deployed and running on your Android device!

#### Option B: Direct `.xpi` Install on Firefox Nightly for Android
1. Open **Firefox Nightly** on Android.
2. Go to **Settings** ➔ **About Firefox Nightly**.
3. Tap the **Firefox logo 5 times** until the toast notification says *"Debug menu enabled"*.
4. Go back to main **Settings** ➔ tap the new menu item **"Install add-on from file"**.
5. Select a signed `.xpi` file (or an unsigned `.xpi` if `xpinstall.signatures.required` is disabled in `about:config`).
   > *Note:* Android file pickers require the file extension to be `.xpi`. If you created a `.zip` archive of `dist/firefox`, rename the file extension from `.zip` to `.xpi` before selecting it.

#### Option C: Custom Add-on Collection (Persistent Installation)
1. Log in to [addons.mozilla.org (AMO)](https://addons.mozilla.org/).
2. Create a new Collection under your profile (e.g. named `MyTools`).
3. Add your signed extension to the collection.
4. In Firefox Nightly or Beta on Android ➔ **Settings** ➔ tap logo 5 times ➔ **Custom Add-on collection**.
5. Enter your AMO User ID and Collection Name. Firefox Android will install SafeSearch directly from your collection.

---

## 🌐 Verified Cross-Browser Compatibility Matrix

| Feature | Chrome | Edge | Firefox Desktop | Firefox Android | Notes |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Website Blocking** | Fully supported | Fully supported | Fully supported | Supported with limitations | `declarativeNetRequest` redirect works. Sweeping *already-open* background tabs via `tabs.query`/`tabs.update` is unsupported on Firefox Android. |
| **URL Redirect** | Fully supported | Fully supported | Fully supported | Fully supported | Redirects to `/blocked/blocked.html` via `declarativeNetRequest`. |
| **Keyword Blocking** | Fully supported | Fully supported | Fully supported | Fully supported | Search query extraction, phonetic normalization, Levenshtein distance, and focus shield overlay. |
| **Content Scripts** | Fully supported | Fully supported | Fully supported | Fully supported | Injected at `document_start` on Google, Bing, YouTube, Yahoo, DuckDuckGo. |
| **Storage** | Fully supported | Fully supported | Fully supported | Fully supported | Local sandbox persistence via `storage.local`. |
| **Popup** | Fully supported | Fully supported | Fully supported | Supported with limitations | Works on mobile with responsive layout; renders in mobile browser sub-sheet rather than desktop toolbar bubble. |
| **Time Lock** | Fully supported | Fully supported | Fully supported | Fully supported | Target timestamp locking and live ticker disable delete button until expiry. |
| **Granular URL Path Filtering** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | Matches both domain boundaries (`||domain^`) and specific paths (`||site.com/path*`). |
| **Search Keyword Filtering** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | Runs at `document_start` on Google, Bing, YouTube, Yahoo, DuckDuckGo. |
| **Phonetic & Typo Tolerance** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | 100% pure client-side algorithmic matching (Levenshtein + phonetic transforms). |
| **Popup UI & Timers** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | Responsive styling (`@media (max-width: 430px)`) adapts to mobile phone screens. |
| **Active Tab Sweeping** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | Uses `tabs.query` and `tabs.update` to redirect active tabs matching newly added rules. |
| **Safe Go Back Navigation** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | Firefox redirects safely to search engine instead of restricted `chrome://newtab` or `about:newtab`. |

---

## 📱 Firefox Android: Capabilities & Limitations

### What Works
- **Dynamic declarative network requests:** Network-level blocking works identically to desktop.
- **Search engine interception:** Content scripts inject properly on mobile search pages.
- **Local storage & timer locks:** Timers and countdown badges persist reliably.
- **Responsive interface:** Mobile popup layout fits smartphone viewport width without horizontal scrollbars.

### Technical Limitations & Explanations
1. **Extension Installation Restrictions:** Standard consumer Firefox on Android only permits extensions from Mozilla's vetted list on AMO. For custom or development builds, Firefox Nightly or developer tools (`web-ext`) are required.
2. **Tab Interface differences:** On mobile Firefox, extension popups open in a sub-view or separate sheet rather than an anchored toolbar bubble.
3. **Privileged Schemes:** Navigating tabs to internal schemes like `about:newtab` is blocked by Firefox security restrictions; SafeSearch handles this gracefully by redirecting to Google on history bounce.

---

## 🛠️ Building & Developing

If you modify source code in `src/` or manifests in `manifests/`:

```bash
# Using Node.js:
node build.js

# Or on Windows:
build.bat
```

This compiles and syncs all changes into both `dist/chrome/` and `dist/firefox/`.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
