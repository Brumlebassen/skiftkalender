import { Platform, Alert } from "react-native";
import { isRunningInExpoGo } from "expo";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { format, addDays, isPast } from "date-fns";
import { nb } from "date-fns/locale";
import { getEffectiveShiftForDate } from "./shiftCalculator";

export const SHIFT_ALARM_CONFIG_KEY = "@shiftAlarmConfig";
export const ALARM_CHANNEL_ID = "shift-alarms-v2";

export const DEFAULT_ALARM_CONFIG = {
  enabled: false,
  times: {
    Fm: { enabled: true, time: "05:30" },
    Em: { enabled: false, time: "12:30" },
    N: { enabled: true, time: "20:00" },
    "12tFm": { enabled: true, time: "05:00" },
    "12tN": { enabled: true, time: "16:30" },
    Fri: { enabled: false, time: "" },
    Ferie: { enabled: false, time: "" },
  },
  snoozeMinutes: 10,
};

/**
 * Hent expo-notifications dynamisk så me unngår krasj på oppstart
 * dersom modulen manglar i den noverande app-binæren (f.eks. i Expo Go eller eldre APK)
 */
let _notificationsModule = null;
const getNotificationsModule = () => {
  if (Platform.OS === "web") return null;

  // Frå SDK 53 støttar ikkje Expo Go varslingar på Android
  try {
    if (typeof isRunningInExpoGo === "function" && isRunningInExpoGo()) {
      return null;
    }
  } catch {}

  if (_notificationsModule) return _notificationsModule;
  try {
    _notificationsModule = require("expo-notifications");
    return _notificationsModule;
  } catch (err) {
    return null;
  }
};

/**
 * Sjekkar om Notifications-modulen er tilgjengeleg i dette bygget
 */
export const isNotificationsAvailable = () => {
  if (Platform.OS === "web") return false;
  try {
    const mod = getNotificationsModule();
    return Boolean(
      mod &&
      typeof mod.scheduleNotificationAsync === "function" &&
      typeof mod.getPermissionsAsync === "function"
    );
  } catch {
    return false;
  }
};

/**
 * Trygg registrering av notification handler
 */
let isHandlerSet = false;
export const ensureNotificationHandler = () => {
  if (isHandlerSet) return;
  try {
    const mod = getNotificationsModule();
    if (mod && typeof mod.setNotificationHandler === "function") {
      mod.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });
      isHandlerSet = true;
    }
  } catch (err) {
    console.warn("Klarte ikkje å setje notification handler:", err);
  }
};

/**
 * Opprett Android-varslingskanal med høg prioritet og alarm-lyd
 */
export const setupNotificationChannel = async () => {
  if (Platform.OS !== "android" || !isNotificationsAvailable()) return;

  try {
    ensureNotificationHandler();
    const mod = getNotificationsModule();
    if (mod?.setNotificationChannelAsync) {
      await mod.setNotificationChannelAsync(ALARM_CHANNEL_ID, {
        name: "Skiftalarm",
        description: "Automatiske alarmar og vekking tilpassa turnus",
        importance: mod?.AndroidImportance?.MAX ?? 7,
        vibrationPattern: [0, 600, 300, 600, 300, 600],
        sound: "default",
        enableVibrate: true,
        showBadge: true,
        bypassDnd: true,
        lockscreenVisibility: mod?.AndroidNotificationVisibility?.PUBLIC ?? 1,
        audioAttributes: {
          usage: mod?.AndroidAudioUsage?.ALARM ?? 4,
          contentType: mod?.AndroidAudioContentType?.SONIFICATION ?? 4,
        },
      });
    }
  } catch (err) {
    console.warn("Kunne ikkje opprette notification channel:", err);
  }
};

/**
 * Ber om varslingsløyve frå brukaren
 */
export const requestNotificationPermissions = async () => {
  if (!isNotificationsAvailable()) return false;

  try {
    await setupNotificationChannel();
    const mod = getNotificationsModule();
    if (!mod?.getPermissionsAsync) return false;

    const { status: existingStatus } = await mod.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted" && mod?.requestPermissionsAsync) {
      const { status } = await mod.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      });
      finalStatus = status;
    }

    return finalStatus === "granted";
  } catch (err) {
    console.warn("Feil ved sjekk av varslingsløyve:", err);
    return false;
  }
};

/**
 * Reknar ut alarmar for dei neste dagane basert på turnus og vaktendringar
 */
export const calculateUpcomingAlarms = ({
  shiftGroup = 1,
  overrides = {},
  alarmConfig = DEFAULT_ALARM_CONFIG,
  daysAhead = 14,
}) => {
  const list = [];
  const today = new Date();

  for (let i = 0; i < daysAhead; i++) {
    const curDate = addDays(today, i);
    const dateStr = format(curDate, "yyyy-MM-dd");
    const dayName = i === 0 ? "I dag" : i === 1 ? "I morgon" : format(curDate, "EEEE d. MMM", { locale: nb });

    const shiftInfo = getEffectiveShiftForDate(curDate, shiftGroup, overrides);
    const shift = shiftInfo.activeShift;
    const isFerie = shiftInfo.isFerie;

    const conf = alarmConfig.times?.[shift];
    const isEnabledForShift = Boolean(conf?.enabled && conf?.time);

    let alarmDateTime = null;
    let alarmActive = false;
    let timeStr = "";

    if (alarmConfig.enabled && isEnabledForShift && !isFerie && shift !== "Fri") {
      timeStr = conf.time;
      const [h, m] = timeStr.split(":").map(Number);
      if (!isNaN(h) && !isNaN(m)) {
        const d = new Date(curDate);
        d.setHours(h, m, 0, 0);
        alarmDateTime = d;
        // Berre aktiv viss tidspunktet er fram i tid
        if (!isPast(d)) {
          alarmActive = true;
        }
      }
    }

    list.push({
      index: i,
      date: curDate,
      dateStr,
      dayName: dayName.charAt(0).toUpperCase() + dayName.slice(1),
      shift,
      isFerie,
      bytte: shiftInfo.bytte,
      overtid: shiftInfo.overtid,
      alarmActive,
      alarmTime: timeStr,
      alarmDateTime,
    });
  }

  return list;
};

/**
 * Planlegg automatiske alarmar for dei neste 14 dagane
 */
export const rescheduleAllShiftAlarms = async ({
  shiftGroup,
  overrides = {},
  alarmConfig = DEFAULT_ALARM_CONFIG,
}) => {
  if (!isNotificationsAvailable()) {
    console.warn("Varslingsteneste ikkje tilgjengeleg i dette bygget.");
    return [];
  }

  try {
    ensureNotificationHandler();
    const mod = getNotificationsModule();
    if (!mod) return [];

    // 1. Avbryt tidlegare planlagde varsler
    if (mod?.cancelAllScheduledNotificationsAsync) {
      await mod.cancelAllScheduledNotificationsAsync();
    }

    // Viss hovudbrytar er slått av, stoppar me her
    if (!alarmConfig.enabled) {
      return [];
    }

    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      console.warn("Mangler varslingstillatelse for alarmar.");
      return [];
    }

    // 2. Rekn ut komande alarmar
    const upcoming = calculateUpcomingAlarms({
      shiftGroup,
      overrides,
      alarmConfig,
      daysAhead: 14,
    });

    const scheduled = [];

    // 3. Planlegg kvar aktive alarm
    for (const item of upcoming) {
      if (item.alarmActive && item.alarmDateTime && !isPast(item.alarmDateTime)) {
        try {
          const triggerType = mod?.SchedulableTriggerInputTypes?.DATE || "date";
          const priorityVal = mod?.AndroidNotificationPriority?.MAX || "max";

          const id = await mod.scheduleNotificationAsync({
            content: {
              title: `⏰ Vekkeklokke (${item.shift})`,
              body: `Tid for å stå opp! Vakta di (${item.shift}) er registrert i dag.`,
              sound: "default",
              priority: priorityVal,
              vibrate: [0, 600, 300, 600, 300, 600],
            },
            trigger: {
              type: triggerType,
              date: item.alarmDateTime,
              channelId: ALARM_CHANNEL_ID,
            },
          });

          scheduled.push({ ...item, notificationId: id });
        } catch (err) {
          console.warn(`Kunne ikkje planlegge alarm for ${item.dateStr}:`, err);
        }
      }
    }

    return scheduled;
  } catch (err) {
    console.warn("Feil under resynkronisering av skiftalarmar:", err);
    return [];
  }
};

/**
 * Test alarm med eitt (ring etter 2 sekund)
 */
export const triggerTestAlarm = async () => {
  if (!isNotificationsAvailable()) {
    let inExpoGo = false;
    try {
      inExpoGo = typeof isRunningInExpoGo === "function" && isRunningInExpoGo();
    } catch {}

    Alert.alert(
      inExpoGo ? "Expo Go støttar ikkje alarmar" : "Krev nytt app-bygg (APK)",
      inExpoGo
        ? "Frå SDK 53 fjerna Expo støtte for Android-varslingar i Expo Go. Vekkeklokke og heimeskjerm-widget krev ein eigen APK (med 'eas build')."
        : "Vekkeklokke og alarm-varsler krev eit nytt APK-bygg med varslingsstøtte. Bygg ny versjon med 'eas build'."
    );
    return false;
  }

  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) {
    Alert.alert(
      "Treng varslingstilgang",
      "Gje appen tilgang til å sende varsler i innstillingane på telefonen for å bruke vekkeklokke."
    );
    return false;
  }

  try {
    ensureNotificationHandler();
    const mod = getNotificationsModule();
    if (!mod?.scheduleNotificationAsync) return false;

    const triggerType = mod?.SchedulableTriggerInputTypes?.TIME_INTERVAL || "timeInterval";
    const priorityVal = mod?.AndroidNotificationPriority?.MAX || "max";

    await mod.scheduleNotificationAsync({
      content: {
        title: "⏰ Test-vekkeklokke: Skiftkalender",
        body: "Dette er slik skiftalarmen din høyrest ut!",
        sound: "default",
        priority: priorityVal,
        vibrate: [0, 600, 300, 600],
      },
      trigger: {
        type: triggerType,
        seconds: 2,
        channelId: ALARM_CHANNEL_ID,
      },
    });
    return true;
  } catch (err) {
    Alert.alert("Test feila", err.message || "Kunne ikkje starte testalarm.");
    return false;
  }
};

/**
 * Finn neste komande vakt som har alarm aktivert
 */
export const getNextUpcomingShiftAlarm = ({
  shiftGroup = 1,
  overrides = {},
  alarmConfig = DEFAULT_ALARM_CONFIG,
}) => {
  const upcoming = calculateUpcomingAlarms({
    shiftGroup,
    overrides,
    alarmConfig,
    daysAhead: 7,
  });

  return upcoming.find((item) => item.alarmActive && item.alarmDateTime) || null;
};

/**
 * Still alarm direkte i telefonen sin standard Klokke-app (Samsung Klokke / Google Klokke)
 */
export const setNativeClockAlarm = async ({
  hour,
  minutes,
  message = "Skiftkalender",
  skipUi = false,
}) => {
  if (Platform.OS !== "android") {
    Alert.alert(
      "Berre tilgjengeleg på Android",
      "Kopling til den innebygde Klokke-appen er førebels berre tilgjengeleg på Android-einingar."
    );
    return false;
  }

  try {
    let IntentLauncher;
    try {
      IntentLauncher = require("expo-intent-launcher");
    } catch {
      Alert.alert(
        "Krev nytt bygg",
        "Kopling til Klokke-appen krev eit oppdatert app-bygg (APK) med expo-intent-launcher."
      );
      return false;
    }

    if (!IntentLauncher?.startActivityAsync) {
      Alert.alert("Feil", "Klarte ikkje å starte Android Intent-launcher.");
      return false;
    }

    await IntentLauncher.startActivityAsync("android.intent.action.SET_ALARM", {
      extra: {
        "android.intent.extra.alarm.HOUR": Number(hour),
        "android.intent.extra.alarm.MINUTES": Number(minutes),
        "android.intent.extra.alarm.MESSAGE": message,
        "android.intent.extra.alarm.SKIP_UI": Boolean(skipUi),
      },
    });
    return true;
  } catch (err) {
    console.warn("Klarte ikkje å stille alarm i Klokke-appen:", err);
    Alert.alert(
      "Kunne ikkje stille alarm",
      "Sjekk at mobilen har ein standard Klokke-app installert (t.d. Google Klokke eller Samsung Klokke)."
    );
    return false;
  }
};

/**
 * Opne telefonen sin standard Klokke-app
 */
export const openNativeClockApp = async () => {
  if (Platform.OS !== "android") return;
  try {
    const IntentLauncher = require("expo-intent-launcher");
    if (IntentLauncher?.startActivityAsync) {
      await IntentLauncher.startActivityAsync("android.intent.action.SHOW_ALARMS");
    }
  } catch (err) {
    console.warn("Kunne ikkje opne Klokke-appen:", err);
  }
};
