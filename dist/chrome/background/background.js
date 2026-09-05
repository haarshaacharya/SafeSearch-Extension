// Cross-browser compatibility API adapter
const browserAPI = typeof browser !== "undefined" ? browser : chrome;

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

            // If target contains a path (e.g. youtube.com/shorts), match with wildcard
            // Otherwise if it's a domain (e.g. website.com), match domain boundary
            const urlFilter = target.includes("/") ? `||${target}*` : `||${target}^`;

            return {
                id: index + 1,
                priority: 1,
                action: {
                    type: "redirect",
                    redirect: {
                        extensionPath: "/blocked/blocked.html"
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

        // Also immediately redirect any currently open tabs matching the blocked websites/URLs
        await redirectOpenBlockedTabs(websites);
    } catch (err) {
        console.error("SafeSearch: Error updating blocking rules", err);
    }
}

// Redirect any active tabs that match newly blocked sites/URLs (Promise-based for Chrome MV3 & Firefox)
async function redirectOpenBlockedTabs(websites) {
    if (!browserAPI.tabs || !browserAPI.tabs.query) return;

    try {
        // browserAPI.tabs.query returns a Promise in Firefox and Chrome MV3
        const queryPromise = browserAPI.tabs.query({});
        const tabs = (queryPromise && typeof queryPromise.then === "function") 
            ? await queryPromise 
            : await new Promise((resolve) => browserAPI.tabs.query({}, resolve));

        if (!tabs || !tabs.length) return;
        const blockedPageUrl = browserAPI.runtime.getURL("blocked/blocked.html");

        for (const tab of tabs) {
            if (!tab.url || 
                tab.url.startsWith("chrome://") || 
                tab.url.startsWith("edge://") || 
                tab.url.startsWith("about:") || 
                tab.url.startsWith("moz-extension://") || 
                tab.url.startsWith("chrome-extension://") || 
                tab.url.startsWith(blockedPageUrl)) {
                continue;
            }

            const shouldBlock = websites.some((item) => {
                const raw = typeof item === "string" ? item : (item.url || "");
                const target = cleanTargetUrl(raw);
                if (!target) return false;

                try {
                    const tabUrlObj = new URL(tab.url);
                    const tabDomain = tabUrlObj.hostname.toLowerCase().replace(/^www\./, "");
                    const tabFull = (tabDomain + tabUrlObj.pathname).toLowerCase().replace(/\/+$/, "");

                    if (target.includes("/")) {
                        return tabFull.startsWith(target);
                    } else {
                        return tabDomain === target || tabDomain.endsWith("." + target);
                    }
                } catch (e) {
                    return false;
                }
            });

            if (shouldBlock && browserAPI.tabs.update) {
                try {
                    const updateRes = browserAPI.tabs.update(tab.id, { url: blockedPageUrl });
                    if (updateRes && typeof updateRes.catch === "function") {
                        updateRes.catch(() => {});
                    }
                } catch (e) {
                    // Ignore per-tab update rejections
                }
            }
        }
    } catch (err) {
        // Gracefully handle environments (such as Firefox Android) where tabs.query is unsupported
    }
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
