# FacePing React Native starter

**FaceCheck**: a small React Native (Expo) app that enrols your face and verifies it live, on the phone, with a head-turn liveness check. Switch on airplane mode and it still matches. The same app as the Android, iOS, Flutter and .NET MAUI starters.

It's the finished app from the [React Native quickstart](https://docs.faceping.ai/start/react-native/), built on [`@faceping/react-native`](https://www.npmjs.com/package/@faceping/react-native) from npm.

## Run it

You need Node 20 or later, and a phone with a cable: an Android phone (Android 7 or later, 64-bit) with USB debugging on, the Android SDK and JDK 17 (both come with [Android Studio](https://developer.android.com/studio)), or an iPhone (iOS 15.1 or later) and a Mac with Xcode 26 or later. Emulators and the simulator have no real front camera. FacePing has native code, so it runs in a development build, not in Expo Go.

1. **Get a free sandbox key** at [app.faceping.ai/signup](https://app.faceping.ai/signup) (no card, no approval). In the dashboard: **Developers → Sandbox keys → Create sandbox key**. It starts with `fp_test_`.
2. **Paste it** into a new file `.env.local` (copy `.env.example`), replacing `fp_test_…`. The file is ignored by git, so your key stays out of commits:

   ```bash
   EXPO_PUBLIC_FACEPING_SANDBOX_KEY=fp_test_yourkey
   ```

3. **Install and run it** on your phone. A debug build is fine: the FacePing core inside the SDK is already compiled for speed.

   ```bash
   npm install
   npx expo run:android --device      # or: npx expo run:ios --device
   ```

   The first run creates the native `android` and `ios` folders from `app.json` (`npx expo prebuild`); they're ignored by git. On iOS, `pod install` downloads the FacePing framework from GitHub and checks its SHA-256. For an iPhone, pick your team when Expo asks, or open `ios/FaceCheck.xcworkspace` in Xcode and set it under **Signing & Capabilities**.

4. Tap **Enrol my face**, then **Verify**, and turn your head when asked: you should see **Match**. Now switch on airplane mode and tap **Verify** again.

Before you build your own app from this, change the bundle id and package `com.example.facecheck.reactnative` in `app.json` to your own.

## What's where

| File | What it does |
|---|---|
| `.env.local` | Your sandbox key (see `.env.example`). Expo reads it when it bundles the app. |
| `App.tsx` | `FacePing.init` with your key, the `<FaceCamera>`, `enrol` and `verifyLive`, and what each result means. |
| `app.json` | The app's name and ids, and the FacePing config plugin: the camera prompt on iOS (`NSCameraUsageDescription`) and the two Android ABIs FacePing runs on. |
| `package.json` | The FacePing dependency (`@faceping/react-native` `1.0.0-preview.2`). |

## The sandbox

Free, for building and testing: up to 25 faces per device, each deleted 24 hours after it was enrolled. Faces never leave the phone. The app needs a connection the first time it runs, to activate your key; after that it works offline for 30 days.

To use FacePing with real people, go live from your [FacePing dashboard](https://app.faceping.ai). Your verify code doesn't change.

## Learn more

- [React Native quickstart](https://docs.faceping.ai/start/react-native/): this app, step by step
- [React Native SDK reference](https://docs.faceping.ai/sdk/react-native/): every method, outcome and error
- [How the SDK works](https://docs.faceping.ai/sdk/): liveness, storage, sandbox and production
- [Security](https://docs.faceping.ai/security/): the Rust core, encryption on the device
- [`@faceping/react-native` on npm](https://www.npmjs.com/package/@faceping/react-native)
- Questions: support@faceping.ai

## Licence

This starter app is MIT licensed (see [LICENSE](LICENSE)): copy any of it into your own app. The FacePing SDK it uses has its own licence, the [FacePing SDK licence](https://faceping.ai/legal/sdk-licence).
