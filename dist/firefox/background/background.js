// Cross-browser compatibility API adapter
const browserAPI = typeof browser !== "undefined" ? browser : chrome;

const BLOCKED_PAGE_PATH = "/blocked/blocked.html";
const BLOCKED_PAGE_URL = (browserAPI.runtime && browserAPI.runtime.getURL) 
    ? browserAPI.runtime.getURL("blocked/blocked.html") 
    : "";
const EXPIRY_ALARM_NAME = "safesearch-website-expiry";

function getNextDailyBlockTime(timeString, now) {
    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(timeString || "");
    if (!match) return null;

    const target = new Date(now);
    target.setHours(Number(match[1]), Number(match[2]), 0, 0);
    if (target.getTime() <= now) {
        target.setDate(target.getDate() + 1);
    }
    return target.getTime();
}

function refreshRecurringBlocks(websites, now) {
    websites.forEach((item) => {
        if (item && typeof item === "object" && item.allDays && item.targetTime &&
            Number.isFinite(item.blockUntil) && item.blockUntil <= now) {
            const nextBlockUntil = getNextDailyBlockTime(item.targetTime, now);
            if (nextBlockUntil) item.blockUntil = nextBlockUntil;
        }
    });
}

async function scheduleNextExpiry(websites, now) {
    if (!browserAPI.alarms) return;

    await browserAPI.alarms.clear(EXPIRY_ALARM_NAME);
    const nextExpiry = websites.reduce((next, item) => {
        const blockUntil = item && typeof item === "object" ? item.blockUntil : null;
        return Number.isFinite(blockUntil) && blockUntil > now
            ? Math.min(next, blockUntil)
            : next;
    }, Infinity);

    if (Number.isFinite(nextExpiry)) {
        await browserAPI.alarms.create(EXPIRY_ALARM_NAME, { when: nextExpiry });
    }
}

function isInternalBrowserUrl(input) {
    if (!input) return false;
    const str = input.trim().toLowerCase();
    return str.startsWith("chrome://") || 
           str.startsWith("edge://") || 
           str.startsWith("brave://") || 
           str.startsWith("opera://") || 
           str.startsWith("about:");
}

function matchInternalUrl(tabUrl, target) {
    if (!tabUrl || !target) return false;
    const t = target.toLowerCase().replace(/\/+$/, "");
    const u = tabUrl.toLowerCase().replace(/\/+$/, "");

    // Direct match or subpath/query/hash match
    if (u === t || u.startsWith(t + "/") || u.startsWith(t + "?") || u.startsWith(t + "#")) {
        return true;
    }

    // Match browser extensions management aliases
    const extAliases = ["chrome://extensions", "edge://extensions", "brave://extensions", "opera://extensions", "about:addons"];
    if (extAliases.some(alias => t === alias || t.startsWith(alias))) {
        if (extAliases.some(alias => u === alias || u.startsWith(alias + "/") || u.startsWith(alias + "?") || u.startsWith(alias + "#"))) {
            return true;
        }
    }

    // Match browser settings aliases
    const setAliases = ["chrome://settings", "edge://settings", "brave://settings", "opera://settings"];
    if (setAliases.some(alias => t === alias || t.startsWith(alias))) {
        if (setAliases.some(alias => u === alias || u.startsWith(alias + "/") || u.startsWith(alias + "?") || u.startsWith(alias + "#"))) {
            return true;
        }
    }

    return false;
}

function extractDomain(input) {
    if (!input) return "";
    let str = input.trim().toLowerCase();
    if (isInternalBrowserUrl(str)) {
        return cleanTargetUrl(str);
    }
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
    if (isInternalBrowserUrl(str)) {
        str = str.split("?")[0].split("#")[0];
        str = str.replace(/\/+$/, "");
        return str;
    }
    str = str.replace(/^https?:\/\//i, "");
    str = str.replace(/^www\./i, "");
    str = str.split("?")[0].split("#")[0];
    str = str.replace(/\/+$/, "");
    return str;
}

function isTabUrlBlocked(tabUrl, websites) {
    if (!tabUrl || !websites || !websites.length) return false;

    // Never block this extension's own pages (prevent redirect loop)
    if (BLOCKED_PAGE_URL && tabUrl.startsWith(BLOCKED_PAGE_URL)) {
        return false;
    }
    if (browserAPI.runtime && browserAPI.runtime.id) {
        const extOrigin = `chrome-extension://${browserAPI.runtime.id}`;
        const mozOrigin = `moz-extension://${browserAPI.runtime.id}`;
        if (tabUrl.startsWith(extOrigin) || tabUrl.startsWith(mozOrigin)) {
            return false;
        }
    }
    // Whitelist clean newtabs
    if (tabUrl === "about:blank" || tabUrl === "chrome://newtab/" || tabUrl === "edge://newtab/") {
        return false;
    }

    const lowerTabUrl = tabUrl.trim().toLowerCase();
    const tabIsInternal = isInternalBrowserUrl(lowerTabUrl);

    for (const item of websites) {
        const raw = typeof item === "string" ? item : (item.url || "");
        if (!raw) continue;
        const target = cleanTargetUrl(raw);
        if (!target) continue;

        if (tabIsInternal || isInternalBrowserUrl(target)) {
            if (matchInternalUrl(lowerTabUrl, target)) {
                return true;
            }
        } else {
            try {
                const tabUrlObj = new URL(tabUrl);
                const tabDomain = tabUrlObj.hostname.toLowerCase().replace(/^www\./, "");
                const tabFull = (tabDomain + tabUrlObj.pathname).toLowerCase().replace(/\/+$/, "");

                const isExact = (typeof item === "object" && item.scope === "exact");
                if (isExact && target.includes("/")) {
                    if (tabFull === target || tabFull.startsWith(target + "/")) {
                        return true;
                    }
                } else {
                    const targetDomain = extractDomain(target) || target;
                    if (targetDomain && (tabDomain === targetDomain || tabDomain.endsWith("." + targetDomain))) {
                        return true;
                    }
                }
            } catch (e) {}
        }
    }

    return false;
}

async function blockTab(tabId) {
    if (!browserAPI.tabs || !tabId) return;
    try {
        const updateRes = browserAPI.tabs.update(tabId, { url: BLOCKED_PAGE_URL });
        if (updateRes && typeof updateRes.catch === "function") {
            updateRes.catch(() => {
                tryCloseOrReplaceTab(tabId);
            });
        }
    } catch (e) {
        tryCloseOrReplaceTab(tabId);
    }
}

function tryCloseOrReplaceTab(tabId) {
    if (!browserAPI.tabs || !tabId) return;
    try {
        if (browserAPI.tabs.create) {
            browserAPI.tabs.create({ url: BLOCKED_PAGE_URL }, () => {
                try {
                    browserAPI.tabs.remove(tabId, () => {});
                } catch (e) {}
            });
        } else if (browserAPI.tabs.remove) {
            browserAPI.tabs.remove(tabId, () => {});
        }
    } catch (err) {
        try {
            browserAPI.tabs.remove(tabId, () => {});
        } catch (e) {}
    }
}

async function updateBlockingRules() {
    if (!browserAPI || !browserAPI.storage || !browserAPI.declarativeNetRequest) {
        return;
    }

    try {
        const data = await browserAPI.storage.local.get(["blockedWebsites"]);
        const websites = (data && data.blockedWebsites) || [];
        const now = Date.now();
        refreshRecurringBlocks(websites, now);
        const activeWebsites = websites.filter((item) => {
            const blockUntil = item && typeof item === "object" ? item.blockUntil : null;
            return !Number.isFinite(blockUntil) || blockUntil > now;
        });

        const oldRules = await browserAPI.declarativeNetRequest.getDynamicRules();
        const oldRuleIds = oldRules.map(rule => rule.id);

        // Filter out internal URLs from DNR rules since DNR only handles standard web schemes
        const dnrWebsites = activeWebsites.filter((item) => {
            const raw = typeof item === "string" ? item : (item.url || "");
            return !isInternalBrowserUrl(raw);
        });

        const newRules = dnrWebsites.map((item, index) => {
            let raw = typeof item === "string" ? item : (item.url || "");
            let target = cleanTargetUrl(raw);
            const isExact = (typeof item === "object" && item.scope === "exact");

            let urlFilter;
            if (isExact && target.includes("/")) {
                // Explicit exact path block (e.g. youtube.com/shorts)
                urlFilter = `||${target}*`;
            } else {
                // Entire domain block: match domain boundary to block all subpages and subdomains
                const domain = extractDomain(target) || target;
                urlFilter = `||${domain}^`;
            }

            return {
                id: index + 1,
                priority: 1,
                action: {
                    type: "redirect",
                    redirect: {
                        extensionPath: BLOCKED_PAGE_PATH
                    }
                },
                condition: {
                    urlFilter: urlFilter,
                    resourceTypes: ["main_frame"]
                }
            };
        });

        await browserAPI.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: oldRuleIds,
            addRules: newRules
        });

        await scheduleNextExpiry(websites, now);

        // Immediately redirect any currently open tabs matching blocked rules
        await redirectOpenBlockedTabs(activeWebsites);
    } catch (err) {
        console.error("SafeSearch: Error updating blocking rules", err);
    }
}

if (browserAPI.alarms && browserAPI.alarms.onAlarm) {
    browserAPI.alarms.onAlarm.addListener((alarm) => {
        if (alarm.name === EXPIRY_ALARM_NAME) {
            updateBlockingRules();
        }
    });
}

// Redirect any active tabs that match newly blocked sites/URLs
async function redirectOpenBlockedTabs(websites) {
    if (!browserAPI.tabs || !browserAPI.tabs.query) return;

    try {
        const queryPromise = browserAPI.tabs.query({});
        const tabs = (queryPromise && typeof queryPromise.then === "function") 
            ? await queryPromise 
            : await new Promise((resolve) => browserAPI.tabs.query({}, resolve));

        if (!tabs || !tabs.length) return;

        for (const tab of tabs) {
            const urlToCheck = tab.pendingUrl || tab.url;
            if (isTabUrlBlocked(urlToCheck, websites)) {
                blockTab(tab.id);
            }
        }
    } catch (err) {
        // Gracefully handle environments where tabs.query is unsupported
    }
}

// Listen for tab creation
if (browserAPI.tabs && browserAPI.tabs.onCreated) {
    browserAPI.tabs.onCreated.addListener(async (tab) => {
        if (!tab) return;
        const urlToCheck = tab.pendingUrl || tab.url;
        if (!urlToCheck) return;

        try {
            const data = await browserAPI.storage.local.get(["blockedWebsites"]);
            const websites = (data && data.blockedWebsites) || [];
            const activeWebsites = websites.filter((item) => {
                const blockUntil = item && typeof item === "object" ? item.blockUntil : null;
                return !Number.isFinite(blockUntil) || blockUntil > Date.now();
            });
            if (isTabUrlBlocked(urlToCheck, activeWebsites)) {
                blockTab(tab.id);
            }
        } catch (e) {}
    });
}

// Listen for tab navigation (handles Single Page App / SPA URL changes e.g. clicking LinkedIn Network)
if (browserAPI.tabs && browserAPI.tabs.onUpdated) {
    browserAPI.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
        const urlToCheck = changeInfo.url || (tab && (tab.pendingUrl || tab.url));
        if (!urlToCheck) return;

        try {
            const data = await browserAPI.storage.local.get(["blockedWebsites"]);
            const websites = (data && data.blockedWebsites) || [];
            const activeWebsites = websites.filter((item) => {
                const blockUntil = item && typeof item === "object" ? item.blockUntil : null;
                return !Number.isFinite(blockUntil) || blockUntil > Date.now();
            });
            if (isTabUrlBlocked(urlToCheck, activeWebsites)) {
                blockTab(tabId);
            }
        } catch (e) {}
    });
}

// Listen for tab activation (switching to an existing background tab)
if (browserAPI.tabs && browserAPI.tabs.onActivated) {
    browserAPI.tabs.onActivated.addListener(async (activeInfo) => {
        try {
            const getTabPromise = browserAPI.tabs.get(activeInfo.tabId);
            const tab = (getTabPromise && typeof getTabPromise.then === "function")
                ? await getTabPromise
                : await new Promise((resolve) => browserAPI.tabs.get(activeInfo.tabId, resolve));

            if (!tab) return;
            const urlToCheck = tab.pendingUrl || tab.url;
            if (!urlToCheck) return;

            const data = await browserAPI.storage.local.get(["blockedWebsites"]);
            const websites = (data && data.blockedWebsites) || [];
            const activeWebsites = websites.filter((item) => {
                const blockUntil = item && typeof item === "object" ? item.blockUntil : null;
                return !Number.isFinite(blockUntil) || blockUntil > Date.now();
            });
            if (isTabUrlBlocked(urlToCheck, activeWebsites)) {
                blockTab(activeInfo.tabId);
            }
        } catch (e) {}
    });
}

// Automatically update rules whenever storage changes
if (browserAPI.storage && browserAPI.storage.onChanged) {
    browserAPI.storage.onChanged.addListener((changes, area) => {
        if (area === "local" && changes.blockedWebsites) {
            updateBlockingRules();
        }
    });
}

// Extension install or startup
if (browserAPI.runtime && browserAPI.runtime.onInstalled) {
    browserAPI.runtime.onInstalled.addListener(() => {
        updateBlockingRules();
    });
}

if (browserAPI.runtime && browserAPI.runtime.onStartup) {
    browserAPI.runtime.onStartup.addListener(() => {
        updateBlockingRules();
    });
}
