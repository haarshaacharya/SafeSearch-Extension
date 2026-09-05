// SafeSearch - Cross-Browser Popup Controller
// Compatible with Chrome, Edge, Firefox Desktop & Firefox Android

// Cross-browser compatibility API adapter
const browserAPI = typeof browser !== "undefined" && browser.storage ? browser : chrome;

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

    // ============================
    // HELPER FUNCTIONS
    // ============================

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

    // Format remaining milliseconds into human readable string
    function formatTimeRemaining(ms) {
        if (ms <= 0) return "0s";

        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        if (hours > 0) {
            return `${hours}h ${minutes}m ${seconds}s`;
        }
        if (minutes > 0) {
            return `${minutes}m ${seconds}s`;
        }
        return `${seconds}s`;
    }

    // Format target timestamp into local time string (e.g. "10:00 PM" or "Tomorrow 10:00 PM")
    function formatTargetTime(timestamp) {
        if (!timestamp) return "";
        const targetDate = new Date(timestamp);
        const now = new Date();

        const isTomorrow = targetDate.getDate() !== now.getDate() || targetDate.getMonth() !== now.getMonth();
        const timeStr = targetDate.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true });

        return isTomorrow ? `Tomorrow ${timeStr}` : timeStr;
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

    function cleanTargetUrl(input) {
        if (!input) return "";
        let str = input.trim().toLowerCase();
        // Remove protocol http:// or https://
        str = str.replace(/^https?:\/\//i, "");
        // Remove leading www.
        str = str.replace(/^www\./i, "");
        // Remove trailing slashes
        str = str.replace(/\/+$/, "");
        return str;
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
                    text.textContent = "Time Complete (Ready to Delete)";
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
    // PRESET CHIPS HANDLER (WEBSITES)
    // ============================

    document.querySelectorAll(".preset-chip").forEach(function (chip) {
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
    }

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
            const website = cleanTargetUrl(websiteInput.value);
            if (website === "") return;

            const blockUntil = calculateBlockUntilTimestamp(websiteBlockTime.value);

            browserAPI.storage.local.get(["blockedWebsites"], function (result) {
                if (browserAPI.runtime && browserAPI.runtime.lastError) {
                    console.error("Storage error:", browserAPI.runtime.lastError);
                    return;
                }
                const raw = (result && result.blockedWebsites) || [];

                // Check if already exists
                const exists = raw.some(function (item) {
                    const w = typeof item === "string" ? item : (item.url || "");
                    return cleanTargetUrl(w) === website;
                });

                if (!exists) {
                    const newItem = {
                        url: website,
                        blockUntil: blockUntil,
                        createdAt: Date.now()
                    };

                    raw.push(newItem);

                    browserAPI.storage.local.set({ blockedWebsites: raw }, function () {
                        websiteInput.value = "";
                        loadWebsites();
                    });
                } else {
                    websiteInput.value = "";
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

            raw.forEach(function (item, index) {
                const website = typeof item === "string" ? item : (item.url || "");
                const blockUntil = typeof item === "string" ? null : item.blockUntil;
                const now = Date.now();
                const isLocked = Boolean(blockUntil && now < blockUntil);

                const li = document.createElement("li");
                li.className = isLocked ? "rule-item is-locked" : "rule-item is-unlocked";
                li.setAttribute("data-type", "website");
                li.setAttribute("data-index", index);
                if (isLocked) {
                    li.setAttribute("data-block-until", blockUntil);
                }

                // Info container
                const infoDiv = document.createElement("div");
                infoDiv.className = "item-info";

                // Title
                const titleDiv = document.createElement("div");
                titleDiv.className = "item-title";
                const siteIcon = document.createElement("span");
                siteIcon.className = "site-icon";
                siteIcon.textContent = "🌐";
                const siteName = document.createElement("span");
                siteName.className = "site-name";
                siteName.textContent = website;
                titleDiv.appendChild(siteIcon);
                titleDiv.appendChild(document.createTextNode(" "));
                titleDiv.appendChild(siteName);

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
                    badgeText.appendChild(document.createTextNode(`Locked until ${formatTargetTime(blockUntil)} (`));
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
                    badgeText.textContent = "Time Complete (Ready to Delete)";
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
