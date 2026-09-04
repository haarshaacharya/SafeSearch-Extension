# 🛡️ SafeSearch — Personal Search & Website Blocker

<p align="center">
  <img src="https://img.shields.io/badge/Manifest-V3-blue?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Manifest V3">
  <img src="https://img.shields.io/badge/Platform-Chrome%20%7C%20Brave%20%7C%20Edge-orange?style=for-the-badge" alt="Browsers">
  <img src="https://img.shields.io/badge/Privacy-100%25%20Local-success?style=for-the-badge" alt="100% Local">
  <img src="https://img.shields.io/badge/Version-1.3-informational?style=for-the-badge" alt="Version 1.3">
  <img src="https://img.shields.io/badge/License-MIT-purple?style=for-the-badge" alt="License">
</p>

A powerful, privacy-first Chrome Extension (Manifest V3) designed to eliminate digital distractions, protect your attention, and build unbreakable self-discipline. 

Unlike standard blockers that are easy to disable on a whim or bypass with simple typos, **SafeSearch** incorporates **phonetic fuzzy matching**, **irreversible search keyword blocking**, **granularity down to exact URL paths**, and **time-locked defense mechanisms**.

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
- Schedule website blocks with a specific unlock time (e.g., `Block until: 22:00` / 10:00 PM).
- **Quick Presets:** `+30m`, `+1h`, `+2h`, `10 PM`, or `No Timer` (Always Blocked).
- **Tamper-Resistant:** The delete/unblock button is strictly **disabled and locked** with a live countdown timer until the designated time has passed.

### 5. ⚡ Native Manifest V3 Performance & Zero Bypass
- Powered by Chrome's high-speed **`declarativeNetRequest`** API for seamless, zero-flicker network-level redirects.
- Dedicated SPA (Single-Page Application) observer handles YouTube dynamic in-page navigation (`yt-navigate-finish`, `popstate`, URL changes).

### 6. 🛡️ 100% Private & Offline
- **Zero data collection.**
- **Zero analytics or external requests.**
- Everything is stored strictly inside your browser's local sandbox via `chrome.storage.local`.

---

## 📸 How It Works

```
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

## 🚀 Installation Guide

SafeSearch is built with Manifest V3 and can be installed in any Chromium-based browser (**Google Chrome**, **Brave**, **Microsoft Edge**, **Opera**, **Vivaldi**).

### Step 1: Download or Clone the Repository
```bash
git clone https://github.com/YOUR_USERNAME/safesearch.git
```
*(Or download the repository as a `.zip` file from GitHub and extract it).*

### Step 2: Open Extensions in Your Browser
- In **Chrome**: Navigate to `chrome://extensions`
- In **Brave**: Navigate to `brave://extensions`
- In **Edge**: Navigate to `edge://extensions`

### Step 3: Enable Developer Mode
- Toggle the **Developer mode** switch in the top-right corner.

### Step 4: Load Unpacked
- Click the **Load unpacked** button in the top-left corner.
- Select the `safesearch` folder (the directory containing `manifest.json`).
- Pin **SafeSearch 🛡️** to your browser toolbar for quick access!

---

## 🎯 Usage & Examples

### Blocking Unwanted Searches
1. Click the **SafeSearch** extension icon.
2. In the **"🚫 Block a Search"** input, type a search phrase (e.g., `celebrity gossip`, `online gambling`, `clickbait news`).
3. Click **Add** or press **Enter**.
4. The term is now saved and permanently hidden. Any matching search on Google, YouTube, Bing, Yahoo, or DuckDuckGo will immediately be blocked.

### Blocking Websites & Feeds
1. Enter a domain or specific path in the **"🌐 Block a Website"** input:
   - Example domain: `distractingwebsite.com`
   - Example specific URL: `youtube.com/shorts` or `reddit.com/r/all`
2. Select your block duration using the time picker or quick chips (`+30m`, `+1h`, `+2h`, `10 PM`).
3. Click **Add**.
4. The site is instantly blocked across all existing and future tabs until the lock timer completes.

---

## 📂 Project Structure

```
safesearch/
├── manifest.json       # Chrome Extension Manifest V3 configuration
├── background.js       # Background service worker & declarativeNetRequest rule manager
├── content.js          # Search engine query inspector & phonetic/fuzzy matching engine
├── popup.html          # Extension popup UI layout
├── popup.js            # Timer locks, live countdown ticker, and local storage controller
├── style.css           # Modern clean styling for popup & blocked screens
├── blocked.html        # Dedicated full-page blocking redirect screen
└── README.md           # Project documentation
```

---

## ⚙️ Permissions Used

| Permission | Purpose |
| :--- | :--- |
| `storage` | Safely persists blocked websites and keywords locally in `chrome.storage.local`. |
| `declarativeNetRequest` | High-performance, network-level URL redirection without intercepting private data. |
| `tabs` | Instantly redirects open tabs that match newly added block rules. |
| `<all_urls>` | Enables URL filtering rules across target websites and search engines. |

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!
Feel free to open an issue or submit a pull request:

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the [MIT License](LICENSE) — feel free to use and customize it to boost your productivity.
