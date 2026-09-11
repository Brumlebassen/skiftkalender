import { Platform, Alert } from "react-native";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { format, addDays, isPast } from "date-fns";
import { nb } from "date-fns/locale";
import { getEffectiveShiftForDate } from "./shiftCalculator";

export const SHIFT_ALARM_CONFIG_KEY = "@shiftAlarmConfig";
export const ALARM_CHANNEL_ID = "shift-alarms";

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

// Konfigurer at varsler alltid visest og lagar lyd sjølv om appen er open
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Opprett Android-varslingskanal med høg prioritet og alarm-lyd
 */
export const setupNotificationChannel = async () => {
  if (Platform.OS === "android") {
    try {
      await Notifications.setNotificationChannelAsync(ALARM_CHANNEL_ID, {
        name: "Skiftalarm",
        description: "Automatiske alarmar og vekking tilpassa turnus",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 600, 300, 600, 300, 600],
        sound: "default",
        enableVibrate: true,
        showBadge: true,
        audioAttributes: {
          usage: Notifications.AndroidAudioUsage.ALARM,
          contentType: Notifications.AndroidAudioContentType.SONIFICATION,
        },
      });
    } catch (err) {
      console.warn("Kunne ikkje opprette notification channel:", err);
    }
  }
};

/**
 * Ber om varslingsløyve frå brukaren
 */
export const requestNotificationPermissions = async () => {
  if (Platform.OS === "web") return false;

  try {
    await setupNotificationChannel();
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync({
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
  if (Platform.OS === "web") return [];

  try {
    // 1. Avbryt tidlegare planlagde varsler
    await Notifications.cancelAllScheduledNotificationsAsync();

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
          const id = await Notifications.scheduleNotificationAsync({
            content: {
              title: `⏰ Vekkeklokke (${item.shift})`,
              body: `Tid for å stå opp! Vakta di (${item.shift}) er registrert i dag.`,
              sound: "default",
              priority: Notifications.AndroidNotificationPriority.MAX,
              vibrate: [0, 600, 300, 600, 300, 600],
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
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
  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) {
    Alert.alert(
      "Treng varslingstilgang",
      "Gje appen tilgang til å sende varsler i innstillingane på telefonen for å bruke vekkeklokke."
    );
    return false;
  }

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "⏰ Test-vekkeklokke: Skiftkalender",
        body: "Dette er slik skiftalarmen din høyrest ut!",
        sound: "default",
        priority: Notifications.AndroidNotificationPriority.MAX,
        vibrate: [0, 600, 300, 600],
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
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
