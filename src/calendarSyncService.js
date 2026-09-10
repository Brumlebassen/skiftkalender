import { Platform, Share } from "react-native";
import * as Calendar from "expo-calendar/legacy";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import {
  format,
  addDays,
  isSameMonth,
  startOfMonth,
  endOfMonth,
  getISOWeek,
  parseISO,
} from "date-fns";
import { nb } from "date-fns/locale";

const CALENDAR_NAME = "Skiftkalender";
const CALENDAR_COLOR = "#0284c7";

/**
 * Ber om kalendertilgang
 */
export const requestCalendarPermissions = async () => {
  if (Platform.OS === "web") {
    throw new Error(
      "Direkte kalendersynkronisering er berre støtta på mobil (Android/iOS). Bruk «Send kalenderfil (.ics)» for web."
    );
  }

  try {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    return status === "granted";
  } catch (err) {
    if (err.message?.includes("UnavailabilityError") || err.code === "ERR_UNAVAILABLE") {
      throw new Error(
        "Kalendermodulen krev ein ny app-versjon (APK). Lag ein ny preview build for å teste på telefonen."
      );
    }
    throw err;
  }
};

/**
 * Finn standard kalender-kilde (viktig for iOS)
 */
const getDefaultCalendarSource = async () => {
  const defaultCalendar = await Calendar.getDefaultCalendarAsync();
  return defaultCalendar.source;
};

/**
 * Henter liste over alle skrivbare kalendere på telefonen
 */
export const getAvailableCalendars = async () => {
  try {
    const hasPermission = await requestCalendarPermissions();
    if (!hasPermission) return [];
    const calendars = (await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT)) || [];
    return calendars.filter((c) => c.allowsModifications);
  } catch (err) {
    console.warn("Kunne ikkje hente kalendrar:", err);
    return [];
  }
};

/**
 * Henter eller oppretter en egen dedikert kalender på telefonen,
 * eller bruker en spesifisert kalender-ID
 */
export const getOrCreateShiftCalendar = async (selectedCalendarId = null) => {
  const calendars = (await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT)) || [];

  // Hvis brukeren har valgt en spesifikk eksisterende kalender
  if (selectedCalendarId) {
    const chosen = calendars.find((c) => c.id === selectedCalendarId);
    if (chosen) {
      return {
        id: chosen.id,
        title: chosen.title || chosen.name || "Valgt kalender",
        isDedicated: chosen.title === CALENDAR_NAME || chosen.name === CALENDAR_NAME,
      };
    }
  }

  const existing = calendars.find(
    (c) => c.title === CALENDAR_NAME || c.name === CALENDAR_NAME
  );

  if (existing) {
    return {
      id: existing.id,
      title: existing.title || CALENDAR_NAME,
      isDedicated: true,
    };
  }

  // Prøv å opprette «Skiftkalender»
  try {
    let newCalendarDetails = {
      title: CALENDAR_NAME,
      color: CALENDAR_COLOR,
      entityType: Calendar.EntityTypes.EVENT,
      name: CALENDAR_NAME,
      accessLevel: Calendar.CalendarAccessLevel.OWNER,
      ownerAccount: "personal",
      isVisible: true,
      isSynced: true,
      allowsModifications: true,
    };

    if (Platform.OS === "ios") {
      let source;
      try {
        const defaultSource = await getDefaultCalendarSource();
        source = defaultSource;
      } catch {
        const firstWithSource = calendars.find((c) => c.source);
        source = firstWithSource?.source || { isLocalAccount: true, name: "Default", type: "local" };
      }
      newCalendarDetails.sourceId = source.id;
      newCalendarDetails.source = source;
    } else {
      // Android: Sørg for at isVisible og isSynced er påslått
      newCalendarDetails.timeZone = "Europe/Oslo";
      newCalendarDetails.isVisible = true;
      newCalendarDetails.isSynced = true;
      newCalendarDetails.allowsModifications = true;

      const existingCalWithSource = calendars.find((c) => c.source && c.source.name);
      if (existingCalWithSource && existingCalWithSource.source) {
        newCalendarDetails.source = {
          isLocalAccount: true,
          name: existingCalWithSource.source.name,
          type: existingCalWithSource.source.type || "LOCAL",
        };
        newCalendarDetails.ownerAccount =
          existingCalWithSource.ownerAccount || existingCalWithSource.source.name;
      } else {
        newCalendarDetails.source = {
          isLocalAccount: true,
          name: CALENDAR_NAME,
          type: "LOCAL",
        };
        newCalendarDetails.ownerAccount = CALENDAR_NAME;
      }
    }

    const newId = await Calendar.createCalendarAsync(newCalendarDetails);
    return {
      id: newId,
      title: CALENDAR_NAME,
      isDedicated: true,
    };
  } catch (err) {
    console.warn(
      "Kunne ikkje opprette dedikert kalender, brukar eksisterande skrivbar kalender:",
      err
    );
    // Fallback: Bruk ein eksisterande kalender der brukaren har skrivetilgang
    const freshCalendars = (await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT)) || calendars;
    const writableCal =
      freshCalendars.find((c) => c.allowsModifications && c.isPrimary) ||
      freshCalendars.find((c) => c.allowsModifications) ||
      freshCalendars[0];

    if (writableCal) {
      return {
        id: writableCal.id,
        title: writableCal.title || writableCal.name || "Hovudkalender",
        isDedicated: false,
      };
    }
    throw new Error(
      "Fann ingen skrivbar kalender på telefonen. Sjekk at Google Kalender eller Kalender-appen er installert og aktiv."
    );
  }
};

/**
 * Sletter «Skiftkalender» fra telefonen dersom brukeren vil rydde opp
 */
export const deleteShiftCalendar = async () => {
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const existing = calendars.find(
    (c) => c.title === CALENDAR_NAME || c.name === CALENDAR_NAME
  );
  if (existing) {
    await Calendar.deleteCalendarAsync(existing.id);
    return true;
  }
  return false;
};

/**
 * Beregner start- og slutt-tidspunkt for en vakt basert på dato og arbeidstid
 */
export const parseShiftTimesToDates = (dateObj, timeStr) => {
  if (!timeStr || timeStr.toLowerCase().includes("fri")) {
    return null; // Heldagsevent
  }

  // timeStr er f.eks. "07:00 - 15:00" eller "23:00 - 07:00"
  const parts = timeStr.split("-").map((p) => p.trim());
  if (parts.length !== 2) return null;

  const [startClock, endClock] = parts;
  const [startH, startM] = startClock.split(":").map(Number);
  const [endH, endM] = endClock.split(":").map(Number);

  if (isNaN(startH) || isNaN(startM) || isNaN(endH) || isNaN(endM)) return null;

  const startDate = new Date(dateObj);
  startDate.setHours(startH, startM, 0, 0);

  let endDate = new Date(dateObj);
  endDate.setHours(endH, endM, 0, 0);

  // Hvis sluttid er lavere eller lik starttid, går vakten over midnatt (f.eks. 23:00 - 07:00)
  if (endH < startH || (endH === startH && endM <= startM)) {
    endDate = addDays(endDate, 1);
  }

  return { startDate, endDate };
};

/**
 * Synkroniserer skift til telefonens kalender
 */
export const syncShiftsToDevice = async ({
  startDate,
  endDate,
  shiftGroup,
  getShiftForDate,
  overrides,
  comments,
  shiftTimes,
  includeFridager = false,
  targetCalendarId = null,
}) => {
  const hasPermission = await requestCalendarPermissions();
  if (!hasPermission) {
    throw new Error("Manglar kalendertilgang. Gje tilgang i innstillingar.");
  }

  const targetCal = await getOrCreateShiftCalendar(targetCalendarId);
  const calendarId = targetCal.id;

  // 1. Slett eksisterende hendelser i tidsrommet for å unngå duplikater
  try {
    const existingEvents = await Calendar.getEventsAsync(
      [calendarId],
      startDate,
      endDate
    );
    for (const ev of existingEvents) {
      await Calendar.deleteEventAsync(ev.id);
    }
  } catch (err) {
    console.warn("Kunne ikke slette eksisterende hendelser:", err);
  }

  // 2. Opprett nye hendelser
  let count = 0;
  let cur = new Date(startDate);
  const end = new Date(endDate);

  while (cur <= end) {
    const dateStr = format(cur, "yyyy-MM-dd");
    const dateKey = `${shiftGroup}-${dateStr}`;

    const rawShift = getShiftForDate(cur, shiftGroup);
    const override = overrides?.[dateKey];

    const isFerie = Boolean(override?.isFerie);
    const bytte = override?.bytteShift || (override?.shift && !override?.isOvertid ? override.shift : null);
    const overtid = override?.overtidShift || (override?.isOvertid ? (override.shift || rawShift) : null);
    const comment = comments?.[dateKey] || "";

    // Bestem aktiv vakt
    let activeShift = rawShift;
    let title = `${rawShift}`;
    let isAllDay = false;

    if (isFerie) {
      activeShift = "Ferie";
      title = "🏖️ Ferie";
      isAllDay = true;
    } else if (bytte) {
      activeShift = bytte;
      title = `🔄 ${bytte} (Vaktbytte)`;
    }

    if (overtid && !isFerie) {
      if (rawShift === "Fri" && !bytte) {
        activeShift = overtid;
        title = `⚡ ${overtid} (Overtid)`;
      } else {
        title += ` + ⚡ ${overtid} (Overtid)`;
      }
    }

    // Sjekk om dette er en fridag
    const isFri = activeShift === "Fri";

    if (isFri && !includeFridager) {
      // Hopp over vanlige fridager hvis ikke ønsket
      cur = addDays(cur, 1);
      continue;
    }

    // Tider
    let eventStart = new Date(cur);
    let eventEnd = new Date(cur);

    if (isFri || isFerie) {
      isAllDay = true;
      eventStart.setHours(0, 0, 0, 0);
      eventEnd.setHours(23, 59, 59, 999);
    } else {
      const timeConfig = shiftTimes?.[activeShift];
      const parsed = parseShiftTimesToDates(cur, timeConfig);
      if (parsed) {
        eventStart = parsed.startDate;
        eventEnd = parsed.endDate;
      } else {
        isAllDay = true;
      }
    }

    // Notater / beskrivelse
    let notes = `Skift ${shiftGroup}`;
    if (rawShift !== activeShift && !isFerie) {
      notes += `\nOpphavleg turnusvakt: ${rawShift}`;
    }
    if (comment) {
      notes += `\nNotat: ${comment}`;
    }

    try {
      const eventDetails = {
        title,
        startDate: eventStart,
        endDate: eventEnd,
        allDay: isAllDay,
        notes,
      };

      if (!isAllDay) {
        eventDetails.timeZone = "Europe/Oslo";
      }

      await Calendar.createEventAsync(calendarId, eventDetails);
      count++;
    } catch (eventErr) {
      console.warn(`Kunne ikkje opprette hending for ${dateStr}:`, eventErr);
    }

    cur = addDays(cur, 1);
  }

  return {
    count,
    calendarTitle: targetCal.title,
    isDedicated: targetCal.isDedicated,
  };
};

/**
 * Genererer en standard .ics (iCalendar) fil og åpner deledialog
 */
export const shareAsIcsFile = async ({
  startDate,
  endDate,
  shiftGroup,
  getShiftForDate,
  overrides,
  comments,
  shiftTimes,
}) => {
  let icsContent = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Skiftkalender//NO",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:Skiftkalender Gruppe ${shiftGroup}`,
  ];

  let cur = new Date(startDate);
  const end = new Date(endDate);

  const formatIcsDate = (d) => format(d, "yyyyMMdd'T'HHmmss");
  const formatIcsDayOnly = (d) => format(d, "yyyyMMdd");

  while (cur <= end) {
    const dateStr = format(cur, "yyyy-MM-dd");
    const dateKey = `${shiftGroup}-${dateStr}`;

    const rawShift = getShiftForDate(cur, shiftGroup);
    const override = overrides?.[dateKey];

    const isFerie = Boolean(override?.isFerie);
    const bytte = override?.bytteShift || (override?.shift && !override?.isOvertid ? override.shift : null);
    const overtid = override?.overtidShift || (override?.isOvertid ? (override.shift || rawShift) : null);
    const comment = comments?.[dateKey] || "";

    let activeShift = rawShift;
    let title = `${rawShift}`;
    let isAllDay = false;

    if (isFerie) {
      activeShift = "Ferie";
      title = "Ferie";
      isAllDay = true;
    } else if (bytte) {
      activeShift = bytte;
      title = `${bytte} (Vaktbytte)`;
    }

    if (overtid && !isFerie) {
      if (rawShift === "Fri" && !bytte) {
        activeShift = overtid;
        title = `${overtid} (Overtid)`;
      } else {
        title += ` + ${overtid} (Overtid)`;
      }
    }

    if (activeShift !== "Fri") {
      icsContent.push("BEGIN:VEVENT");
      icsContent.push(`UID:${dateKey}-${Date.now()}@skiftkalender.app`);
      icsContent.push(`SUMMARY:${title}`);

      if (isAllDay) {
        icsContent.push(`DTSTART;VALUE=DATE:${formatIcsDayOnly(cur)}`);
        icsContent.push(`DTEND;VALUE=DATE:${formatIcsDayOnly(addDays(cur, 1))}`);
      } else {
        const timeConfig = shiftTimes?.[activeShift];
        const parsed = parseShiftTimesToDates(cur, timeConfig);
        if (parsed) {
          icsContent.push(`DTSTART:${formatIcsDate(parsed.startDate)}`);
          icsContent.push(`DTEND:${formatIcsDate(parsed.endDate)}`);
        } else {
          icsContent.push(`DTSTART;VALUE=DATE:${formatIcsDayOnly(cur)}`);
          icsContent.push(`DTEND;VALUE=DATE:${formatIcsDayOnly(addDays(cur, 1))}`);
        }
      }

      let desc = `Skiftgruppe ${shiftGroup}`;
      if (comment) desc += ` - ${comment}`;
      icsContent.push(`DESCRIPTION:${desc}`);
      icsContent.push("END:VEVENT");
    }

    cur = addDays(cur, 1);
  }

  icsContent.push("END:VCALENDAR");

  const fullIcsString = icsContent.join("\r\n");
  const filePath = `${FileSystem.cacheDirectory}skiftkalender.ics`;

  await FileSystem.writeAsStringAsync(filePath, fullIcsString, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(filePath, {
      mimeType: "text/calendar",
      dialogTitle: "Del skiftkalender (.ics)",
      UTI: "com.apple.ical.ics",
    });
    return true;
  } else {
    throw new Error("Deling er ikkje tilgjengeleg på denne eininga.");
  }
};

/**
 * Deler en ryddig tekstoppsummering for måneden (f.eks. på SMS/WhatsApp)
 */
export const shareMonthAsText = async ({
  currentMonth,
  shiftGroup,
  getShiftForDate,
  overrides,
  comments,
}) => {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const monthTitle = format(currentMonth, "MMMM yyyy", { locale: nb });

  let lines = [
    `📅 Skiftplan for ${monthTitle.toUpperCase()} (Skift ${shiftGroup})`,
    "---------------------------------",
  ];

  let cur = monthStart;
  let currentWeekNum = null;
  let weekDaysText = [];

  while (cur <= monthEnd) {
    const weekNum = getISOWeek(cur);
    const dateStr = format(cur, "yyyy-MM-dd");
    const dateKey = `${shiftGroup}-${dateStr}`;

    const rawShift = getShiftForDate(cur, shiftGroup);
    const override = overrides?.[dateKey];

    let shift = rawShift;
    if (override?.isFerie) {
      shift = "Ferie 🏖️";
    } else if (override?.bytteShift) {
      shift = `${override.bytteShift} 🔄`;
    }

    if (override?.overtidShift) {
      shift += ` +OT(${override.overtidShift})`;
    }

    const dayShort = format(cur, "EEE d.", { locale: nb });

    if (currentWeekNum === null) {
      currentWeekNum = weekNum;
    } else if (weekNum !== currentWeekNum) {
      lines.push(`Uke ${currentWeekNum}: ${weekDaysText.join(", ")}`);
      weekDaysText = [];
      currentWeekNum = weekNum;
    }

    weekDaysText.push(`${dayShort}: ${shift}`);
    cur = addDays(cur, 1);
  }

  if (weekDaysText.length > 0) {
    lines.push(`Uke ${currentWeekNum}: ${weekDaysText.join(", ")}`);
  }

  lines.push("---------------------------------");
  lines.push("Sendt frå Skiftkalender-appen");

  const message = lines.join("\n");

  await Share.share({
    message,
    title: `Skiftplan ${monthTitle}`,
  });
};
