# Tusk — KeePass Browser Extension (Fork)

> 🐘 🔒 Readonly KeePass password database integration for Chrome and Firefox

A fork of [subdavis/Tusk](https://github.com/subdavis/Tusk) with significant improvements.

---

## What's New vs Original

### 🔒 Auto-Unlock on Browser Start

The extension now auto-decrypts your database when Chrome starts if you selected "Remember Forever" on the unlock slider. No need to click the icon — matched entry count appears on the badge immediately.

### 🔢 Badge Count

The extension icon badge shows how many password entries match the current page's URL. Updates automatically when switching tabs.

### ⚡ Click-to-Autofill

Click a password entry directly to auto-fill — no need to open the detail page first.

### ✏️ Edit & Save Entries

Click the pencil icon on any entry to edit title, username, password, URL, or notes. Changes are saved back to the KDBX file and uploaded to your cloud storage.

### 🔗 External Link Button

Each entry has a link button that opens the entry's URL in a new tab.

### 🧩 Unified URL Matching

The old multi-level ranking algorithm (token matching, title matching, phishing detection) has been replaced with a clean 4-level system used by both the badge and popup:

| Level | Condition | Example |
|-------|-----------|---------|
| 4 | Entry URI is contained in page URL | `a.com/admin` ∈ `a.com/admin/login` |
| 3 | Exact origin match | `https://a.com` = `https://a.com` |
| 2 | Same domain (last 2 parts) | `a.example.com` ≈ `b.example.com` |
| 1 | Regex match (`regex:` prefix) | custom pattern |

### 🧾 Regex URL Matching

Put `regex:` in the URL field to use regular expressions:
- `regex:login\..*\.com` matches all `login.*.com` subdomains
- `regex:10\.0\.\d+\.\d+` matches all `10.0.x.x` IPs

### 🪟 Iframe Autofill

Cross-origin login forms (Aliyun, banks, etc.) now work correctly. Each frame receives autofill with its own origin.

### 🛡️ Manifest V3 Compatibility

- `window.crypto` → `globalThis.crypto` (service worker fix)
- `optional_host_permissions` → `host_permissions` (CORS fix)
- `webNavigation` and `tabs` permissions added

### 🗄️ Permanent Password Storage

"Remember forever" uses `storage.local` instead of `storage.session`, surviving browser restarts. Ttime-based durations still use session storage.

### 🧪 CI/CD

GitHub Actions auto-builds the extension on every push.

---

## Quick Start

Load `dist/` folder in `chrome://extensions` (Developer mode).

---

## Credits

- Original: [subdavis/Tusk](https://github.com/subdavis/Tusk)
- Fork maintained by [helloworldbugs](https://github.com/helloworldbugs)
