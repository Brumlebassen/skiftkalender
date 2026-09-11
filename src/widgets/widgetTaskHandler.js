import React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { format, addDays } from "date-fns";
import { nb } from "date-fns/locale";
import { ShiftGlanceWidget } from "./ShiftGlanceWidget";
import {
  getEffectiveShiftForDate,
  SELECTED_SHIFT_KEY,
  SHIFT_OVERRIDES_KEY,
  SHIFT_TIMES_KEY,
} from "../shiftCalculator";
import { getShiftColor } from "../theme";
import { DEFAULT_SHIFT_TIMES } from "../SettingsModal";

const THEME_PREF_KEY = "@themePreference";

/**
 * Android Widget Task Handler
 * Kalles av Android når widget legges til, oppdateres eller endrer størrelse
 */
export async function widgetTaskHandler(props) {
  const { widgetAction, renderWidget } = props;

  switch (widgetAction) {
    case "WIDGET_ADDED":
    case "WIDGET_UPDATE":
    case "WIDGET_RESIZED": {
      try {
        const savedGroupStr = await AsyncStorage.getItem(SELECTED_SHIFT_KEY);
        const shiftGroup = savedGroupStr ? parseInt(savedGroupStr, 10) : 3;

        const savedOverridesStr = await AsyncStorage.getItem(SHIFT_OVERRIDES_KEY);
        const overrides = savedOverridesStr ? JSON.parse(savedOverridesStr) : {};

        const savedTimesStr = await AsyncStorage.getItem(SHIFT_TIMES_KEY);
        const shiftTimes = savedTimesStr ? JSON.parse(savedTimesStr) : DEFAULT_SHIFT_TIMES;

        const savedTheme = await AsyncStorage.getItem(THEME_PREF_KEY);
        const isDark = savedTheme === "dark";

        const today = new Date();
        const todayInfo = getEffectiveShiftForDate(today, shiftGroup, overrides);
        const todayColor = getShiftColor(todayInfo.activeShift, isDark);
        const todayDateText = format(today, "d. MMM", { locale: nb });

        let todayTime = "";
        if (todayInfo.activeShift !== "Fri" && todayInfo.activeShift !== "Ferie") {
          todayTime = shiftTimes[todayInfo.activeShift] || "";
        }

        const upcoming = [];
        for (let i = 1; i <= 3; i++) {
          const nextDate = addDays(today, i);
          const nextInfo = getEffectiveShiftForDate(nextDate, shiftGroup, overrides);
          const nextColor = getShiftColor(nextInfo.activeShift, isDark);
          const dayLabel = i === 1 ? "I morgon" : format(nextDate, "EEE d.", { locale: nb });

          upcoming.push({
            dayLabel,
            shift: nextInfo.activeShift,
            color: nextColor,
          });
        }

        renderWidget(
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
        );
      } catch (err) {
        console.warn("Feil under rendering av widget i task handler:", err);
      }
      break;
    }

    case "WIDGET_CLICK": {
      // Default er OPEN_APP som handteres automatisk
      break;
    }

    case "WIDGET_DELETED": {
      break;
    }

    default:
      break;
  }
}
