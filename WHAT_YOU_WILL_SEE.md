# 👀 What You'll See - Offline Feature Visual Guide

## 🟢 ALWAYS VISIBLE: Status Indicator (Top-Right Corner)

```
┌─────────────────────────────┐
│  🟢 Online         ℹ️       │  ← Click this!
└─────────────────────────────┘
```

**When ONLINE:**
- **Green button** with WiFi icon
- Says "**Online**" in white text
- Click it to see helpful info

**When OFFLINE:**
- **Red button** with WiFi-Off icon (pulsing animation!)
- Says "**Offline**" in white text
- Click it to learn what happens

**With Queued Documents:**
- Shows number badge: `Online 3` or `Offline 5`

---

## 📖 Click the Indicator to See Help

### When You're ONLINE (Green Indicator):

```
╔════════════════════════════════════════════════════╗
║ 🟢 You're Online                                   ║
║                                                     ║
║ Documents will be processed immediately when you   ║
║ upload them.                                       ║
║                                                     ║
║ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ ║
║                                                     ║
║ Offline Mode Available: If you lose connection,   ║
║ don't worry! Documents will be saved locally and   ║
║ uploaded when you're back online.                  ║
╚════════════════════════════════════════════════════╝
```

### When You're OFFLINE (Red Indicator - Pulsing):

```
╔════════════════════════════════════════════════════╗
║ 🔴 You're Offline                                  ║
║                                                     ║
║ No internet connection detected.                   ║
║                                                     ║
║ ┌──────────────────────────────────────────────┐  ║
║ │ ✅ You can still upload documents!           │  ║
║ │                                               │  ║
║ │ What happens now:                             │  ║
║ │ • Documents are saved to your device          │  ║
║ │ • They're stored securely in local storage    │  ║
║ │ • Processing happens automatically when       │  ║
║ │   you're online                               │  ║
║ │ • No manual action needed from you            │  ║
║ └──────────────────────────────────────────────┘  ║
║                                                     ║
║ 📋 3 documents queued                              ║
║ Will sync automatically when connection is         ║
║ restored.                                          ║
║                                                     ║
║ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ ║
║                                                     ║
║ ✓ Your work is safe! Keep uploading as normal.    ║
╚════════════════════════════════════════════════════╝
```

---

## 🎬 Complete User Experience

### 1️⃣ You Start Online

```
Top-right corner:
┌─────────────────┐
│  🟢 Online   ℹ️ │
└─────────────────┘
```

Everything works normally. Upload documents → They process immediately.

---

### 2️⃣ You Go Offline (WiFi drops, airplane mode, etc.)

```
Top-right corner (PULSING!):
┌─────────────────┐
│  🔴 Offline  ℹ️ │
└─────────────────┘

Toast notification pops up:
┌──────────────────────┐
│ ⚠️ You are offline   │
└──────────────────────┘

Orange banner at top:
╔═══════════════════════════════════════════════════╗
║ 📶 You're Offline                                 ║
║ Documents will be saved and uploaded automatically║
║ when you're back online                           ║
╚═══════════════════════════════════════════════════╝
```

**You click the red indicator to learn more, it shows:**
- ✅ You can still upload!
- What happens (saved locally, will sync later)
- Reassurance your work is safe

---

### 3️⃣ You Upload Documents While Offline

```
Top-right:
┌───────────────────┐
│  🔴 Offline 3  ℹ️ │  ← Shows count!
└───────────────────┘

Queue Status Card appears:
┌──────────────────────────────────────────────────┐
│ Offline Queue          🔴 Offline    [Sync Now]  │
├──────────────────────────────────────────────────┤
│ Total: 3    Queued: 3    Failed: 0    Size: 2MB  │
├──────────────────────────────────────────────────┤
│ 📄 document.pdf      [Queued]      [Cancel]      │
│ 📄 birth_cert.jpg    [Queued]      [Cancel]      │
│ 📄 passport.pdf      [Queued]      [Cancel]      │
└──────────────────────────────────────────────────┘
```

---

### 4️⃣ You Come Back Online

```
Top-right (turns GREEN!):
┌───────────────────┐
│  🟢 Online 3   ℹ️ │  ← Still shows count while syncing
└───────────────────┘

Toast notification:
┌──────────────────────────┐
│ ✅ Connection restored!  │
└──────────────────────────┘

Blue banner (replaces orange):
╔═══════════════════════════════════════════════════╗
║ 🌐 Back Online • 📤 Syncing 3 queued documents... ║
╚═══════════════════════════════════════════════════╝

Queue card updates:
┌──────────────────────────────────────────────────┐
│ Syncing... (1 / 3)                               │
│ [████████░░░░░░░░░░░░░░] 33%                     │
├──────────────────────────────────────────────────┤
│ 📄 document.pdf      [Syncing...]               │
│ 📄 birth_cert.jpg    [Queued]                   │
│ 📄 passport.pdf      [Queued]                   │
└──────────────────────────────────────────────────┘
```

---

### 5️⃣ Sync Completes

```
Top-right (back to normal):
┌─────────────────┐
│  🟢 Online   ℹ️ │  ← Count gone (all synced!)
└─────────────────┘

Toast notification:
┌─────────────────────────────────────┐
│ ✅ All documents synced successfully│
└─────────────────────────────────────┘

Queue card disappears (no jobs left)
```

---

## 🎨 Visual States Summary

| State | Indicator | Tooltip | Banner | Queue Card |
|-------|-----------|---------|--------|------------|
| **Online, No Queue** | 🟢 Green "Online" | Explains offline mode available | Hidden | Hidden |
| **Online, Syncing** | 🟢 Green "Online 3" | Shows sync progress | Blue "Syncing..." | Shows progress bar |
| **Offline, No Queue** | 🔴 Red "Offline" (pulse) | Explains you can still upload | Orange "You're Offline" | Hidden |
| **Offline, With Queue** | 🔴 Red "Offline 5" (pulse) | Shows queued count + guidance | Orange "Offline + count" | Shows queued docs |

---

## 🔴 Failed Document Example

```
Queue Card:
┌──────────────────────────────────────────────────┐
│ 📄 corrupt_file.pdf  [Failed] [Retry] [Cancel]   │
│    Error: Invalid file format                    │
└──────────────────────────────────────────────────┘
```

- Red "Failed" badge
- Shows error message
- **Retry** button to try again
- **Cancel** button to remove

---

## 💡 User Confidence Indicators

### ✅ Users KNOW They're Online:
- Green indicator (always visible)
- Documents process immediately
- No queues or delays

### ✅ Users KNOW They're Offline:
- Red pulsing indicator (can't miss it!)
- Orange banner at top
- Helpful tooltip explains everything
- Queue shows their documents are safe

### ✅ Users KNOW Syncing is Happening:
- Blue banner "Syncing..."
- Progress bar (1 / 5)
- Real-time status changes
- Toast confirmations

### ✅ Users KNOW When Complete:
- Green indicator returns to normal
- Success toast
- Queue disappears
- Can view results

---

## 🧪 How to Test (Quick Steps)

1. **Open your extension**
2. **Look top-right** → See green "Online" button
3. **Click it** → Read the helpful tooltip
4. **Press F12** → Open DevTools
5. **Network tab** → Select "Offline"
6. **Look top-right** → Red "Offline" button pulsing!
7. **Click it** → Read what happens when offline
8. **Upload a document** → See it queue
9. **Look at queue card** → Document listed with "Queued" badge
10. **Go online** → Watch automatic sync!

---

## 🎯 Key Message to Users

```
╔════════════════════════════════════════════════╗
║                                                 ║
║   🔴 RED = Offline (but you can still work!)   ║
║                                                 ║
║   🟢 GREEN = Online (everything normal)        ║
║                                                 ║
║   Click the indicator anytime to learn more!   ║
║                                                 ║
╚════════════════════════════════════════════════╝
```

**No more guessing. No more confusion. Crystal clear status!** ✨
