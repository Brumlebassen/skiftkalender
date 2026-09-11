import React from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { format, addDays } from "date-fns";
import { nb } from "date-fns/locale";
import { requestWidgetUpdate } from "react-native-android-widget";
import { ShiftGlanceWidget } from "./ShiftGlanceWidget";
import {
  getEffectiveShiftForDate,
  SELECTED_SHIFT_KEY,
  SHIFT_OVERRIDES_KEY,
  SHIFT_TIMES_KEY,
  ACTIVE_SHIFT_PLAN_KEY,
  PRESET_SHIFT_PLANS,
} from "../shiftCalculator";
import { getShiftColor } from "../theme";
import { DEFAULT_SHIFT_TIMES } from "../SettingsModal";

const THEME_PREF_KEY = "@themePreference";

/**
 * Beregner widget-data og oppdaterer heimeskjerm-widgeten
 */
export const updateHomeScreenWidget = async () => {
  if (Platform.OS !== "android") {
    return;
  }

  try {
    // 1. Hent lagra innstillingar frå AsyncStorage
    const savedGroupStr = await AsyncStorage.getItem(SELECTED_SHIFT_KEY);
    const shiftGroup = savedGroupStr ? parseInt(savedGroupStr, 10) : 1;

    const savedOverridesStr = await AsyncStorage.getItem(SHIFT_OVERRIDES_KEY);
    const overrides = savedOverridesStr ? JSON.parse(savedOverridesStr) : {};

    const savedTimesStr = await AsyncStorage.getItem(SHIFT_TIMES_KEY);
    const shiftTimes = savedTimesStr ? JSON.parse(savedTimesStr) : DEFAULT_SHIFT_TIMES;

    const savedTheme = await AsyncStorage.getItem(THEME_PREF_KEY);
    const isDark = savedTheme === "dark";

    let activePlan = PRESET_SHIFT_PLANS[0];
    const savedPlanStr = await AsyncStorage.getItem(ACTIVE_SHIFT_PLAN_KEY);
    if (savedPlanStr) {
      try {
        activePlan = JSON.parse(savedPlanStr);
      } catch {}
    }

    // 2. Rekn ut for i dag
    const today = new Date();
    const todayInfo = getEffectiveShiftForDate(today, shiftGroup, overrides, activePlan);
    const todayColor = getShiftColor(todayInfo.activeShift, isDark);
    const todayDateText = format(today, "d. MMM", { locale: nb });

    let todayTime = "";
    if (todayInfo.activeShift !== "Fri" && todayInfo.activeShift !== "Ferie") {
      todayTime = shiftTimes[todayInfo.activeShift] || "";
    }

    // 3. Rekn ut for dei neste 3 dagane
    const upcoming = [];
    for (let i = 1; i <= 3; i++) {
      const nextDate = addDays(today, i);
      const nextInfo = getEffectiveShiftForDate(nextDate, shiftGroup, overrides, activePlan);
      const nextColor = getShiftColor(nextInfo.activeShift, isDark);
      const dayLabel = i === 1 ? "I morgon" : format(nextDate, "EEE d.", { locale: nb });

      upcoming.push({
        dayLabel,
        shift: nextInfo.activeShift,
        color: nextColor,
      });
    }

    // 4. Send oppdatering til Android AppWidget
    await requestWidgetUpdate({
      widgetName: "ShiftGlanceWidget",
      renderWidget: () => (
        <ShiftGlanceWidget
          shiftGroup={shiftGroup}
          todayDateText={todayDateText}
          todayShift={todayInfo.activeShift}
          todayTime={todayTime}
          todayBadge={todayInfo.badge}
          todayColor={todayColor}
          upcoming={upcoming}
          isDark={isDark}
        />
      ),
    });
  } catch (err) {
    // I Expo Go eller web vil ikkje native widget vere registrert, det skal ikkje krasje appen
    console.log("Widget oppdatering (kun aktiv i full Android-bygg):", err?.message || err);
  }
};
