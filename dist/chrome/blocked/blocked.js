// Cross-browser compatibility API adapter
const browserAPI = typeof browser !== "undefined" ? browser : chrome;

document.addEventListener("DOMContentLoaded", function () {
    const goBackBtn = document.getElementById("goBack");
    if (!goBackBtn) return;

    goBackBtn.addEventListener("click", function () {
        handleGoBack();
    });
});

async function handleGoBack() {
    try {
        if (browserAPI && browserAPI.tabs && browserAPI.tabs.getCurrent) {
            let tab = null;

            // Handle Promise (Firefox & Chrome MV3) or callback fallback
            const res = browserAPI.tabs.getCurrent((t) => {
                if (t) tab = t;
            });
            if (res && typeof res.then === "function") {
                tab = await res;
            }

            if (tab && tab.id) {
                if (browserAPI.tabs.goBack) {
                    try {
                        const backRes = browserAPI.tabs.goBack(tab.id, () => {
                            if (browserAPI.runtime && browserAPI.runtime.lastError) {
                                navigateToSafePage(tab.id);
                            }
                        });
                        if (backRes && typeof backRes.then === "function") {
                            await backRes.catch(() => navigateToSafePage(tab.id));
                        }
                    } catch (e) {
                        standardGoBack();
                    }
                } else {
                    standardGoBack();
                }

                // Failsafe: If after 350ms we are still on blocked.html
                // (handles redirect bounce where going back 1 step hits the blocked URL again)
                setTimeout(function () {
                    if (window.history.length > 2) {
                        window.history.go(-2);
                    } else {
                        navigateToSafePage(tab.id);
                    }
                }, 350);

                return;
            }
        }
    } catch (err) {
        // Fallback to standard history navigation
    }

    standardGoBack();
}

function standardGoBack() {
    if (window.history.length > 1) {
        window.history.back();

        setTimeout(function () {
            if (window.history.length > 2) {
                window.history.go(-2);
            } else {
                window.location.href = "https://www.google.com";
            }
        }, 350);
    } else {
        window.location.href = "https://www.google.com";
    }
}

function navigateToSafePage(tabId) {
    const isFirefox = typeof navigator !== "undefined" && navigator.userAgent.toLowerCase().includes("firefox");

    // In Firefox, navigating to chrome://newtab or about:newtab throws security errors, so navigate to a clean safe site
    if (isFirefox) {
        window.location.href = "https://www.google.com";
        return;
    }

    if (browserAPI && browserAPI.tabs && tabId) {
        try {
            const updateRes = browserAPI.tabs.update(tabId, { url: "chrome://newtab" }, function () {
                if (browserAPI.runtime && browserAPI.runtime.lastError) {
                    window.location.href = "https://www.google.com";
                }
            });
            if (updateRes && typeof updateRes.catch === "function") {
                updateRes.catch(() => {
                    window.location.href = "https://www.google.com";
                });
            }
        } catch (e) {
            window.location.href = "https://www.google.com";
        }
    } else {
        window.location.href = "https://www.google.com";
    }
}
