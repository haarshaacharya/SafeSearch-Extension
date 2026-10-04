// Cross-browser compatibility API adapter
const browserAPI = typeof browser !== "undefined" ? browser : chrome;

const BLOCKED_PAGE_PATH = "/blocked.html";
const BLOCKED_PAGE_URL = (browserAPI.runtime && browserAPI.runtime.getURL) 
    ? browserAPI.runtime.getURL("blocked.html") 
    : "";

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

function isTabUrlBlocked(tabUrl, websites) {
    if (!tabUrl || !websites || !websites.length) return false;

    if (tabUrl.startsWith("chrome://") || 
        tabUrl.startsWith("edge://") || 
        tabUrl.startsWith("about:") || 
        tabUrl.startsWith("moz-extension://") || 
        tabUrl.startsWith("chrome-extension://") || 
        (BLOCKED_PAGE_URL && tabUrl.startsWith(BLOCKED_PAGE_URL))) {
        return false;
    }

    try {
        const tabUrlObj = new URL(tabUrl);
        const tabDomain = tabUrlObj.hostname.toLowerCase().replace(/^www\./, "");
        const tabFull = (tabDomain + tabUrlObj.pathname).toLowerCase().replace(/\/+$/, "");

        return websites.some((item) => {
            const raw = typeof item === "string" ? item : (item.url || "");
            const target = cleanTargetUrl(raw);
            if (!target) return false;

            const isExact = (typeof item === "object" && item.scope === "exact");

            if (isExact && target.includes("/")) {
                // Exact path match (e.g. youtube.com/shorts)
                return tabFull === target || tabFull.startsWith(target + "/");
            } else {
                // Entire website domain block (e.g. linkedin.com blocks all feeds, networks, subdomains)
                const targetDomain = extractDomain(target) || target;
                if (!targetDomain) return false;
                return tabDomain === targetDomain || tabDomain.endsWith("." + targetDomain);
            }
        });
    } catch (e) {
        return false;
    }
}

async function updateBlockingRules() {
    if (!browserAPI || !browserAPI.storage || !browserAPI.declarativeNetRequest) {
        return;
    }

    try {
        const data = await browserAPI.storage.local.get(["blockedWebsites"]);
        const websites = (data && data.blockedWebsites) || [];

        const oldRules = await browserAPI.declarativeNetRequest.getDynamicRules();
        const oldRuleIds = oldRules.map(rule => rule.id);

        const newRules = websites.map((item, index) => {
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

        // Immediately redirect any currently open tabs matching blocked rules
        await redirectOpenBlockedTabs(websites);
    } catch (err) {
        console.error("SafeSearch: Error updating blocking rules", err);
    }
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
            if (isTabUrlBlocked(tab.url, websites) && browserAPI.tabs.update) {
                try {
                    const updateRes = browserAPI.tabs.update(tab.id, { url: BLOCKED_PAGE_URL });
                    if (updateRes && typeof updateRes.catch === "function") {
                        updateRes.catch(() => {});
                    }
                } catch (e) {}
            }
        }
    } catch (err) {
        // Gracefully handle environments where tabs.query is unsupported
    }
}

// Listen for tab navigation (handles Single Page App / SPA URL changes e.g. clicking LinkedIn Network)
if (browserAPI.tabs && browserAPI.tabs.onUpdated) {
    browserAPI.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
        const urlToCheck = changeInfo.url || (tab && tab.url);
        if (!urlToCheck) return;

        try {
            const data = await browserAPI.storage.local.get(["blockedWebsites"]);
            const websites = (data && data.blockedWebsites) || [];
            if (isTabUrlBlocked(urlToCheck, websites) && browserAPI.tabs.update) {
                browserAPI.tabs.update(tabId, { url: BLOCKED_PAGE_URL }).catch(() => {});
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

            if (!tab || !tab.url) return;

            const data = await browserAPI.storage.local.get(["blockedWebsites"]);
            const websites = (data && data.blockedWebsites) || [];
            if (isTabUrlBlocked(tab.url, websites) && browserAPI.tabs.update) {
                browserAPI.tabs.update(activeInfo.tabId, { url: BLOCKED_PAGE_URL }).catch(() => {});
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