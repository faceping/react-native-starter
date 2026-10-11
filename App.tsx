import {
  FaceCamera,
  FacePing,
  isFacePingError,
  type EnrollOutcome,
  type FaceCameraRef,
  type SyncResult,
  type VerifyOutcome,
} from '@faceping/react-native';
import NetInfo from '@react-native-community/netinfo';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

// Your sandbox key: app.faceping.ai, Developers, Sandbox keys, Create sandbox key. Put it in .env.local as
// EXPO_PUBLIC_FACEPING_SANDBOX_KEY=fp_test_... (see .env.example), or replace the placeholder here.
const SANDBOX_KEY = process.env.EXPO_PUBLIC_FACEPING_SANDBOX_KEY || 'fp_test_…';

// To run as a check-in device for your practice list instead, set EXPO_PUBLIC_FACEPING_DEVICE_TOKEN=fpd_... (from the
// list's Devices tab) and EXPO_PUBLIC_FACEPING_PERSON_ID to the person you enrolled on the list. A token wins over the key.
const DEVICE_TOKEN = process.env.EXPO_PUBLIC_FACEPING_DEVICE_TOKEN || '';
const DEVICE_MODE = DEVICE_TOKEN.length > 0;

// Who this app verifies: "me" in the sandbox; on a check-in device, the personId you enrolled on the list.
const ID = process.env.EXPO_PUBLIC_FACEPING_PERSON_ID || 'me';

type Tone = 'ink' | 'green' | 'red';

/**
 * The same screen as the other FaceCheck starters: enrol your face, then verify it live, with or without a network. As a
 * check-in device, it gets its people from your practice list instead, and only verifies.
 */
export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />
      <FaceCheck />
    </SafeAreaProvider>
  );
}

function FaceCheck() {
  const camera = useRef<FaceCameraRef>(null);
  const [title, setTitle] = useState('Look at the camera');
  const [note, setNote] = useState(DEVICE_MODE ? 'Syncing the list…' : 'Tap Enrol my face to start.');
  const [tone, setTone] = useState<Tone>('ink');
  const [enrolled, setEnrolled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [canEnroll, setCanEnroll] = useState(true);
  const [offline, setOffline] = useState(false);
  const offlineRef = useRef(false);

  const show = useCallback((t: string, n: string, c: Tone) => {
    setTitle(t);
    setNote(n);
    setTone(c);
  }, []);

  // Whether the phone has a network (the checks never need one).
  useEffect(
    () =>
      NetInfo.addEventListener((state) => {
        const off = state.isConnected === false || state.isInternetReachable === false;
        offlineRef.current = off;
        setOffline(off);
      }),
    []
  );

  // Turn FacePing on, then sync: activates the sandbox key on the first run, and a face enrolled earlier may still be
  // on the phone (sandbox faces are deleted 24 hours after enrolment). On a check-in device, sync downloads the list.
  useEffect(() => {
    (async () => {
      try {
        await FacePing.init(DEVICE_MODE ? { deviceToken: DEVICE_TOKEN } : { sandboxKey: SANDBOX_KEY });
      } catch (error) {
        show(DEVICE_MODE ? 'Device token problem' : 'Sandbox key problem', messageOf(error), 'red');
        setCanEnroll(false);
        return;
      }
      try {
        const sync = await FacePing.sync();
        const here = (await FacePing.enrolledIds().catch((): string[] => [])).includes(ID);
        setEnrolled(here);
        if (DEVICE_MODE) showSync(sync, here, show);
      } catch (error) {
        showError(error, show);
      }
    })();
  }, [show]);

  const run = useCallback(
    async (action: () => Promise<void>) => {
      if (busy) return;
      setBusy(true);
      try {
        await action();
      } catch (error) {
        await camera.current?.setGuideState('ready');
        showError(error, show);
      } finally {
        setBusy(false);
        setEnrolled((await FacePing.enrolledIds().catch((): string[] => [])).includes(ID));
      }
    },
    [busy, show]
  );

  const onEnroll = () =>
    run(async () => {
      show('Hold still', 'Taking the photo…', 'ink');
      await camera.current?.setGuideState('working');
      // Takes a still from the camera and stores the face on the phone.
      const result = await FacePing.enroll(ID, camera);
      await camera.current?.setGuideState('ready');
      if (result.isEnrolled) {
        setEnrolled(true);
        show('Enrolled', offlineRef.current ? 'No network. Tap Verify.' : 'Now tap Verify.', 'ink');
      } else {
        show('Try again', describe(result.outcome), 'red');
      }
    });

  const onVerify = () =>
    run(async () => {
      show('Turn your head', 'Liveness check…', 'ink');
      // A live check: matches your face, asks you to turn your head (liveness), then matches again.
      const result = await FacePing.verifyLive(ID, camera);
      const time = `${(result.elapsedMs / 1000).toFixed(2)} s`;
      if (result.isMatch) {
        show(
          'Match',
          `Live face · ${time} · ${offlineRef.current ? 'no network used' : 'on the phone'}`,
          'green'
        );
      } else {
        show(titleFor(result.outcome), 'Tap Verify to try again.', 'red');
      }
    });

  const enrollDisabled = busy || !canEnroll || DEVICE_MODE;
  const verifyDisabled = busy || !enrolled;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.bar}>
        <Text style={styles.appName}>FaceCheck</Text>
        <Text
          style={[styles.pill, offline ? styles.pillOffline : null]}
          accessibilityLabel={offline ? 'No network' : 'Network available'}>
          {offline ? 'Offline' : 'Online'}
        </Text>
      </View>

      <View style={styles.cameraCard}>
        <FaceCamera
          ref={camera}
          style={StyleSheet.absoluteFill}
          onCameraFailed={({ message }) => show('Camera unavailable', message, 'ink')}
        />
        <View style={styles.resultCard} accessible accessibilityLiveRegion="polite">
          <Text style={[styles.resultTitle, { color: toneColors[tone] }]}>{title}</Text>
          <Text style={styles.resultNote}>{note}</Text>
        </View>
      </View>

      {/* A check-in device gets its people from the server: no enrolling here. */}
      {!DEVICE_MODE && (
        <Pressable
          onPress={onEnroll}
          disabled={enrollDisabled}
          style={[styles.button, styles.buttonOutline, enrollDisabled && styles.faded]}
          accessibilityRole="button">
          <Text style={styles.buttonOutlineText}>{enrolled ? 'Enrol again' : 'Enrol my face'}</Text>
        </Pressable>
      )}
      <Pressable
        onPress={onVerify}
        disabled={verifyDisabled}
        style={[styles.button, styles.buttonPrimary, verifyDisabled && styles.faded]}
        accessibilityRole="button">
        <Text style={styles.buttonPrimaryText}>Verify</Text>
      </Pressable>
    </SafeAreaView>
  );
}

/** On a check-in device: say what the sync found. */
function showSync(sync: SyncResult, here: boolean, show: (t: string, n: string, c: Tone) => void) {
  switch (sync.status) {
    case 'revoked':
      show('Device token not valid', 'It was revoked or mistyped, or its list was deleted. Add the device again and use the new token.', 'red');
      break;
    case 'gone':
      show('List finished', "This list's faces have been deleted, so there's no one to check.", 'ink');
      break;
    case 'unavailable':
      show("Couldn't sync", 'No connection to FacePing. The people synced before still work until the lease runs out.', 'ink');
      break;
    default:
      show(
        `${sync.enrolled} people synced`,
        here ? `${ID} is here: tap Verify.` : `${ID} isn't on this list yet. Enrol them on your server, then reopen the app.`,
        'ink'
      );
  }
}

function showError(error: unknown, show: (t: string, n: string, c: Tone) => void) {
  if (isFacePingError(error, 'setup')) {
    // The sandbox key is missing or revoked, or the very first run had no connection.
    show(DEVICE_MODE ? 'Device token problem' : 'Sandbox key problem', error.message, 'red');
  } else if (isFacePingError(error, 'model')) {
    // The face models couldn't load on this phone: send people to your normal way in.
    show('Face check unavailable', error.message, 'red');
  } else {
    // For example the camera didn't deliver a picture.
    show('Try again', messageOf(error), 'red');
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function titleFor(outcome: VerifyOutcome): string {
  switch (outcome) {
    case 'noMatch':
      return 'Not a match';
    case 'notEnrolled':
      return 'Not enrolled';
    case 'noFace':
      return 'No face seen';
    case 'livenessFailed':
      return 'Not a live face';
    case 'challengeFailed':
      return 'Head turn not seen';
    case 'expired':
      return 'Enrolment expired';
    case 'leaseExpired':
      return 'Sync needed';
    case 'match':
      return 'Match';
    default:
      return 'Try again';
  }
}

function describe(outcome: EnrollOutcome): string {
  switch (outcome) {
    case 'noFace':
      return 'No face seen. Look at the camera.';
    case 'multipleFaces':
      return 'More than one face. Just you, please.';
    case 'faceTooSmall':
      return 'Move a little closer.';
    case 'notLive':
      return 'That looked like a photo or a screen.';
    case 'limitReached':
      return 'The sandbox is full on this phone.';
    case 'enrolled':
      return 'Enrolled.';
    default:
      return 'Tap Enrol my face to try again.';
  }
}

const colors = {
  white: '#FFFFFF',
  ink: '#0F172A',
  slate: '#475569',
  green: '#047857',
  red: '#B91C1C',
  amber: '#B45309',
  pill: '#EAECF0',
  pillOffline: '#FFF4E5',
  brand: '#2563EB',
  outline: '#CBD5E1',
  cameraBackground: '#0B1220',
};

const toneColors: Record<Tone, string> = {
  ink: colors.ink,
  green: colors.green,
  red: colors.red,
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.white,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 12,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 2,
    paddingTop: 6,
  },
  appName: { flex: 1, fontSize: 22, fontWeight: '700', color: colors.ink },
  pill: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.slate,
    backgroundColor: colors.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
  pillOffline: { color: colors.amber, backgroundColor: colors.pillOffline },
  cameraCard: {
    flex: 1,
    marginVertical: 12,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: colors.cameraBackground,
    justifyContent: 'flex-end',
  },
  resultCard: {
    margin: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.96)',
  },
  resultTitle: { fontSize: 17, fontWeight: '700' },
  resultNote: { marginTop: 2, fontSize: 14, color: colors.slate },
  button: {
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonOutline: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.outline },
  buttonOutlineText: { fontSize: 16, fontWeight: '700', color: colors.ink },
  buttonPrimary: { marginTop: 10, backgroundColor: colors.brand },
  buttonPrimaryText: { fontSize: 16, fontWeight: '700', color: colors.white },
  faded: { opacity: 0.45 },
});
