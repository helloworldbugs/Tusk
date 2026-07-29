'use strict';

/*
  This page runs as an Background page, not an event

  Be careful using settings.
  Settings can call secureCacheMemory, which in turn can open new ports to this script.
*/

import { ProtectedMemory } from '$services/protectedMemory';
import { Settings } from '$services/settings.js';
import { Notifications } from '$services/notifications';

function Background(protectedMemory, localMemory, settings, notifications) {
  console.log('Background worker registered.');
  chrome.runtime.onInstalled.addListener(settings.upgrade);
  chrome.runtime.onStartup.addListener(forgetStuff);

  //keep saved state for the popup for as long as we are alive (not long):
  chrome.runtime.onConnect.addListener(function (port) {
    //communicate state on this pipe.  each named port gets its own state.
    port.onMessage.addListener(function (msg) {
      if (!msg) return;
      switch (msg.action) {
        case 'clear':
          (msg.storageType === 'local' ? localMemory : protectedMemory).clearData(msg.key);
          break;
        case 'save':
          (msg.storageType === 'local' ? localMemory : protectedMemory).setData(msg.key, msg.value);
          break;
        case 'get':
          (msg.storageType === 'local' ? localMemory : protectedMemory).getData(msg.key).then(function (value) {
            port.postMessage(value);
          });
          break;
        case 'forgetStuff':
          forgetStuff();
          break;
        default:
          throw new Error('unrecognized action ' + obj.action);
          break;
      }
    });

    port.onDisconnect.addListener(function () {
      //uncomment below to forget the state when the popup closes
      //protectedMemory.clearData();
    });
  });

  function handleMessage(message, sender, sendResponse) {
    if (!message || !message.m) return; //message format unrecognized

    if (message.m == 'showMessage') {
      const expire = typeof message.expire !== 'undefined' ? message.expire * 1000 : 60000;
      chrome.notifications.create(
        null,
        {
          type: 'basic',
          iconUrl: '/assets/48x48.png',
          title: 'Tusk',
          message: message.text,
        },
        function (notificationId) {
          setTimeout(() => chrome.notifications.clear(notificationId), expire);
        }
      );
    }

    if (message.m == 'requestPermission') {
      //better to do the request here on the background, because on some platforms
      //the popup may close prematurely when requesting access
      chrome.permissions.contains(message.perms, function (alreadyGranted) {
        if (chrome.runtime.lastError || (alreadyGranted && message.then)) {
          handleMessage(message.then, sender, sendResponse);
        } else {
          //request
          chrome.permissions.request(message.perms, function (granted) {
            if (granted && message.then) {
              handleMessage(message.then, sender, sendResponse);
            }
          });
        }
      });
    }

    if (message.m == 'autofill') {
      alreadyInjected(message.tabId).then((injectedAlready) => {
        if (injectedAlready === true) {
          chrome.tabs.sendMessage(message.tabId, {
            m: 'fillPassword',
            u: message.u,
            p: message.p,
            o: message.o,
          });
          return;
        }
        chrome.scripting.executeScript(
          {
            target: { tabId: message.tabId, allFrames: true },
            files: ['/dist/contentScripts/index.global.js'],
          },
          function (result) {
            //script injected
            console.log('Autofill script injected.');
            chrome.tabs.sendMessage(message.tabId, {
              m: 'fillPassword',
              u: message.u,
              p: message.p,
              o: message.o,
            });
          }
        );
      });
    }

    if (message.m == 'uploadDatabase') {
      var binary = atob(message.data);
      var bytes = new Uint8Array(binary.length);
      for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      var arrayBuffer = bytes.buffer;
      import('$services/webdavFileManager.js').then(({ WebdavFileManager }) => {
        const wm = new WebdavFileManager(settings);
        return wm.uploadCurrentDatabase(arrayBuffer);
      }).then(() => {
        sendResponse({ success: true });
      }).catch((err) => {
        sendResponse({ error: err.message });
      });
      return true; // keep channel open for async response
    }
  }

  // function to determine if the content script is already injected, so we don't do it twice
  function alreadyInjected(tabId) {
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, { m: 'ping' }, (response) => {
        if (response) resolve(true);
        else {
          let err = chrome.runtime.lastError;
          resolve(false);
        }
      });
    });
  }

  //listen for "autofill" message:
  chrome.runtime.onMessage.addListener(handleMessage);

  chrome.alarms.create('forgetStuff', {
    delayInMinutes: 1,
    periodInMinutes: 2,
  });

  // Trigger immediately on service worker wake-up
  forgetStuff();
  setTimeout(updateBadgeForTab, 200); // brief delay for storage to be ready

  // Update badge when active tab changes
  var updateBadgeForTab = function() {
    console.log('[badge] updateBadgeForTab called');
    chrome.storage.local.get('rememberPeriod', function(items) {
      if (items.rememberPeriod !== -2) return;
      protectedMemory.getData('secureCache.entries').then(function(entries) {
        if (!entries || !entries.length) {
          localMemory.getData('secureCache.entries').then(function(localEntries) {
            if (localEntries && localEntries.length) filterAndSetBadge(localEntries);
          }).catch(function() {});
          return;
        }
        console.log('[badge] got', entries.length, 'entries, filtering');
        filterAndSetBadge(entries);
      }).catch(function() {});
    });
  };
  
  function filterAndSetBadge(entries) {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      console.log('[badge] tabs query returned', tabs.length, 'tabs');
      var count = 0;
      if (tabs.length > 0 && tabs[0].url && tabs[0].url.startsWith('http')) {
        try {
          var hostname = new URL(tabs[0].url).hostname;
          var matched = entries.filter(function(e) {
            return e.url && e.url.indexOf(hostname) > -1;
          });
          count = matched.length;
          console.log('[badge] matched', count, 'for', hostname);
        } catch(e) { console.error('[badge] filter error', e); }
      }
      if (count > 0) {
        chrome.action.setBadgeText({ text: String(count) });
        chrome.action.setBadgeBackgroundColor({ color: '#4688F1' });
        console.log('[badge] set badge to', count);
      } else {
        chrome.action.setBadgeText({ text: '' });
        console.log('[badge] cleared badge');
      }
    });
  }

  chrome.tabs.onActivated.addListener(updateBadgeForTab);
  chrome.tabs.onUpdated.addListener(function(tabId, changeInfo) {
    if (changeInfo.status === 'complete') updateBadgeForTab();
  });

  chrome.alarms.onAlarm.addListener(function (alarm) {
    if (alarm.name == 'forgetStuff') {
        forgetStuff();
        updateBadgeForTab();
        return;
    }
  });

  function forgetStuff() {
    console.log('Alarm Handler -- Check if we should clear Cache --', new Date());
    chrome.storage.local.get('rememberPeriod', function(items) {
      if (items.rememberPeriod === -2) {
        console.log('[forgetStuff] Forever mode, restoring cache from local');
        localMemory.getData('secureCache.entries').then(function(entries) {
          if (entries && entries.length > 0) {
            protectedMemory.setData('secureCache.entries', entries);
          }
        }).catch(function() {});
      } else {
        protectedMemory.clearData('secureCache.entries');
        chrome.action.setBadgeText({ text: '' });
      }
    });
    settings.getAllForgetTimes().then(function (allTimes) {
      var now = Date.now();
      var forgottenKeys = [];
      for (var key in allTimes) {
        // If the time has passed but is still positive...
        if (allTimes[key] < now && allTimes[key] > 0) {
          forgottenKeys.push(key);
          switch (key) {
            case 'clearClipboard':
              clearClipboard();
              notifications.push({
                text: 'Clipboard cleared',
                type: 'expiration',
                expire: 2,
              });
              break;
            default:
              if (key.indexOf('password') >= 0) {
                forgetPassword().then(() => {
                  notifications.push({
                    text: 'Remember password expired',
                    type: 'expiration',
                  });
                });
              } else {
                console.error("I don't know what to do with key", key);
              }
          }
        }
      }

      //remove stuff
      settings.clearForgetTimes(forgottenKeys);
    });
  }

  function clearClipboard() {
    // No longer have access to document in this context.
    // https://github.com/GoogleChrome/chrome-extensions-samples/tree/main/functional-samples/cookbook.offscreen-clipboard-write
    console.info('Clearing clipboard');
    // var clearClipboard = function(e) {
    // 	e.clipboardData.setData('text/plain', "");
    // 	e.preventDefault();
    // 	document.removeEventListener('copy', clearClipboard); //don't listen anymore
    // }

    // document.addEventListener('copy', clearClipboard);
    // document.execCommand('copy');
  }

  function forgetPassword() {
    return settings
      .getCurrentDatabaseChoice()
      .then((info) => {
        let key = info.passwordFile.title + '__' + info.providerKey + '.password';
        return key;
      })
      .then(protectedMemory.clearData);
  }
}

const settings = new Settings();
const notifications = new Notifications(settings);
const protectedMemory = new ProtectedMemory('session');
const localMemory = new ProtectedMemory('local');

Background(protectedMemory, localMemory, settings, notifications);
