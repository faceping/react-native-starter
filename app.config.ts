import type { ConfigContext, ExpoConfig } from 'expo/config';

// Expo reads app.json first, then this file. With a device token in .env.local the app becomes a check-in device:
// it gets ".device" on its ids and the name "FaceCheck Device", so it installs next to the sandbox app instead of
// replacing it. Run `npx expo prebuild --clean` after switching, so the native folders pick up the new ids.
export default ({ config }: ConfigContext): ExpoConfig => {
  if (!process.env.EXPO_PUBLIC_FACEPING_DEVICE_TOKEN) return config as ExpoConfig;
  return {
    ...config,
    name: `${config.name} Device`,
    ios: { ...config.ios, bundleIdentifier: `${config.ios?.bundleIdentifier}.device` },
    android: { ...config.android, package: `${config.android?.package}.device` },
  } as ExpoConfig;
};
