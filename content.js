(function () {

    let blockedKeywords = [];

    // ============================
    // PHONETIC & FUZZY CANONICALIZATION
    // ============================

    // Normalizes text by removing symbols, standardizing common Hinglish phonetic variations (j/z, oo/u, ee/i, w/v, silent h, etc.)
    function canonicalizeText(str) {
        if (!str) return "";
        let s = str.toLowerCase();

        // 1. Replace non-alphanumeric characters with spaces
        s = s.replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();

        // 2. Sound-alike substitutions (common in Hinglish & Indian names):
        // z -> j (e.g. zoke -> joke)
        s = s.replace(/z+/g, "j");

        // w -> v (e.g. shweta -> shveta, wikas -> vikas)
        s = s.replace(/w+/g, "v");

        // oo, ou -> u (e.g. kapoor -> kapur, kumar -> koomar)
        s = s.replace(/oo+/g, "u").replace(/ou+/g, "u");

        // ee, ea -> i (e.g. preeti -> priti, deepak -> dipak)
        s = s.replace(/ee+/g, "i").replace(/ea+/g, "i");

        // Silent / aspirated consonants (e.g. bharat -> barat, dhoni -> doni)
        s = s.replace(/jh/g, "j");
        s = s.replace(/nh/g, "n");
        s = s.replace(/bh/g, "b");
        s = s.replace(/dh/g, "d");
        s = s.replace(/th/g, "t");
        s = s.replace(/kh/g, "k");
        s = s.replace(/gh/g, "g");
        s = s.replace(/ph/g, "f");
        s = s.replace(/sh/g, "s");
        s = s.replace(/ck/g, "k");
        s = s.replace(/q/g, "k");

        // 3. Collapse duplicate letters (e.g. goooogle -> google, loool -> lol)
        s = s.replace(/([a-z])\1+/g, "$1");

        return s.trim();
    }

    // Fast Levenshtein distance algorithm for minor typo detection
    function levenshteinDistance(a, b) {
        if (a === b) return 0;
        if (!a.length) return b.length;
        if (!b.length) return a.length;

        const matrix = [];
        for (let i = 0; i <= b.length; i++) matrix[i] = [i];
        for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                if (b.charAt(i - 1) === a.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1, // substitution
                        matrix[i][j - 1] + 1,     // insertion
                        matrix[i - 1][j] + 1      // deletion
                    );
                }
            }
        }
        return matrix[b.length][a.length];
    }

    // Smart Matcher: checks exact, case-insensitive, phonetic sound-alikes, space variations, and word-level fuzzy match
    function isKeywordMatched(searchQuery, blockedKeyword) {
        if (!searchQuery || !blockedKeyword) return false;

        const rawSearch = searchQuery.toLowerCase().trim();
        const rawKw = blockedKeyword.toLowerCase().trim();

        // 1. Direct Case-Insensitive Substring Match
        if (rawSearch.includes(rawKw)) return true;

        // 2. Canonical Phonetic Match (handles: j/z, oo/u, ee/i, v/w, silent h, repeated letters)
        const canonSearch = canonicalizeText(searchQuery);
        const canonKw = canonicalizeText(blockedKeyword);
        if (!canonKw) return false;

        if (canonSearch.includes(canonKw)) return true;

        // 3. Space-less Match (handles: "onlinecasino" vs "online casino")
        const noSpaceSearch = canonSearch.replace(/\s+/g, "");
        const noSpaceKw = canonKw.replace(/\s+/g, "");
        if (noSpaceSearch.includes(noSpaceKw)) return true;

        // 4. Word-by-word Match (handles word reordering e.g. "casino online", and minor typos)
        const kwWords = canonKw.split(" ").filter(w => w.length > 1);
        const searchWords = canonSearch.split(" ").filter(w => w.length > 1);

        if (kwWords.length > 1) {
            const allPresent = kwWords.every(kwWord => {
                return searchWords.some(sWord => {
                    if (sWord === kwWord || sWord.includes(kwWord) || kwWord.includes(sWord)) return true;
                    // Allow 1 typo for words of 4 or more characters
                    if (kwWord.length >= 4 && sWord.length >= 4) {
                        return levenshteinDistance(kwWord, sWord) <= 1;
                    }
                    return false;
                });
            });
            if (allPresent) return true;
        } else if (kwWords.length === 1) {
            const singleKw = kwWords[0];
            const match = searchWords.some(sWord => {
                if (sWord === singleKw) return true;
                if (singleKw.length >= 5 && sWord.length >= 5) {
                    return levenshteinDistance(singleKw, sWord) <= 1;
                }
                return false;
            });
            if (match) return true;
        }

        return false;
    }

    // ============================
    // SEARCH QUERY EXTRACTION
    // ============================

    function getSearchQuery() {
        try {
            const url = new URL(window.location.href);
            const host = window.location.hostname.toLowerCase();

            // Google (google.com, google.co.in, etc.)
            if (host.includes("google.")) {
                return url.searchParams.get("q");
            }

            // Bing
            if (host.includes("bing.com")) {
                return url.searchParams.get("q");
            }

            // YouTube
            if (host.includes("youtube.com")) {
                return url.searchParams.get("search_query");
            }

            // Yahoo
            if (host.includes("yahoo.com")) {
                return url.searchParams.get("p");
            }

            // DuckDuckGo
            if (host.includes("duckduckgo.com")) {
                return url.searchParams.get("q");
            }
        } catch (e) {
            return null;
        }

        return null;
    }

    // ============================
    // BLOCK SCREEN OVERLAY
    // ============================

    function blockPage() {
        // Prevent duplicate overlay
        if (document.getElementById("safesearch-blocked")) {
            return;
        }

        // Stop any media playing on page
        try {
            window.stop();
        } catch (e) {}

        const blockedScreen = document.createElement("div");
        blockedScreen.id = "safesearch-blocked";

        blockedScreen.innerHTML = `
            <div class="safesearch-box">
                <div class="shield">🛡️</div>
                <h1>Search Blocked!</h1>
                <p>This search has been blocked by SafeSearch.</p>
                <p class="motivation">Stay focused on your goals! 🚀</p>
                <button id="safesearch-back">Go Back</button>
            </div>
        `;

        const style = document.createElement("style");
        style.textContent = `
            #safesearch-blocked {
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                width: 100vw !important;
                height: 100vh !important;
                display: flex !important;
                justify-content: center !important;
                align-items: center !important;
                background: #0f172a !important;
                color: white !important;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
                text-align: center !important;
                z-index: 2147483647 !important;
            }

            .safesearch-box {
                padding: 40px !important;
                max-width: 500px !important;
            }

            .shield {
                font-size: 80px !important;
                margin-bottom: 15px !important;
            }

            #safesearch-blocked h1 {
                font-size: 32px !important;
                font-weight: 800 !important;
                margin: 10px 0 !important;
                color: #ffffff !important;
            }

            #safesearch-blocked p {
                font-size: 17px !important;
                color: #94a3b8 !important;
                margin-bottom: 8px !important;
            }

            #safesearch-blocked .motivation {
                color: #64748b !important;
                font-size: 15px !important;
                margin-bottom: 25px !important;
            }

            #safesearch-back {
                padding: 12px 30px !important;
                border: none !important;
                border-radius: 8px !important;
                font-size: 16px !important;
                font-weight: 700 !important;
                background: #2563eb !important;
                color: white !important;
                cursor: pointer !important;
                transition: background 0.2s ease !important;
            }

            #safesearch-back:hover {
                background: #1d4ed8 !important;
            }
        `;

        function mount() {
            (document.head || document.documentElement).appendChild(style);
            (document.body || document.documentElement).appendChild(blockedScreen);

            const backBtn = document.getElementById("safesearch-back");
            if (backBtn) {
                backBtn.addEventListener("click", () => {
                    history.back();
                });
            }
        }

        if (document.body) {
            mount();
        } else {
            document.addEventListener("DOMContentLoaded", mount);
        }
    }

    // ============================
    // CHECK SEARCH QUERY
    // ============================

    function checkSearch() {
        const searchQuery = getSearchQuery();
        if (!searchQuery) return;

        const isBlocked = blockedKeywords.some((keyword) => {
            return isKeywordMatched(searchQuery, keyword);
        });

        if (isBlocked) {
            blockPage();
        }
    }

    // ============================
    // STORAGE & LIFECYCLE
    // ============================

    function loadBlockedKeywords() {
        chrome.storage.local.get(["blockedKeywords"], (result) => {
            const raw = result.blockedKeywords || [];
            blockedKeywords = raw.map(k => typeof k === "string" ? k : (k.keyword || ""));
            checkSearch();
        });
    }

    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === "local" && changes.blockedKeywords) {
            const raw = changes.blockedKeywords.newValue || [];
            blockedKeywords = raw.map(k => typeof k === "string" ? k : (k.keyword || ""));
            checkSearch();
        }
    });

    // Handle Client-side Routing / SPA (e.g. YouTube search without page reload)
    window.addEventListener("popstate", checkSearch);
    document.addEventListener("yt-navigate-finish", checkSearch);

    let lastUrl = window.location.href;
    setInterval(() => {
        if (window.location.href !== lastUrl) {
            lastUrl = window.location.href;
            checkSearch();
        }
    }, 400);

    // Initial check
    loadBlockedKeywords();

})();