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
    const data = await chrome.storage.local.get(["blockedWebsites"]);
    const websites = data.blockedWebsites || [];

    const oldRules = await chrome.declarativeNetRequest.getDynamicRules();
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
                    extensionPath: "/blocked.html"
                }
            },
            condition: {
                urlFilter: urlFilter,
                resourceTypes: ["main_frame"]
            }
        };
    });

    await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: oldRuleIds,
        addRules: newRules
    });

    // Also immediately redirect any currently open tabs matching the blocked websites/URLs
    redirectOpenBlockedTabs(websites);
}

// Redirect any active tabs that match newly blocked sites/URLs
function redirectOpenBlockedTabs(websites) {
    if (!chrome.tabs) return;

    chrome.tabs.query({}, (tabs) => {
        if (!tabs || !tabs.length) return;
        const blockedPageUrl = chrome.runtime.getURL("blocked.html");

        tabs.forEach((tab) => {
            if (!tab.url || tab.url.startsWith("chrome://") || tab.url.startsWith("edge://") || tab.url.startsWith(blockedPageUrl)) {
                return;
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

            if (shouldBlock) {
                chrome.tabs.update(tab.id, { url: blockedPageUrl });
            }
        });
    });
}

// 🔥 Automatically update rules whenever storage changes
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.blockedWebsites) {
        updateBlockingRules();
    }
});

// Extension install or startup
chrome.runtime.onInstalled.addListener(() => {
    updateBlockingRules();
});

chrome.runtime.onStartup.addListener(() => {
    updateBlockingRules();
});