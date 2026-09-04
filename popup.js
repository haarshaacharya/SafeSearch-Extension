document.addEventListener("DOMContentLoaded", function () {

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

    function showKeywordFeedback(msg) {
        if (!keywordStatus) return;
        keywordStatus.textContent = msg;
        setTimeout(function () {
            keywordStatus.textContent = "🔒 Searches are permanently blocked and hidden.";
        }, 2500);
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

    keywordInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
            addKeywordBtn.click();
        }
    });

    websiteInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
            addWebsiteBtn.click();
        }
    });

    // ============================
    // LOAD DATA WHEN POPUP OPENS
    // ============================

    loadWebsites();

    // Live 1-second countdown ticker to update website badges and unlock buttons
    setInterval(function () {
        updateActiveTimers();
    }, 1000);

    // ============================
    // ADD SEARCH KEYWORD (PERMANENT & HIDDEN)
    // ============================

    addKeywordBtn.addEventListener("click", function () {
        const keyword = keywordInput.value.trim().toLowerCase();
        if (keyword === "") return;

        chrome.storage.local.get(["blockedKeywords"], function (result) {
            const raw = result.blockedKeywords || [];

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

                chrome.storage.local.set({ blockedKeywords: raw }, function () {
                    keywordInput.value = "";
                    showKeywordFeedback("✅ Search term blocked & hidden permanently!");
                });
            } else {
                keywordInput.value = "";
                showKeywordFeedback("ℹ️ Search term is already blocked!");
            }
        });
    });

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
    // ADD WEBSITE (WITH TIMER & LOCK)
    // ============================

    addWebsiteBtn.addEventListener("click", function () {
        const website = cleanTargetUrl(websiteInput.value);
        if (website === "") return;

        const blockUntil = calculateBlockUntilTimestamp(websiteBlockTime.value);

        chrome.storage.local.get(["blockedWebsites"], function (result) {
            const raw = result.blockedWebsites || [];

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

                chrome.storage.local.set({ blockedWebsites: raw }, function () {
                    websiteInput.value = "";
                    loadWebsites();
                });
            } else {
                websiteInput.value = "";
            }
        });
    });

    // ============================
    // LOAD WEBSITES
    // ============================

    function loadWebsites() {
        chrome.storage.local.get(["blockedWebsites"], function (result) {
            const raw = result.blockedWebsites || [];
            websiteList.innerHTML = "";

            raw.forEach(function (item, index) {
                const website = typeof item === "string" ? item : (item.url || "");
                const blockUntil = typeof item === "string" ? null : item.blockUntil;
                const now = Date.now();
                const isLocked = Boolean(blockUntil && now < blockUntil);

                const li = document.createElement("li");
                li.setAttribute("data-type", "website");
                li.setAttribute("data-index", index);
                if (blockUntil) {
                    li.setAttribute("data-block-until", blockUntil);
                }

                // Info container
                const infoDiv = document.createElement("div");
                infoDiv.className = "item-info";

                // Title
                const titleDiv = document.createElement("div");
                titleDiv.className = "item-title";
                titleDiv.innerHTML = `<span>🌐</span> <span>${escapeHtml(website)}</span>`;

                // Status badge
                const statusDiv = document.createElement("div");
                statusDiv.className = "item-status";

                if (isLocked) {
                    const remainingMs = blockUntil - now;
                    statusDiv.innerHTML = `<span class="badge badge-locked">🔒 Locked until ${formatTargetTime(blockUntil)} (⏳ <span class="time-countdown">${formatTimeRemaining(remainingMs)}</span>)</span>`;
                } else if (blockUntil && now >= blockUntil) {
                    statusDiv.innerHTML = `<span class="badge badge-unlocked">🔓 Time Complete (Ready to Delete)</span>`;
                } else {
                    statusDiv.innerHTML = `<span class="badge badge-permanent">🛡️ Always Blocked</span>`;
                }

                infoDiv.appendChild(titleDiv);
                infoDiv.appendChild(statusDiv);

                // Delete button
                const deleteBtn = document.createElement("button");
                if (isLocked) {
                    deleteBtn.className = "delete-btn btn-locked";
                    deleteBtn.disabled = true;
                    deleteBtn.innerHTML = "🔒 Locked";
                    deleteBtn.title = `Locked until ${formatTargetTime(blockUntil)}`;
                } else {
                    deleteBtn.className = "delete-btn btn-unlocked";
                    deleteBtn.disabled = false;
                    deleteBtn.innerHTML = "🗑️ Delete";
                    deleteBtn.title = "Delete and unblock";

                    deleteBtn.addEventListener("click", function () {
                        raw.splice(index, 1);
                        chrome.storage.local.set({ blockedWebsites: raw }, function () {
                            loadWebsites();
                        });
                    });
                }

                li.appendChild(infoDiv);
                li.appendChild(deleteBtn);
                websiteList.appendChild(li);
            });
        });
    }

    // ============================
    // LIVE TICKER UPDATE (WEBSITES)
    // ============================

    function updateActiveTimers() {
        const now = Date.now();
        let needsReRender = false;

        document.querySelectorAll("li[data-block-until]").forEach(function (li) {
            const blockUntil = parseInt(li.getAttribute("data-block-until"), 10);
            if (isNaN(blockUntil)) return;

            const remainingMs = blockUntil - now;
            if (remainingMs <= 0) {
                // Timer has just expired! Trigger full re-render so buttons unlock
                needsReRender = true;
            } else {
                // Update countdown text live
                const countdownSpan = li.querySelector(".time-countdown");
                if (countdownSpan) {
                    countdownSpan.textContent = formatTimeRemaining(remainingMs);
                }
            }
        });

        if (needsReRender) {
            loadWebsites();
        }
    }

    // HTML sanitizer to prevent XSS
    function escapeHtml(str) {
        const div = document.createElement("div");
        div.textContent = str;
        return div.innerHTML;
    }

});