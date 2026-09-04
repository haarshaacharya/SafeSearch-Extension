document.addEventListener("DOMContentLoaded", function () {
    const goBackBtn = document.getElementById("goBack");
    if (!goBackBtn) return;

    goBackBtn.addEventListener("click", function () {
        handleGoBack();
    });
});

function handleGoBack() {
    // 1. Try Chrome tabs API if available
    if (typeof chrome !== "undefined" && chrome.tabs && chrome.tabs.getCurrent) {
        chrome.tabs.getCurrent(function (tab) {
            if (tab && tab.id) {
                chrome.tabs.goBack(tab.id, function () {
                    if (chrome.runtime.lastError) {
                        // If no previous history entry exists (e.g. fresh tab), navigate away
                        navigateToSafePage(tab.id);
                    }
                });

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

            standardGoBack();
        });
    } else {
        standardGoBack();
    }
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
    if (typeof chrome !== "undefined" && chrome.tabs && tabId) {
        chrome.tabs.update(tabId, { url: "chrome://newtab" }, function () {
            if (chrome.runtime.lastError) {
                window.location.href = "https://www.google.com";
            }
        });
    } else {
        window.location.href = "https://www.google.com";
    }
}
