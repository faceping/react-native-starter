import {
  FaceCamera,
  FacePing,
  isFacePingError,
  type EnrolOutcome,
  type FaceCameraRef,
  type VerifyOutcome,
} from '@faceping/react-native';
import NetInfo from '@react-native-community/netinfo';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

// Your sandbox key: app.faceping.ai, Developers, Sandbox keys, Create sandbox key. Put it in .env.local as
// EXPO_PUBLIC_FACEPING_SANDBOX_KEY=fp_test_... (see .env.example), or replace the placeholder here.
const SANDBOX_KEY = process.env.EXPO_PUBLIC_FACEPING_SANDBOX_KEY || 'fp_test_…';

const ID = 'me';

type Tone = 'ink' | 'green' | 'red';

/** The same screen as the MAUI, Android and iOS FaceCheck: enrol your face, then verify it live, with or without a network. */
export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor={colours.white} />
      <FaceCheck />
    </SafeAreaProvider>
  );
}

function FaceCheck() {
  const camera = useRef<FaceCameraRef>(null);
  const [title, setTitle] = useState('Look at the camera');
  const [note, setNote] = useState('Tap Enrol my face to start.');
  const [tone, setTone] = useState<Tone>('ink');
  const [enrolled, setEnrolled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [canEnrol, setCanEnrol] = useState(true);
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
  // on the phone (sandbox faces are deleted 24 hours after enrolment).
  useEffect(() => {
    (async () => {
      try {
        await FacePing.init({ sandboxKey: SANDBOX_KEY });
      } catch (error) {
        show('Sandbox key problem', messageOf(error), 'red');
        setCanEnrol(false);
        return;
      }
      try {
        await FacePing.sync();
      } catch (error) {
        showError(error, show);
      }
      setEnrolled((await FacePing.enrolledIds().catch((): string[] => [])).includes(ID));
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

  const onEnrol = () =>
    run(async () => {
      show('Hold still', 'Taking the photo…', 'ink');
      await camera.current?.setGuideState('working');
      // Takes a still from the camera and enrols it on the phone.
      const result = await FacePing.enrol(ID, camera);
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

  const enrolDisabled = busy || !canEnrol;
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
          <Text style={[styles.resultTitle, { color: toneColours[tone] }]}>{title}</Text>
          <Text style={styles.resultNote}>{note}</Text>
        </View>
      </View>

      <Pressable
        onPress={onEnrol}
        disabled={enrolDisabled}
        style={[styles.button, styles.buttonOutline, enrolDisabled && styles.faded]}
        accessibilityRole="button">
        <Text style={styles.buttonOutlineText}>{enrolled ? 'Enrol again' : 'Enrol my face'}</Text>
      </Pressable>
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

function showError(error: unknown, show: (t: string, n: string, c: Tone) => void) {
  if (isFacePingError(error, 'setup')) {
    // The sandbox key is missing or revoked, or the very first run had no connection.
    show('Sandbox key problem', error.message, 'red');
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

function describe(outcome: EnrolOutcome): string {
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

const colours = {
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

const toneColours: Record<Tone, string> = {
  ink: colours.ink,
  green: colours.green,
  red: colours.red,
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colours.white,
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
  appName: { flex: 1, fontSize: 22, fontWeight: '700', color: colours.ink },
  pill: {
    fontSize: 13,
    fontWeight: '700',
    color: colours.slate,
    backgroundColor: colours.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
  pillOffline: { color: colours.amber, backgroundColor: colours.pillOffline },
  cameraCard: {
    flex: 1,
    marginVertical: 12,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: colours.cameraBackground,
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
  resultNote: { marginTop: 2, fontSize: 14, color: colours.slate },
  button: {
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonOutline: { backgroundColor: colours.white, borderWidth: 1, borderColor: colours.outline },
  buttonOutlineText: { fontSize: 16, fontWeight: '700', color: colours.ink },
  buttonPrimary: { marginTop: 10, backgroundColor: colours.brand },
  buttonPrimaryText: { fontSize: 16, fontWeight: '700', color: colours.white },
  faded: { opacity: 0.45 },
});
