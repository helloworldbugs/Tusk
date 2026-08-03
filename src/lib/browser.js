/**
 * Cross-browser API compatibility shim.
 * Maps Chrome MV3 APIs to Firefox MV2 equivalents.
 */
var isFirefox = typeof browser !== 'undefined' && !!browser.runtime;

export function getAction() {
  // @ts-ignore
  return isFirefox ? chrome.browserAction : chrome.action;
}

export function openPopup() {
  if (isFirefox) {
    // @ts-ignore
    chrome.browserAction.openPopup();
  } else {
    chrome.action.openPopup();
  }
}

export function setBadgeText(details) {
  // @ts-ignore
  (isFirefox ? chrome.browserAction : chrome.action).setBadgeText(details);
}

export function setBadgeBackgroundColor(details) {
  // @ts-ignore
  (isFirefox ? chrome.browserAction : chrome.action).setBadgeBackgroundColor(details);
}

/**
 * Execute a script in a tab. Firefox MV2 uses chrome.tabs.executeScript with
 * {code: string}, Chrome MV3 uses chrome.scripting.executeScript with {func}.
 */
export function executeScriptInline(tabId, func, args) {
  if (isFirefox) {
    // Firefox MV2: convert func+args to a code string
    var argStr = JSON.stringify(args || []);
    var code = '(' + func.toString() + ').apply(null, ' + argStr + ');';
    // @ts-ignore
    chrome.tabs.executeScript(tabId, { code: code });
  } else {
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: func,
      args: args || [],
    });
  }
}

export { isFirefox };
