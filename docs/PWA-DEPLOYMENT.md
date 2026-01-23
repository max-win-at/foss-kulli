# PWA Deployment Guide

This guide covers deploying Foss Kulli as a Progressive Web App (PWA) and publishing it to various app stores.

## Prerequisites

1. **HTTPS Required**: PWAs require HTTPS for service worker functionality
2. **Generate PNG Icons**: Run the icon generation script to create PNG icons from SVG
3. **Web Server**: Any static file server (Nginx, Apache, GitHub Pages, Netlify, Vercel, etc.)

## Icon Generation

Before deployment, generate PNG icons from the SVG sources:

```bash
# Make the script executable
chmod +x generate-icons.sh

# Run icon generation (requires ImageMagick or Inkscape)
./generate-icons.sh
```

### Installing ImageMagick

```bash
# Ubuntu/Debian
sudo apt install imagemagick

# macOS
brew install imagemagick

# Windows (with WSL)
sudo apt install imagemagick
```

## Web Deployment

### GitHub Pages

1. Push code to GitHub repository
2. Go to Settings > Pages
3. Select branch (usually `main`) and root folder
4. Site will be available at `https://username.github.io/foss-kulli`

### Netlify

1. Connect your GitHub repository
2. Build command: (leave empty - static site)
3. Publish directory: `/`
4. Deploy!

### Vercel

1. Import your GitHub repository
2. Framework: Other
3. Deploy!

### Custom Server (Nginx)

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    root /var/www/foss-kulli;
    index index.html;

    # Service Worker scope
    location /sw.js {
        add_header Cache-Control "no-cache";
        add_header Service-Worker-Allowed "/";
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

## Android Play Store Publishing

You can publish PWAs to the Google Play Store using **TWA (Trusted Web Activity)** or **PWABuilder**.

### Option 1: PWABuilder (Recommended - Easiest)

1. Go to [PWABuilder.com](https://www.pwabuilder.com/)
2. Enter your deployed PWA URL
3. Click "Start" to analyze your PWA
4. Go to "Package For Stores" section
5. Select "Android"
6. Configure your app:
   - **Package ID**: `com.fosskulli.app` (or your preference)
   - **App Name**: Foss Kulli
   - **App Version**: 1.0.0
   - **Display Mode**: Standalone
7. Download the generated APK/AAB
8. Sign the AAB with your keystore
9. Upload to Google Play Console

### Option 2: Bubblewrap CLI

```bash
# Install Bubblewrap
npm install -g @anthropic/anthropic/bubblewrap-cli

# Initialize project
bubblewrap init --manifest https://your-domain.com/manifest.json

# Build APK
bubblewrap build

# Output: app-release-signed.apk
```

### Option 3: Android Studio TWA

1. Create new Android Studio project
2. Add TWA dependency to `build.gradle`:

```gradle
dependencies {
    implementation 'com.google.androidbrowserhelper:androidbrowserhelper:2.4.0'
}
```

3. Configure `AndroidManifest.xml`:

```xml
<activity android:name="com.google.androidbrowserhelper.trusted.LauncherActivity">
    <meta-data
        android:name="android.support.customtabs.trusted.DEFAULT_URL"
        android:value="https://your-domain.com" />
    <intent-filter>
        <action android:name="android.intent.action.MAIN" />
        <category android:name="android.intent.category.LAUNCHER" />
    </intent-filter>
</activity>
```

4. Add Digital Asset Links verification (see below)

### Digital Asset Links (Required for TWA)

Create `/.well-known/assetlinks.json` on your server:

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.fosskulli.app",
    "sha256_cert_fingerprints": [
      "YOUR_APP_SIGNING_CERTIFICATE_SHA256_FINGERPRINT"
    ]
  }
}]
```

Get your fingerprint:
```bash
keytool -list -v -keystore your-keystore.jks -alias your-alias
```

### Google Play Console Setup

1. Create developer account ($25 one-time fee)
2. Create new app in Play Console
3. Fill in app details:
   - **App name**: Foss Kulli - Sticky Notes
   - **Short description**: Quick and beautiful sticky notes app
   - **Full description**: (See below)
   - **Category**: Productivity
   - **Content rating**: Everyone
4. Upload AAB/APK file
5. Set up pricing (Free)
6. Create release in Production track
7. Submit for review

### Play Store Description Template

```
Foss Kulli - Your Personal Sticky Notes Board

📝 Quick Notes
Start typing anywhere to create beautiful sticky notes instantly. No account required, no cloud sync - your notes stay private on your device.

✨ Features
• Instant note creation - just start typing
• Paste from clipboard support
• Search through all your notes
• Beautiful sticky note design
• Works offline
• Privacy-focused - notes stay in your browser
• Free and open source

🎨 Simple & Beautiful
Clean, distraction-free interface inspired by real sticky notes. Focus on what matters - your ideas.

🔒 Privacy First
Your notes are stored locally in your browser. No accounts, no tracking, no cloud storage. Your thoughts remain yours.

📱 Works Everywhere
Install on any device - phone, tablet, or desktop. Works offline once installed.

Open source and free forever.
```

## iOS App Store Publishing

PWAs have limited App Store support, but you can use **PWABuilder** or create a WebView wrapper.

### PWABuilder for iOS

1. Go to [PWABuilder.com](https://www.pwabuilder.com/)
2. Enter your PWA URL
3. Select "iOS" in Package section
4. Download Xcode project
5. Open in Xcode
6. Configure signing with your Apple Developer account
7. Archive and submit to App Store Connect

### Requirements for iOS

- Apple Developer account ($99/year)
- Xcode on macOS
- App Store Connect access

## Microsoft Store Publishing

1. Use PWABuilder to generate MSIX package
2. Create Partner Center account
3. Submit app package

## Testing Your PWA

### Lighthouse Audit

```bash
# Using Chrome DevTools
1. Open Chrome DevTools (F12)
2. Go to Lighthouse tab
3. Select "Progressive Web App"
4. Run audit
```

### PWA Checklist

- [ ] Served over HTTPS
- [ ] Valid manifest.json
- [ ] Service worker registered
- [ ] Icons in all required sizes
- [ ] Offline functionality works
- [ ] Fast loading (< 3s)
- [ ] Responsive design
- [ ] App installable prompt works

### Testing Install Flow

1. Open PWA in Chrome/Edge
2. Look for install icon in address bar
3. Or open DevTools > Application > Manifest
4. Click "Add to home screen" to test

## Troubleshooting

### Service Worker Not Registering

- Ensure HTTPS (except localhost)
- Check browser console for errors
- Verify sw.js is in root directory
- Clear browser cache and retry

### PWA Not Installable

- Run Lighthouse PWA audit
- Check manifest.json syntax
- Ensure all required icons exist
- Verify start_url is accessible

### Icons Not Showing

- Run generate-icons.sh script
- Check icon paths in manifest.json
- Verify PNG files exist in icons/ folder

## Version Updates

When updating the PWA:

1. Update version in manifest.json
2. Update CACHE_NAME in sw.js (e.g., `foss-kulli-v2`)
3. Deploy new files
4. Users will see update notification

---

For more help, see:
- [PWABuilder Documentation](https://docs.pwabuilder.com/)
- [Google TWA Documentation](https://developer.chrome.com/docs/android/trusted-web-activity/)
- [Web.dev PWA Guide](https://web.dev/progressive-web-apps/)
