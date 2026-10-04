// SafeSearch - Cross-Browser Popup Controller
// Compatible with Chrome, Edge, Firefox Desktop & Firefox Android

// Cross-browser compatibility API adapter (Chrome MV3, Firefox MV3, plus graceful preview fallback)
const browserAPI = (typeof browser !== "undefined" && browser.storage)
    ? browser
    : (typeof chrome !== "undefined" && chrome.storage)
        ? chrome
        : {
            storage: {
                local: {
                    get: function (keys, callback) {
                        const res = {};
                        const keyList = Array.isArray(keys) ? keys : [keys];
                        keyList.forEach(k => {
                            try {
                                const val = localStorage.getItem("safesearch_" + k);
                                if (val !== null) res[k] = JSON.parse(val);
                            } catch (e) {}
                        });
                        if (callback) callback(res);
                    },
                    set: function (items, callback) {
                        try {
                            Object.keys(items).forEach(k => {
                                localStorage.setItem("safesearch_" + k, JSON.stringify(items[k]));
                            });
                        } catch (e) {}
                        if (callback) callback();
                    }
                }
            },
            runtime: {}
        };

// Guard against repeated popup initialization
let popupInitialized = false;

// Active countdown timer reference (guarantees strictly ONE interval exists)
let activeCountdownInterval = null;

function initPopup() {
    if (popupInitialized) return;
    popupInitialized = true;

    const keywordInput = document.getElementById("keywordInput");
    const addKeywordBtn = document.getElementById("addKeyword");
    const keywordStatus = document.getElementById("keywordStatus");

    const websiteInput = document.getElementById("websiteInput");
    const addWebsiteBtn = document.getElementById("addWebsite");
    const websiteList = document.getElementById("websiteList");
    const websiteBlockTime = document.getElementById("websiteBlockTime");
    const tabModeTime = document.getElementById("tabModeTime");
    const tabModeDays = document.getElementById("tabModeDays");
    const timeModeControls = document.getElementById("timeModeControls");
    const daysModeControls = document.getElementById("daysModeControls");
    const websiteBlockDays = document.getElementById("websiteBlockDays");
    const daysPreviewText = document.getElementById("daysPreviewText");

    // Scope & Current tab detector refs
    const currentTabContainer = document.getElementById("currentTabContainer");
    const currentTabDomain = document.getElementById("currentTabDomain");
    const btnBlockCurrentSite = document.getElementById("btnBlockCurrentSite");
    const scopeDomain = document.getElementById("scopeDomain");
    const scopeExact = document.getElementById("scopeExact");
    const scopePreviewIcon = document.getElementById("scopePreviewIcon");
    const scopePreviewText = document.getElementById("scopePreviewText");
    const scopePreviewNote = document.getElementById("scopePreviewNote");

    let currentScope = "domain"; // "domain" | "exact"

    // Days-of-week selector refs
    const allDaysCheck = document.getElementById("allDaysCheck");
    const dowPills = document.getElementById("dowPills");
    const dowPreviewIcon = document.getElementById("dowPreviewIcon");
    const dowPreviewText = document.getElementById("dowPreviewText");

    let currentBlockMode = "time"; // "time" | "days"

    // ============================
    // HELPER FUNCTIONS
    // ============================

    // Returns array of selected day numbers (0=Sun … 6=Sat), or null if allDays
    function getSelectedDays() {
        if (allDaysCheck && allDaysCheck.checked) return null; // null = all days
        const selected = [];
        document.querySelectorAll(".dow-pill.active").forEach(function (pill) {
            const d = parseInt(pill.getAttribute("data-day"), 10);
            if (!isNaN(d)) selected.push(d);
        });
        return selected.length > 0 ? selected : null;
    }

    // Format selected days into readable text
    function formatDayList(days) {
        if (!days || days.length === 7) return "every day";
        const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        return days.map(function (d) { return names[d]; }).join(", ");
    }

    // Update the dow preview note below the day pills
    function updateDowPreview() {
        if (!dowPreviewText) return;
        const timeVal = websiteBlockTime ? websiteBlockTime.value : "";
        let timeDisplay = "the set time";
        if (timeVal) {
            const parts = timeVal.split(":");
            if (parts.length === 2) {
                const h = parseInt(parts[0], 10);
                const m = parts[1];
                const ampm = h >= 12 ? "PM" : "AM";
                const h12 = h % 12 === 0 ? 12 : (h > 12 ? h - 12 : h);
                timeDisplay = `${h12}:${m} ${ampm}`;
            }
        }

        if (!timeVal) {
            if (dowPreviewIcon) dowPreviewIcon.textContent = "🔒";
            dowPreviewText.textContent = "No time set — website will be always blocked";
            return;
        }

        const isAll = Boolean(allDaysCheck && allDaysCheck.checked);
        const selected = getSelectedDays();

        if (isAll) {
            if (dowPreviewIcon) dowPreviewIcon.textContent = "🔁";
            dowPreviewText.textContent = `All Days: Locked every day until ${timeDisplay}`;
        } else if (selected && selected.length === 1) {
            const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
            if (dowPreviewIcon) dowPreviewIcon.textContent = "📅";
            dowPreviewText.textContent = `Only this ${names[selected[0]]}: Locked until ${timeDisplay}`;
        } else if (selected && selected.length > 1 && selected.length < 7) {
            if (dowPreviewIcon) dowPreviewIcon.textContent = "📅";
            dowPreviewText.textContent = `Selected Days (${formatDayList(selected)}): Locked until ${timeDisplay}`;
        } else {
            // When All Days is ticked off: only one day timer runs
            if (dowPreviewIcon) dowPreviewIcon.textContent = "⏱️";
            dowPreviewText.textContent = `1 Day Only: Timer will run only once until ${timeDisplay}`;
        }
    }

    // Calculate timestamp from HH:MM string for websites
    function calculateBlockUntilTimestamp(timeString) {
        if (!timeString) return null;

        const parts = timeString.split(":");
        if (parts.length !== 2) return null;

        const hours = parseInt(parts[0], 10);
        const minutes = parseInt(parts[1], 10);
        if (isNaN(hours) || isNaN(minutes)) return null;

        const now = new Date();
        const target = new Date();
        target.setHours(hours, minutes, 0, 0);

        // If target time has already passed today, schedule for tomorrow
        if (target.getTime() <= now.getTime()) {
            target.setDate(target.getDate() + 1);
        }

        return target.getTime();
    }

    // Calculate timestamp from number of days
    function calculateDaysBlockUntilTimestamp(daysValue) {
        let days = parseInt(daysValue, 10);
        if (isNaN(days) || days < 1) days = 1;
        return Date.now() + (days * 24 * 60 * 60 * 1000);
    }

    // Format remaining milliseconds into human readable string (supports days, hours, mins, secs)
    function formatTimeRemaining(ms) {
        if (ms <= 0) return "0s";

        const totalSeconds = Math.floor(ms / 1000);
        const days = Math.floor(totalSeconds / 86400);
        const hours = Math.floor((totalSeconds % 86400) / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        if (days > 0) {
            return `${days}d ${hours}h ${minutes}m ${seconds}s`;
        }
        if (hours > 0) {
            return `${hours}h ${minutes}m ${seconds}s`;
        }
        if (minutes > 0) {
            return `${minutes}m ${seconds}s`;
        }
        return `${seconds}s`;
    }

    // Format target timestamp into local date/time string
    function formatTargetTime(timestamp) {
        if (!timestamp) return "";
        const targetDate = new Date(timestamp);
        const now = new Date();

        const timeStr = targetDate.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true });

        const isToday = targetDate.getFullYear() === now.getFullYear() &&
                        targetDate.getMonth() === now.getMonth() &&
                        targetDate.getDate() === now.getDate();
        if (isToday) {
            return timeStr;
        }

        const tomorrow = new Date(now);
        tomorrow.setDate(now.getDate() + 1);
        const isTomorrow = targetDate.getFullYear() === tomorrow.getFullYear() &&
                           targetDate.getMonth() === tomorrow.getMonth() &&
                           targetDate.getDate() === tomorrow.getDate();
        if (isTomorrow) {
            return `Tomorrow ${timeStr}`;
        }

        const dateStr = targetDate.toLocaleDateString([], { month: "short", day: "numeric" });
        return `${dateStr}, ${timeStr}`;
    }

    // Format Date to HH:MM for <input type="time">
    function formatTimeToInput(date) {
        const hours = String(date.getHours()).padStart(2, "0");
        const minutes = String(date.getMinutes()).padStart(2, "0");
        return `${hours}:${minutes}`;
    }

    function showKeywordFeedback(msg, isSuccess = true) {
        if (!keywordStatus) return;
        keywordStatus.textContent = "";
        const iconSpan = document.createElement("span");
        iconSpan.className = "note-icon";
        iconSpan.textContent = isSuccess ? "✅" : "ℹ️";
        const textSpan = document.createElement("span");
        textSpan.className = "note-text";
        textSpan.textContent = msg;
        keywordStatus.appendChild(iconSpan);
        keywordStatus.appendChild(document.createTextNode(" "));
        keywordStatus.appendChild(textSpan);
        keywordStatus.classList.add("feedback-active");
        setTimeout(function () {
            if (keywordStatus) {
                keywordStatus.textContent = "";
                const defaultIcon = document.createElement("span");
                defaultIcon.className = "note-icon";
                defaultIcon.textContent = "🔒";
                const defaultText = document.createElement("span");
                defaultText.className = "note-text";
                defaultText.textContent = "Searches are permanently blocked and hidden.";
                keywordStatus.appendChild(defaultIcon);
                keywordStatus.appendChild(document.createTextNode(" "));
                keywordStatus.appendChild(defaultText);
                keywordStatus.classList.remove("feedback-active");
            }
        }, 2500);
    }

    function extractDomain(input) {
        if (!input) return "";
        let str = input.trim().toLowerCase();
        str = str.replace(/^https?:\/\//i, "");
        str = str.replace(/^www\./i, "");
        const slashIdx = str.indexOf("/");
        const qIdx = str.indexOf("?");
        const hIdx = str.indexOf("#");
        let endIdx = str.length;
        if (slashIdx !== -1) endIdx = Math.min(endIdx, slashIdx);
        if (qIdx !== -1) endIdx = Math.min(endIdx, qIdx);
        if (hIdx !== -1) endIdx = Math.min(endIdx, hIdx);
        return str.substring(0, endIdx).trim();
    }

    function cleanTargetUrl(input) {
        if (!input) return "";
        let str = input.trim().toLowerCase();
        str = str.replace(/^https?:\/\//i, "");
        str = str.replace(/^www\./i, "");
        str = str.split("?")[0].split("#")[0];
        str = str.replace(/\/+$/, "");
        return str;
    }

    function setScope(scope) {
        currentScope = scope;
        if (scope === "domain") {
            if (scopeDomain) scopeDomain.classList.add("active");
            if (scopeExact) scopeExact.classList.remove("active");
        } else {
            if (scopeExact) scopeExact.classList.add("active");
            if (scopeDomain) scopeDomain.classList.remove("active");
        }
        updateScopePreview();
    }

    function updateScopePreview() {
        if (!scopePreviewText || !scopePreviewIcon) return;
        const raw = websiteInput ? websiteInput.value.trim() : "";
        if (!raw) {
            if (currentScope === "domain") {
                scopePreviewIcon.textContent = "🛡️";
                scopePreviewText.textContent = "Blocks all pages, feeds & subdomains across the website.";
            } else {
                scopePreviewIcon.textContent = "📄";
                scopePreviewText.textContent = "Blocks only the exact URL path you specify.";
            }
            if (scopePreviewNote) scopePreviewNote.classList.remove("preview-error");
            return;
        }

        const domain = extractDomain(raw);
        const hasDot = domain && domain.includes(".") && domain.length >= 3;

        if (!hasDot) {
            scopePreviewIcon.textContent = "⚠️";
            scopePreviewText.textContent = "Please enter a valid website domain (e.g. linkedin.com)";
            if (scopePreviewNote) scopePreviewNote.classList.add("preview-error");
            return;
        }

        if (scopePreviewNote) scopePreviewNote.classList.remove("preview-error");

        if (currentScope === "domain") {
            scopePreviewIcon.textContent = "🛡️";
            scopePreviewText.textContent = `Will block entire site: ${domain} (all pages & subdomains)`;
        } else {
            const clean = cleanTargetUrl(raw);
            scopePreviewIcon.textContent = "📄";
            scopePreviewText.textContent = `Will block only exact path: ${clean}`;
        }
    }

    // ============================
    // TIMER TICKER MANAGEMENT
    // Strictly manages ONE single setInterval instance
    // Never calls storage.set from the ticker loop
    // Updates ONLY countdown text and in-place badge status
    // ============================

    function startCountdownTicker() {
        if (activeCountdownInterval !== null) {
            clearInterval(activeCountdownInterval);
            activeCountdownInterval = null;
        }
        activeCountdownInterval = setInterval(updateActiveTimers, 1000);
    }

    function updateActiveTimers() {
        const now = Date.now();
        const lockedItems = document.querySelectorAll("li[data-block-until]");

        lockedItems.forEach(function (li) {
            const blockUntil = parseInt(li.getAttribute("data-block-until"), 10);
            if (isNaN(blockUntil)) return;

            const remainingMs = blockUntil - now;
            if (remainingMs <= 0) {
                // Time has passed: unlock this item in-place without rebuilding the DOM or page
                li.removeAttribute("data-block-until");
                li.className = "rule-item is-unlocked";

                // Update badge in-place using safe DOM methods
                const statusDiv = li.querySelector(".item-status");
                if (statusDiv) {
                    statusDiv.textContent = "";
                    const badge = document.createElement("span");
                    badge.className = "badge badge-unlocked";
                    const dot = document.createElement("span");
                    dot.className = "badge-dot";
                    const text = document.createElement("span");
                    text.className = "badge-text";
                    const isAllDays = li.getAttribute("data-all-days") === "true";
                    text.textContent = isAllDays ? "Time Complete for Today (All Days Active)" : "Time Complete (Ready to Delete)";
                    badge.appendChild(dot);
                    badge.appendChild(text);
                    statusDiv.appendChild(badge);
                }

                // Update delete button in-place
                const deleteBtn = li.querySelector(".delete-btn");
                if (deleteBtn) {
                    deleteBtn.className = "delete-btn btn-unlocked";
                    deleteBtn.disabled = false;
                    deleteBtn.textContent = "";
                    const span = document.createElement("span");
                    span.textContent = "🗑️ Delete";
                    deleteBtn.appendChild(span);
                    deleteBtn.title = "Delete and unblock";
                }
            } else {
                // Update ONLY the countdown text element in-place
                const countdownSpan = li.querySelector(".time-countdown");
                if (countdownSpan) {
                    countdownSpan.textContent = formatTimeRemaining(remainingMs);
                }
            }
        });
    }

    // ============================
    // MODE SWITCHER (HOURS vs DAYS)
    // ============================

    function updateDaysPreview() {
        if (!daysPreviewText || !websiteBlockDays) return;
        let days = parseInt(websiteBlockDays.value, 10);
        if (isNaN(days) || days < 1) days = 1;
        const targetMs = Date.now() + (days * 24 * 60 * 60 * 1000);
        const dayLabel = days === 1 ? "1 Day" : `${days} Days`;
        daysPreviewText.textContent = `Locked until ${formatTargetTime(targetMs)} (${dayLabel})`;
    }

    if (tabModeTime && tabModeDays) {
        tabModeTime.addEventListener("click", function () {
            currentBlockMode = "time";
            tabModeTime.classList.add("active");
            tabModeDays.classList.remove("active");
            if (timeModeControls) timeModeControls.style.display = "flex";
            if (daysModeControls) daysModeControls.style.display = "none";
        });

        tabModeDays.addEventListener("click", function () {
            currentBlockMode = "days";
            tabModeDays.classList.add("active");
            tabModeTime.classList.remove("active");
            if (timeModeControls) timeModeControls.style.display = "none";
            if (daysModeControls) daysModeControls.style.display = "flex";
            updateDaysPreview();
        });
    }

    // ============================
    // DAYS-OF-WEEK SELECTOR LOGIC
    // ============================

    // "All Days" master checkbox: toggle all pills on/off
    if (allDaysCheck) {
        allDaysCheck.addEventListener("change", function () {
            const pills = document.querySelectorAll(".dow-pill");
            if (allDaysCheck.checked) {
                pills.forEach(function (p) { p.classList.add("active"); });
            } else {
                pills.forEach(function (p) { p.classList.remove("active"); });
            }
            updateDowPreview();
        });
    }

    // Individual day pill toggles
    if (dowPills) {
        dowPills.addEventListener("click", function (e) {
            const pill = e.target.closest(".dow-pill");
            if (!pill) return;
            pill.classList.toggle("active");

            // Sync the allDaysCheck state
            const allActive = document.querySelectorAll(".dow-pill.active").length === 7;
            if (allDaysCheck) allDaysCheck.checked = allActive;
            updateDowPreview();
        });
    }

    // Update preview whenever time input changes
    if (websiteBlockTime) {
        websiteBlockTime.addEventListener("change", updateDowPreview);
        websiteBlockTime.addEventListener("input", updateDowPreview);
    }

    // Initialize preview
    updateDowPreview();

    // Days preset chips handler
    document.querySelectorAll(".day-chip").forEach(function (chip) {
        chip.addEventListener("click", function () {
            const days = parseInt(chip.getAttribute("data-days"), 10);
            if (isNaN(days)) return;

            document.querySelectorAll(".day-chip").forEach(c => c.classList.remove("active"));
            chip.classList.add("active");

            if (websiteBlockDays) {
                websiteBlockDays.value = days;
                updateDaysPreview();
            }
        });
    });

    // Custom days number input handler
    if (websiteBlockDays) {
        websiteBlockDays.addEventListener("input", function () {
            const val = parseInt(websiteBlockDays.value, 10);
            document.querySelectorAll(".day-chip").forEach(c => {
                if (parseInt(c.getAttribute("data-days"), 10) === val) {
                    c.classList.add("active");
                } else {
                    c.classList.remove("active");
                }
            });
            updateDaysPreview();
        });
    }

    // Initialize days preview
    updateDaysPreview();

    // ============================
    // PRESET CHIPS HANDLER (TIME OF DAY)
    // ============================

    document.querySelectorAll("#timeModeControls .preset-chip").forEach(function (chip) {
        chip.addEventListener("click", function () {
            const targetId = chip.getAttribute("data-target");
            const preset = chip.getAttribute("data-preset");
            const targetInput = document.getElementById(targetId);
            if (!targetInput) return;

            const parentContainer = chip.parentElement;
            parentContainer.querySelectorAll(".preset-chip").forEach(c => c.classList.remove("active"));
            chip.classList.add("active");

            if (preset === "30m") {
                const d = new Date(Date.now() + 30 * 60 * 1000);
                targetInput.value = formatTimeToInput(d);
            } else if (preset === "1h") {
                const d = new Date(Date.now() + 60 * 60 * 1000);
                targetInput.value = formatTimeToInput(d);
            } else if (preset === "2h") {
                const d = new Date(Date.now() + 120 * 60 * 1000);
                targetInput.value = formatTimeToInput(d);
            } else if (preset === "22:00") {
                targetInput.value = "22:00";
            } else if (preset === "") {
                targetInput.value = "";
            }
            updateDowPreview();
        });
    });

    // ============================
    // ENTER KEY SUPPORT
    // ============================

    if (keywordInput) {
        keywordInput.addEventListener("keydown", function (e) {
            if (e.key === "Enter") {
                addKeywordBtn.click();
            }
        });
    }

    if (websiteInput) {
        websiteInput.addEventListener("keydown", function (e) {
            if (e.key === "Enter") {
                addWebsiteBtn.click();
            }
        });
        websiteInput.addEventListener("input", updateScopePreview);
    }

    // Block scope selector buttons
    if (scopeDomain) {
        scopeDomain.addEventListener("click", () => setScope("domain"));
    }
    if (scopeExact) {
        scopeExact.addEventListener("click", () => setScope("exact"));
    }

    // Active tab detector
    if (browserAPI.tabs && browserAPI.tabs.query) {
        try {
            const handleTabs = (tabs) => {
                if (tabs && tabs[0] && tabs[0].url) {
                    const url = tabs[0].url;
                    if (!url.startsWith("chrome://") && 
                        !url.startsWith("edge://") && 
                        !url.startsWith("about:") && 
                        !url.startsWith("moz-extension://") && 
                        !url.startsWith("chrome-extension://")) {
                        const domain = extractDomain(url);
                        if (domain && domain.includes(".") && domain.length >= 3) {
                            if (currentTabContainer) currentTabContainer.style.display = "flex";
                            if (currentTabDomain) currentTabDomain.textContent = domain;
                        }
                    }
                }
            };

            const queryPromise = browserAPI.tabs.query({ active: true, currentWindow: true });
            if (queryPromise && typeof queryPromise.then === "function") {
                queryPromise.then(handleTabs).catch(() => {});
            } else {
                browserAPI.tabs.query({ active: true, currentWindow: true }, handleTabs);
            }
        } catch (e) {}
    }

    if (btnBlockCurrentSite) {
        btnBlockCurrentSite.addEventListener("click", function () {
            if (currentTabDomain && currentTabDomain.textContent) {
                if (websiteInput) {
                    websiteInput.value = currentTabDomain.textContent;
                    setScope("domain");
                    websiteInput.focus();
                }
            }
        });
    }

    updateScopePreview();

    // ============================
    // EVENT DELEGATION FOR WEBSITE DELETES
    // Handles deletes for initially unlocked and newly unlocked items cleanly
    // ============================

    if (websiteList) {
        websiteList.addEventListener("click", function (e) {
            const deleteBtn = e.target.closest(".delete-btn.btn-unlocked");
            if (!deleteBtn || deleteBtn.disabled) return;

            const li = deleteBtn.closest("li");
            if (!li) return;
            const index = parseInt(li.getAttribute("data-index"), 10);
            if (isNaN(index)) return;

            browserAPI.storage.local.get(["blockedWebsites"], function (result) {
                if (browserAPI.runtime && browserAPI.runtime.lastError) {
                    console.error("Storage error:", browserAPI.runtime.lastError);
                    return;
                }
                const raw = (result && result.blockedWebsites) || [];
                if (index >= 0 && index < raw.length) {
                    raw.splice(index, 1);
                    browserAPI.storage.local.set({ blockedWebsites: raw }, function () {
                        loadWebsites();
                    });
                }
            });
        });
    }

    // ============================
    // ADD SEARCH KEYWORD (PERMANENT & HIDDEN)
    // ============================

    if (addKeywordBtn) {
        addKeywordBtn.addEventListener("click", function () {
            const keyword = keywordInput.value.trim().toLowerCase();
            if (keyword === "") return;

            browserAPI.storage.local.get(["blockedKeywords"], function (result) {
                if (browserAPI.runtime && browserAPI.runtime.lastError) {
                    console.error("Storage error:", browserAPI.runtime.lastError);
                    return;
                }
                const raw = (result && result.blockedKeywords) || [];

                // Check if already exists
                const exists = raw.some(function (item) {
                    const k = typeof item === "string" ? item : (item.keyword || "");
                    return k.toLowerCase() === keyword;
                });

                if (!exists) {
                    const newItem = {
                        keyword: keyword,
                        createdAt: Date.now()
                    };

                    raw.push(newItem);

                    browserAPI.storage.local.set({ blockedKeywords: raw }, function () {
                        keywordInput.value = "";
                        showKeywordFeedback("Search term blocked & hidden permanently!", true);
                    });
                } else {
                    keywordInput.value = "";
                    showKeywordFeedback("Search term is already in block list!", false);
                }
            });
        });
    }

    // ============================
    // ADD WEBSITE (WITH TIMER & LOCK)
    // ============================

    if (addWebsiteBtn) {
        addWebsiteBtn.addEventListener("click", function () {
            const rawVal = websiteInput ? websiteInput.value.trim() : "";
            if (!rawVal) return;

            const domain = extractDomain(rawVal);
            if (!domain || !domain.includes(".") || domain.length < 3) {
                if (scopePreviewNote) scopePreviewNote.classList.add("preview-error");
                if (scopePreviewText) scopePreviewText.textContent = "Invalid website. Please enter e.g. linkedin.com";
                return;
            }

            const targetUrl = (currentScope === "domain") ? domain : cleanTargetUrl(rawVal);
            const targetScope = currentScope;

            let blockUntil = null;
            let scheduleDays = null;
            let isAllDays = false;
            let targetTime = null;

            if (currentBlockMode === "days") {
                blockUntil = calculateDaysBlockUntilTimestamp(websiteBlockDays ? websiteBlockDays.value : 1);
            } else {
                const timeVal = websiteBlockTime ? websiteBlockTime.value : "";
                if (timeVal) {
                    blockUntil = calculateBlockUntilTimestamp(timeVal);
                    targetTime = timeVal;
                    isAllDays = Boolean(allDaysCheck && allDaysCheck.checked);
                    scheduleDays = getSelectedDays();
                }
            }

            browserAPI.storage.local.get(["blockedWebsites"], function (result) {
                if (browserAPI.runtime && browserAPI.runtime.lastError) {
                    console.error("Storage error:", browserAPI.runtime.lastError);
                    return;
                }
                const raw = (result && result.blockedWebsites) || [];

                // Check if already exists
                const exists = raw.some(function (item) {
                    const w = typeof item === "string" ? item : (item.url || "");
                    const itemScope = typeof item === "object" ? item.scope : (w.includes("/") ? "exact" : "domain");
                    if (targetScope === "domain" && itemScope === "domain") {
                        return extractDomain(w) === domain;
                    }
                    return cleanTargetUrl(w) === targetUrl;
                });

                if (!exists) {
                    const newItem = {
                        url: targetUrl,
                        scope: targetScope,
                        blockUntil: blockUntil,
                        targetTime: targetTime,
                        allDays: isAllDays, // true = All Days daily recurring, false = 1 Day Only
                        scheduleDays: scheduleDays,
                        createdAt: Date.now()
                    };

                    raw.push(newItem);

                    browserAPI.storage.local.set({ blockedWebsites: raw }, function () {
                        if (websiteInput) websiteInput.value = "";
                        updateScopePreview();
                        loadWebsites();
                    });
                } else {
                    if (websiteInput) websiteInput.value = "";
                    updateScopePreview();
                }
            });
        });
    }

    // ============================
    // LOAD WEBSITES (Initial load & on deliberate add/delete only)
    // ============================

    function loadWebsites() {
        if (!websiteList) return;

        browserAPI.storage.local.get(["blockedWebsites"], function (result) {
            if (browserAPI.runtime && browserAPI.runtime.lastError) {
                console.error("Storage error:", browserAPI.runtime.lastError);
                return;
            }

            const raw = (result && result.blockedWebsites) || [];
            websiteList.textContent = "";

            if (raw.length === 0) {
                const emptyLi = document.createElement("li");
                emptyLi.className = "empty-state-card";

                const emptyIcon = document.createElement("div");
                emptyIcon.className = "empty-icon-ring";
                emptyIcon.textContent = "🛡️";

                const emptyInfo = document.createElement("div");
                emptyInfo.className = "empty-info";

                const heading = document.createElement("span");
                heading.className = "empty-heading";
                heading.textContent = "No sites blocked yet";

                const subtext = document.createElement("span");
                subtext.className = "empty-subtext";
                subtext.textContent = "Add a website or URL above to build your focus shield.";

                emptyInfo.appendChild(heading);
                emptyInfo.appendChild(subtext);
                emptyLi.appendChild(emptyIcon);
                emptyLi.appendChild(emptyInfo);

                websiteList.appendChild(emptyLi);
                return;
            }

            const now = Date.now();
            let needsSave = false;

            // Auto-advance All Days recurring rules if a new calendar day has arrived
            raw.forEach(function (item) {
                if (item && typeof item === "object" && item.allDays && item.targetTime && item.blockUntil) {
                    const blockDate = new Date(item.blockUntil);
                    const nowDate = new Date(now);
                    const isPast = now >= item.blockUntil;
                    const isNewDay = nowDate.toDateString() !== blockDate.toDateString();
                    if (isPast && isNewDay) {
                        const nextTarget = calculateBlockUntilTimestamp(item.targetTime);
                        if (nextTarget && nextTarget > item.blockUntil) {
                            item.blockUntil = nextTarget;
                            needsSave = true;
                        }
                    }
                }
            });

            if (needsSave) {
                browserAPI.storage.local.set({ blockedWebsites: raw });
            }

            raw.forEach(function (item, index) {
                const website = typeof item === "string" ? item : (item.url || "");
                const blockUntil = typeof item === "string" ? null : item.blockUntil;
                const isAllDays = typeof item === "object" && item ? Boolean(item.allDays) : false;
                const scheduleDays = typeof item === "object" && item ? item.scheduleDays : null;
                const targetTime = typeof item === "object" && item ? item.targetTime : null;
                const isLocked = Boolean(blockUntil && now < blockUntil);

                const li = document.createElement("li");
                li.className = isLocked ? "rule-item is-locked" : "rule-item is-unlocked";
                li.setAttribute("data-type", "website");
                li.setAttribute("data-index", index);
                li.setAttribute("data-all-days", isAllDays ? "true" : "false");
                if (isLocked) {
                    li.setAttribute("data-block-until", blockUntil);
                }

                // Info container
                const infoDiv = document.createElement("div");
                infoDiv.className = "item-info";

                // Title & Scope tag
                const rawUrl = typeof item === "string" ? item : (item.url || "");
                const domain = extractDomain(rawUrl);
                const hasValidDomain = Boolean(domain && domain.includes(".") && domain.length >= 3);
                const scope = (typeof item === "object" && item.scope) 
                    ? item.scope 
                    : (rawUrl.includes("/") ? "exact" : "domain");
                const isExact = (scope === "exact");

                const titleDiv = document.createElement("div");
                titleDiv.className = "item-title";

                const siteIcon = document.createElement("span");
                siteIcon.className = "site-icon";

                if (!hasValidDomain) {
                    siteIcon.textContent = "⚠️";
                    const siteName = document.createElement("span");
                    siteName.className = "site-name";
                    siteName.textContent = rawUrl.length > 28 ? rawUrl.substring(0, 28) + "…" : rawUrl;
                    titleDiv.appendChild(siteIcon);
                    titleDiv.appendChild(document.createTextNode(" "));
                    titleDiv.appendChild(siteName);

                    const invalidTag = document.createElement("span");
                    invalidTag.className = "scope-tag scope-tag-invalid";
                    invalidTag.textContent = "Invalid URL";
                    titleDiv.appendChild(invalidTag);
                } else {
                    siteIcon.textContent = isExact ? "📄" : "🌐";
                    const siteName = document.createElement("span");
                    siteName.className = "site-name";
                    siteName.textContent = rawUrl;
                    titleDiv.appendChild(siteIcon);
                    titleDiv.appendChild(document.createTextNode(" "));
                    titleDiv.appendChild(siteName);

                    const scopeTag = document.createElement("span");
                    scopeTag.className = isExact ? "scope-tag scope-tag-exact" : "scope-tag scope-tag-domain";
                    scopeTag.textContent = isExact ? "Specific Path" : "Entire Site";
                    titleDiv.appendChild(scopeTag);
                }

                // Status badge
                const statusDiv = document.createElement("div");
                statusDiv.className = "item-status";

                if (isLocked) {
                    const remainingMs = blockUntil - now;
                    const badge = document.createElement("span");
                    badge.className = "badge badge-locked";
                    const dot = document.createElement("span");
                    dot.className = "badge-dot";
                    const badgeText = document.createElement("span");
                    badgeText.className = "badge-text";

                    let scheduleLabel = "";
                    if (isAllDays) {
                        scheduleLabel = " · All Days";
                    } else if (scheduleDays && scheduleDays.length > 0 && scheduleDays.length < 7) {
                        const dayNames = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
                        scheduleLabel = " · " + scheduleDays.map(function(d){ return dayNames[d]; }).join(", ");
                    } else if (targetTime) {
                        scheduleLabel = " · 1 Day Only";
                    }

                    badgeText.appendChild(document.createTextNode(`Locked until ${formatTargetTime(blockUntil)}${scheduleLabel} (`));
                    const countdownSpan = document.createElement("span");
                    countdownSpan.className = "time-countdown";
                    countdownSpan.textContent = formatTimeRemaining(remainingMs);
                    badgeText.appendChild(countdownSpan);
                    badgeText.appendChild(document.createTextNode(")"));
                    badge.appendChild(dot);
                    badge.appendChild(badgeText);
                    statusDiv.appendChild(badge);
                } else if (blockUntil && now >= blockUntil) {
                    const badge = document.createElement("span");
                    badge.className = "badge badge-unlocked";
                    const dot = document.createElement("span");
                    dot.className = "badge-dot";
                    const badgeText = document.createElement("span");
                    badgeText.className = "badge-text";
                    badgeText.textContent = isAllDays ? "Time Complete for Today (All Days Active)" : "Time Complete (Ready to Delete)";
                    badge.appendChild(dot);
                    badge.appendChild(badgeText);
                    statusDiv.appendChild(badge);
                } else {
                    const badge = document.createElement("span");
                    badge.className = "badge badge-permanent";
                    const dot = document.createElement("span");
                    dot.className = "badge-dot";
                    const badgeText = document.createElement("span");
                    badgeText.className = "badge-text";
                    badgeText.textContent = "Always Blocked";
                    badge.appendChild(dot);
                    badge.appendChild(badgeText);
                    statusDiv.appendChild(badge);
                }

                infoDiv.appendChild(titleDiv);
                infoDiv.appendChild(statusDiv);

                // Quick Upgrade / Clean action buttons
                if (!hasValidDomain) {
                    const actionsRow = document.createElement("div");
                    actionsRow.className = "rule-actions-row";
                    const cleanBtn = document.createElement("button");
                    cleanBtn.type = "button";
                    cleanBtn.className = "btn-clean-corrupt";
                    cleanBtn.textContent = "🗑️ Remove Invalid Entry";
                    cleanBtn.title = "This entry has no valid domain and cannot match any website";
                    cleanBtn.addEventListener("click", function (e) {
                        e.stopPropagation();
                        browserAPI.storage.local.get(["blockedWebsites"], function (res) {
                            const list = (res && res.blockedWebsites) || [];
                            if (index >= 0 && index < list.length) {
                                list.splice(index, 1);
                                browserAPI.storage.local.set({ blockedWebsites: list }, function () {
                                    loadWebsites();
                                });
                            }
                        });
                    });
                    actionsRow.appendChild(cleanBtn);
                    infoDiv.appendChild(actionsRow);
                } else if (isExact && domain) {
                    const actionsRow = document.createElement("div");
                    actionsRow.className = "rule-actions-row";
                    const upgradeBtn = document.createElement("button");
                    upgradeBtn.type = "button";
                    upgradeBtn.className = "btn-upgrade-domain";
                    upgradeBtn.textContent = `🛡️ Block All of ${domain}`;
                    upgradeBtn.title = `Switch to blocking the entire ${domain} website (all pages & subdomains)`;
                    upgradeBtn.addEventListener("click", function (e) {
                        e.stopPropagation();
                        browserAPI.storage.local.get(["blockedWebsites"], function (res) {
                            const list = (res && res.blockedWebsites) || [];
                            if (list[index]) {
                                if (typeof list[index] === "object") {
                                    list[index].url = domain;
                                    list[index].scope = "domain";
                                } else {
                                    list[index] = { url: domain, scope: "domain", createdAt: Date.now() };
                                }
                                browserAPI.storage.local.set({ blockedWebsites: list }, function () {
                                    loadWebsites();
                                });
                            }
                        });
                    });
                    actionsRow.appendChild(upgradeBtn);
                    infoDiv.appendChild(actionsRow);
                }

                // Delete button
                const deleteBtn = document.createElement("button");
                const btnSpan = document.createElement("span");
                if (isLocked) {
                    deleteBtn.className = "delete-btn btn-locked";
                    deleteBtn.disabled = true;
                    btnSpan.textContent = "🔒 Locked";
                    deleteBtn.appendChild(btnSpan);
                    deleteBtn.title = `Locked until ${formatTargetTime(blockUntil)}`;
                } else {
                    deleteBtn.className = "delete-btn btn-unlocked";
                    deleteBtn.disabled = false;
                    btnSpan.textContent = "🗑️ Delete";
                    deleteBtn.appendChild(btnSpan);
                    deleteBtn.title = "Delete and unblock";
                }

                li.appendChild(infoDiv);
                li.appendChild(deleteBtn);
                websiteList.appendChild(li);
            });
        });
    }

    // Initial render of websites list
    loadWebsites();

    // Start single ticker loop for live countdown updates
    startCountdownTicker();
}

// Clean up timer on unload
window.addEventListener("unload", function () {
    if (activeCountdownInterval !== null) {
        clearInterval(activeCountdownInterval);
        activeCountdownInterval = null;
    }
});

// Robust initialization check (handles both async DOM loading and already-interactive states)
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPopup);
} else {
    initPopup();
}
