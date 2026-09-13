import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  PanResponder,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  format,
  startOfMonth,
  startOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  differenceInCalendarDays,
  getISOWeek,
  isWithinInterval,
  parseISO,
} from "date-fns";
import { nb } from "date-fns/locale";
import { getTheme, getShiftColor } from "./theme";
import SettingsModal, { DEFAULT_SHIFT_TIMES } from "./SettingsModal";
import FerieModal from "./FerieModal";
import YearOverviewModal from "./YearOverviewModal";
import SyncShareModal from "./SyncShareModal";
import AlarmModal from "./AlarmModal";
import TurnusBuilderModal from "./TurnusBuilderModal";
import {
  getShiftForDate,
  ALL_SHIFTS,
  SHIFT_COMMENTS_KEY,
  SELECTED_SHIFT_KEY,
  SHIFT_OVERRIDES_KEY,
  SHIFT_TIMES_KEY,
  COMPARE_SHIFTS_KEY,
  ACTIVE_SHIFT_PLAN_KEY,
  CUSTOM_SHIFT_PLANS_KEY,
  CALENDAR_ZOOM_KEY,
  PRESET_SHIFT_PLANS,
  getShiftTypesForPlan,
  getGroupsForPlan,
} from "./shiftCalculator";
import { updateHomeScreenWidget } from "./widgets/widgetSyncService";
import {
  DEFAULT_ALARM_CONFIG,
  SHIFT_ALARM_CONFIG_KEY,
  rescheduleAllShiftAlarms,
  setNativeClockAlarm,
} from "./alarmService";

const Calendar = ({ isDark, toggleTheme }) => {
  const theme = getTheme(isDark);

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [shiftGroup, setShiftGroup] = useState(3);
  const [comments, setComments] = useState({});
  const [overrides, setOverrides] = useState({});
  const [shiftTimes, setShiftTimes] = useState(DEFAULT_SHIFT_TIMES);
  const [alarmConfig, setAlarmConfig] = useState(DEFAULT_ALARM_CONFIG);

  // Klype-zoom (Pinch-to-zoom) for kalenderrutenettet
  const [zoomScale, setZoomScale] = useState(1.0);
  const [isPinchingActive, setIsPinchingActive] = useState(false);
  const zoomScaleRef = useRef(1.0);
  const initialPinchDistance = useRef(null);
  const initialZoomScale = useRef(1.0);
  const isPinching = useRef(false);

  useEffect(() => {
    zoomScaleRef.current = zoomScale;
  }, [zoomScale]);

  // Turnusplanar (Standard, forhåndsdefinerte og eigendefinerte)
  const [activePlan, setActivePlan] = useState(PRESET_SHIFT_PLANS[0]);
  const [customPlans, setCustomPlans] = useState([]);
  const [showTurnusModal, setShowTurnusModal] = useState(false);

  // Samanlikningsmodus
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [compareGroups, setCompareGroups] = useState([3, 1]);

  // Modaler
  const [showSettings, setShowSettings] = useState(false);
  const [showFerieModal, setShowFerieModal] = useState(false);
  const [showYearOverview, setShowYearOverview] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [showAlarmModal, setShowAlarmModal] = useState(false);
  const [showDayModal, setShowDayModal] = useState(false);

  const handleSelectDateFromOverview = (dateObj) => {
    setCurrentMonth(dateObj);
    const rawShift = getShiftForDate(dateObj, shiftGroup, activePlan);
    const dateStr = format(dateObj, "yyyy-MM-dd");
    const dateKey = `${shiftGroup}-${dateStr}`;
    handleDayPress(dateObj, rawShift, dateKey);
  };

  // Dag-modal tilstand
  const [activeDate, setActiveDate] = useState(null);
  const [originalShift, setOriginalShift] = useState("");
  const [bytteShift, setBytteShift] = useState(null);
  const [overtidShift, setOvertidShift] = useState(null);
  const [isFerie, setIsFerie] = useState(false);
  const [commentText, setCommentText] = useState("");

  // Last lagrede data ved oppstart
  useEffect(() => {
    const loadSavedData = async () => {
      try {
        const [
          savedComments,
          savedGroup,
          savedOverrides,
          savedTimes,
          savedCompare,
          savedAlarm,
          savedPlanStr,
          savedCustomPlansStr,
          savedZoomStr,
        ] = await Promise.all([
          AsyncStorage.getItem(SHIFT_COMMENTS_KEY),
          AsyncStorage.getItem(SELECTED_SHIFT_KEY),
          AsyncStorage.getItem(SHIFT_OVERRIDES_KEY),
          AsyncStorage.getItem(SHIFT_TIMES_KEY),
          AsyncStorage.getItem(COMPARE_SHIFTS_KEY),
          AsyncStorage.getItem(SHIFT_ALARM_CONFIG_KEY),
          AsyncStorage.getItem(ACTIVE_SHIFT_PLAN_KEY),
          AsyncStorage.getItem(CUSTOM_SHIFT_PLANS_KEY),
          AsyncStorage.getItem(CALENDAR_ZOOM_KEY),
        ]);

        if (savedComments) setComments(JSON.parse(savedComments));
        if (savedOverrides) setOverrides(JSON.parse(savedOverrides));
        if (savedTimes) setShiftTimes(JSON.parse(savedTimes));
        if (savedCompare) setCompareGroups(JSON.parse(savedCompare));
        if (savedAlarm) setAlarmConfig(JSON.parse(savedAlarm));

        if (savedZoomStr) {
          const parsedZoom = parseFloat(savedZoomStr);
          if (!isNaN(parsedZoom) && parsedZoom >= 0.75 && parsedZoom <= 1.6) {
            setZoomScale(parsedZoom);
          }
        }

        let loadedCustomPlans = [];
        if (savedCustomPlansStr) {
          try {
            loadedCustomPlans = JSON.parse(savedCustomPlansStr);
            setCustomPlans(loadedCustomPlans);
          } catch {}
        }

        if (savedPlanStr) {
          try {
            const parsedPlan = JSON.parse(savedPlanStr);
            // Finn full plan frå preset eller custom dersom tilgjengeleg
            const match =
              PRESET_SHIFT_PLANS.find((p) => p.id === parsedPlan.id) ||
              loadedCustomPlans.find((p) => p.id === parsedPlan.id) ||
              parsedPlan;
            setActivePlan(match);
          } catch {}
        }

        if (savedGroup) {
          setShiftGroup(Number(savedGroup));
        }
      } catch (err) {
        console.warn("Kunne ikke laste lagrede data:", err);
      }
    };
    loadSavedData();
  }, []);

  const handleResetZoom = async () => {
    setZoomScale(1.0);
    try {
      await AsyncStorage.setItem(CALENDAR_ZOOM_KEY, "1.0");
    } catch (err) {
      console.warn("Feil ved lagring av zoom:", err);
    }
  };

  const handleSelectPlan = async (plan) => {
    setActivePlan(plan);
    // Sjekk om noverande skiftgruppe finst i den nye planen, viss ikkje vel første gruppe
    const groups = getGroupsForPlan(plan);
    if (!groups.some((g) => Number(g.id) === Number(shiftGroup))) {
      const firstId = Number(groups[0]?.id || 1);
      setShiftGroup(firstId);
      await AsyncStorage.setItem(SELECTED_SHIFT_KEY, firstId.toString());
    }

    // Oppdater standardtider dersom planen har eigne tider
    if (plan.shiftTypes && plan.shiftTypes.length > 0) {
      const updatedTimes = { ...shiftTimes };
      plan.shiftTypes.forEach((st) => {
        if (st.defaultTime) {
          updatedTimes[st.code] = st.defaultTime;
        }
      });
      setShiftTimes(updatedTimes);
      await AsyncStorage.setItem(SHIFT_TIMES_KEY, JSON.stringify(updatedTimes));
    }

    try {
      await AsyncStorage.setItem(ACTIVE_SHIFT_PLAN_KEY, JSON.stringify(plan));
    } catch (err) {
      console.warn("Kunne ikkje lagre aktiv turnusplan:", err);
    }
  };

  const handleSaveCustomPlan = async (newPlan) => {
    const updated = [...customPlans.filter((p) => p.id !== newPlan.id), newPlan];
    setCustomPlans(updated);
    try {
      await AsyncStorage.setItem(CUSTOM_SHIFT_PLANS_KEY, JSON.stringify(updated));
    } catch (err) {
      console.warn("Kunne ikkje lagre eigendefinert turnusplan:", err);
    }
  };

  const handleDeleteCustomPlan = async (planId) => {
    const updated = customPlans.filter((p) => p.id !== planId);
    setCustomPlans(updated);
    try {
      await AsyncStorage.setItem(CUSTOM_SHIFT_PLANS_KEY, JSON.stringify(updated));
      if (activePlan?.id === planId) {
        handleSelectPlan(PRESET_SHIFT_PLANS[0]);
      }
    } catch (err) {
      console.warn("Kunne ikkje slette turnusplan:", err);
    }
  };

  const handleSaveAlarmConfig = async (newConfig) => {
    setAlarmConfig(newConfig);
    try {
      await AsyncStorage.setItem(SHIFT_ALARM_CONFIG_KEY, JSON.stringify(newConfig));
      await rescheduleAllShiftAlarms({
        shiftGroup,
        overrides,
        alarmConfig: newConfig,
      });
    } catch (err) {
      console.warn("Kunne ikkje lagre alarm-konfigurasjon:", err);
    }
  };

  // Resynkroniser alarmar automatisk ved vaktendringar
  useEffect(() => {
    if (alarmConfig?.enabled) {
      rescheduleAllShiftAlarms({
        shiftGroup,
        overrides,
        alarmConfig,
        activePlan,
      }).catch((err) => {
        console.warn("Kunne ikkje resynkronisere alarmar:", err);
      });
    }
  }, [shiftGroup, overrides, alarmConfig?.enabled, activePlan]);

  // Oppdater heimeskjerm-widget når skiftgruppe, overstyringar, tider eller plan endrast
  useEffect(() => {
    updateHomeScreenWidget();
  }, [shiftGroup, overrides, shiftTimes, isDark, activePlan]);

  // PanResponder for klype-zoom (to fingrar) og sveiping mellom måneder (éin finger)
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (evt) => {
        // Dersom to fingrar leggast ned, ta kontroll for klype-zoom straks
        return Boolean(evt.nativeEvent.touches && evt.nativeEvent.touches.length >= 2);
      },
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // To fingrar = klype-zoom
        if (evt.nativeEvent.touches && evt.nativeEvent.touches.length >= 2) {
          return true;
        }
        // Éin finger = horisontal sveip for å bla i månadar (dersom vassrett bevegelse dominerer)
        return (
          Math.abs(gestureState.dx) > 35 &&
          Math.abs(gestureState.dy) < Math.abs(gestureState.dx) * 0.8
        );
      },
      onPanResponderGrant: (evt) => {
        if (evt.nativeEvent.touches && evt.nativeEvent.touches.length >= 2) {
          const t1 = evt.nativeEvent.touches[0];
          const t2 = evt.nativeEvent.touches[1];
          const dist = Math.hypot(t1.pageX - t2.pageX, t1.pageY - t2.pageY);
          initialPinchDistance.current = dist;
          initialZoomScale.current = zoomScaleRef.current;
          isPinching.current = true;
          setIsPinchingActive(true);
        }
      },
      onPanResponderMove: (evt, gestureState) => {
        if (evt.nativeEvent.touches && evt.nativeEvent.touches.length >= 2) {
          const t1 = evt.nativeEvent.touches[0];
          const t2 = evt.nativeEvent.touches[1];
          const dist = Math.hypot(t1.pageX - t2.pageX, t1.pageY - t2.pageY);

          if (!initialPinchDistance.current) {
            initialPinchDistance.current = dist;
            initialZoomScale.current = zoomScaleRef.current;
            isPinching.current = true;
            setIsPinchingActive(true);
          } else if (initialPinchDistance.current > 0) {
            const factor = dist / initialPinchDistance.current;
            let nextScale = initialZoomScale.current * factor;
            // Grenser: 0.80 (kompakt) til 1.50 (ekstra stor)
            nextScale = Math.max(0.8, Math.min(1.5, nextScale));
            setZoomScale(Number(nextScale.toFixed(2)));
          }
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (isPinching.current) {
          isPinching.current = false;
          setIsPinchingActive(false);
          initialPinchDistance.current = null;
          AsyncStorage.setItem(CALENDAR_ZOOM_KEY, zoomScaleRef.current.toString()).catch(() => {});
        } else {
          if (gestureState.dx < -50) {
            setCurrentMonth((prev) => addMonths(prev, 1));
          } else if (gestureState.dx > 50) {
            setCurrentMonth((prev) => subMonths(prev, 1));
          }
        }
      },
      onPanResponderTerminate: () => {
        if (isPinching.current) {
          isPinching.current = false;
          setIsPinchingActive(false);
          initialPinchDistance.current = null;
          AsyncStorage.setItem(CALENDAR_ZOOM_KEY, zoomScaleRef.current.toString()).catch(() => {});
        }
      },
    })
  ).current;

  // Skiftvalg
  const handleSelectShiftGroup = async (num) => {
    setShiftGroup(num);
    try {
      await AsyncStorage.setItem(SELECTED_SHIFT_KEY, num.toString());
    } catch (err) {
      console.warn("Feil ved lagring av skiftgruppe:", err);
    }
  };

  // Toggle skift i samanlikningsmodus
  const handleToggleCompareGroup = async (num) => {
    let next;
    if (compareGroups.includes(num)) {
      if (compareGroups.length === 1) return;
      next = compareGroups.filter((g) => g !== num);
    } else {
      next = [...compareGroups, num].sort();
    }
    setCompareGroups(next);
    try {
      await AsyncStorage.setItem(COMPARE_SHIFTS_KEY, JSON.stringify(next));
    } catch (err) {
      console.warn("Feil ved lagring av compare groups:", err);
    }
  };

  // Åpne dag-modal
  const handleDayPress = (day, defShift, dateKey) => {
    setActiveDate(day);
    setOriginalShift(defShift);

    const existing = overrides[dateKey];
    if (existing) {
      // Støtt både ny struktur og bakoverkompatibel struktur
      setBytteShift(existing.bytteShift || (existing.shift && !existing.isOvertid ? existing.shift : null));
      setOvertidShift(existing.overtidShift || (existing.isOvertid ? (existing.shift || defShift) : null));
      setIsFerie(Boolean(existing.isFerie));
    } else {
      setBytteShift(null);
      setOvertidShift(null);
      setIsFerie(false);
    }

    setCommentText(comments[dateKey] || "");
    setShowDayModal(true);
  };

  // Lagre endringer for en dag
  const handleSaveDay = async () => {
    if (!activeDate) return;
    const dateKey = `${shiftGroup}-${format(activeDate, "yyyy-MM-dd")}`;

    const updatedOverrides = { ...overrides };
    if (bytteShift || overtidShift || isFerie) {
      updatedOverrides[dateKey] = {
        bytteShift: bytteShift || null,
        overtidShift: overtidShift || null,
        isFerie: Boolean(isFerie),
      };
    } else {
      delete updatedOverrides[dateKey];
    }
    setOverrides(updatedOverrides);

    const trimmed = commentText.trim();
    const updatedComments = { ...comments };
    if (trimmed) {
      updatedComments[dateKey] = trimmed;
    } else {
      delete updatedComments[dateKey];
    }
    setComments(updatedComments);

    setShowDayModal(false);

    try {
      await Promise.all([
        AsyncStorage.setItem(SHIFT_OVERRIDES_KEY, JSON.stringify(updatedOverrides)),
        AsyncStorage.setItem(SHIFT_COMMENTS_KEY, JSON.stringify(updatedComments)),
      ]);
    } catch (err) {
      console.warn("Feil ved lagring:", err);
    }
  };

  // Tilbakestill dag til ren turnus
  const handleResetDay = async () => {
    if (!activeDate) return;
    const dateKey = `${shiftGroup}-${format(activeDate, "yyyy-MM-dd")}`;

    const updatedOverrides = { ...overrides };
    delete updatedOverrides[dateKey];
    setOverrides(updatedOverrides);

    const updatedComments = { ...comments };
    delete updatedComments[dateKey];
    setComments(updatedComments);

    setShowDayModal(false);

    try {
      await Promise.all([
        AsyncStorage.setItem(SHIFT_OVERRIDES_KEY, JSON.stringify(updatedOverrides)),
        AsyncStorage.setItem(SHIFT_COMMENTS_KEY, JSON.stringify(updatedComments)),
      ]);
    } catch (err) {
      console.warn("Feil ved sletting:", err);
    }
  };

  // Lagre ferieperiode (fra dato til dato)
  const handleSaveFeriePeriod = async (startDate, endDate) => {
    const updated = { ...overrides };
    let cur = new Date(startDate);
    const end = new Date(endDate);

    while (cur <= end) {
      const dateKey = `${shiftGroup}-${format(cur, "yyyy-MM-dd")}`;
      const existing = updated[dateKey] || {};
      updated[dateKey] = {
        ...existing,
        isFerie: true,
      };
      cur = addDays(cur, 1);
    }

    setOverrides(updated);
    try {
      await AsyncStorage.setItem(SHIFT_OVERRIDES_KEY, JSON.stringify(updated));
    } catch (err) {
      console.warn("Feil ved lagring av ferieperiode:", err);
    }
  };

  // Fjern ferie i periode
  const handleRemoveFeriePeriod = async (startDate, endDate) => {
    const updated = { ...overrides };
    let cur = new Date(startDate);
    const end = new Date(endDate);

    while (cur <= end) {
      const dateKey = `${shiftGroup}-${format(cur, "yyyy-MM-dd")}`;
      if (updated[dateKey]) {
        if (updated[dateKey].bytteShift || updated[dateKey].overtidShift) {
          updated[dateKey] = {
            ...updated[dateKey],
            isFerie: false,
          };
        } else {
          delete updated[dateKey];
        }
      }
      cur = addDays(cur, 1);
    }

    setOverrides(updated);
    try {
      await AsyncStorage.setItem(SHIFT_OVERRIDES_KEY, JSON.stringify(updated));
    } catch (err) {
      console.warn("Feil ved fjerning av ferieperiode:", err);
    }
  };

  // Lagre skifttider
  const handleSaveShiftTimes = async (newTimes) => {
    setShiftTimes(newTimes);
    try {
      await AsyncStorage.setItem(SHIFT_TIMES_KEY, JSON.stringify(newTimes));
    } catch (err) {
      console.warn("Feil ved lagring av skifttider:", err);
    }
  };

  const monthTitle = format(currentMonth, "MMMM yyyy", { locale: nb });
  const formattedMonthTitle =
    monthTitle.charAt(0).toUpperCase() + monthTitle.slice(1);

  // Rutenett og ukenummer
  const monthStart = startOfMonth(currentMonth);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const today = new Date();

  const daysGrid = [];
  let dayIterator = startDate;
  for (let i = 0; i < 42; i++) {
    daysGrid.push(dayIterator);
    dayIterator = addDays(dayIterator, 1);
  }

  const weeks = [];
  for (let i = 0; i < 42; i += 7) {
    const weekDays = daysGrid.slice(i, i + 7);
    const weekNumber = getISOWeek(weekDays[0]);
    weeks.push({ weekNumber, days: weekDays });
  }

  // Tidsinfo i dag-modal
  const activeEffectiveShift = isFerie
    ? "Ferie"
    : bytteShift || originalShift;
  const currentModalTime = shiftTimes[activeEffectiveShift] || "";

  // Dynamiske storleikar basert på klype-zoom (zoomScale)
  const scaledCellHeight = Math.round(58 * zoomScale);
  const scaledShiftFontSize = Math.max(8.5, Math.round(10.5 * Math.pow(zoomScale, 0.85) * 10) / 10);
  const scaledDayNumberFontSize = Math.max(8, Math.round(10 * zoomScale * 10) / 10);
  const scaledDayNumberContainer = Math.round(17 * zoomScale);
  const scaledBadgeSize = Math.round(14 * zoomScale);
  const scaledBadgeFontSize = Math.max(7, Math.round(8 * zoomScale));
  const scaledWeekNumWidth = Math.round(26 * Math.min(zoomScale, 1.25));
  const scaledWeekNumFontSize = Math.max(9, Math.round(11 * Math.min(zoomScale, 1.2)));
  const scaledOutsideNumberFontSize = Math.max(9, Math.round(11 * zoomScale));
  const scaledCompareShiftFontSize = Math.max(7.5, Math.round(9 * zoomScale * 10) / 10);

  return (
    <View style={[styles.mainWrapper, { backgroundColor: theme.bg }]}>
      {/* Topp-verktøylinje som aldri vert kutta av på små skjermar */}
      <View style={[styles.topToolbar, { backgroundColor: theme.cardBg, borderBottomColor: theme.cardBorder }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.topToolbarContent}
        >
          {/* Samanlikn */}
          <TouchableOpacity
            style={[
              styles.toolbarPill,
              { backgroundColor: isCompareMode ? theme.activeButtonBg : theme.inactiveButtonBg },
            ]}
            onPress={() => setIsCompareMode(!isCompareMode)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.toolbarPillText,
                { color: isCompareMode ? theme.activeButtonText : theme.inactiveButtonText },
              ]}
            >
              👥 {isCompareMode ? "Samanliknar" : "Samanlikn"}
            </Text>
          </TouchableOpacity>

          {/* Turnus-byggjar / Turnus-veljar */}
          <TouchableOpacity
            style={[
              styles.toolbarPill,
              { backgroundColor: activePlan?.id !== "standard-35" ? (isDark ? "#14532d" : "#dcfce7") : theme.inactiveButtonBg },
            ]}
            onPress={() => setShowTurnusModal(true)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.toolbarPillText,
                {
                  color: activePlan?.id !== "standard-35" ? (isDark ? "#86efac" : "#15803d") : theme.textPrimary,
                  fontWeight: activePlan?.id !== "standard-35" ? "bold" : "normal",
                },
              ]}
            >
              🏢 {activePlan?.shortName || "Turnus"}
            </Text>
          </TouchableOpacity>

          {/* Synk & del */}
          <TouchableOpacity
            style={[styles.toolbarPill, { backgroundColor: theme.inactiveButtonBg }]}
            onPress={() => setShowSyncModal(true)}
            activeOpacity={0.7}
          >
            <Text style={[styles.toolbarPillText, { color: theme.textPrimary }]}>
              📲 Synk & del
            </Text>
          </TouchableOpacity>

          {/* Smart vekkeklokke / skiftalarm */}
          <TouchableOpacity
            style={[
              styles.toolbarPill,
              { backgroundColor: alarmConfig?.enabled ? (isDark ? "#1e3a8a" : "#dbeafe") : theme.inactiveButtonBg },
            ]}
            onPress={() => setShowAlarmModal(true)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.toolbarPillText,
                {
                  color: alarmConfig?.enabled ? (isDark ? "#93c5fd" : "#1d4ed8") : theme.textPrimary,
                  fontWeight: alarmConfig?.enabled ? "bold" : "normal",
                },
              ]}
            >
              ⏰ {alarmConfig?.enabled ? "Alarm PÅ" : "Alarm"}
            </Text>
          </TouchableOpacity>

          {/* Årsoversikt */}
          <TouchableOpacity
            style={[styles.toolbarPill, { backgroundColor: theme.inactiveButtonBg }]}
            onPress={() => setShowYearOverview(true)}
            activeOpacity={0.7}
          >
            <Text style={[styles.toolbarPillText, { color: theme.textPrimary }]}>
              📋 Oversikt
            </Text>
          </TouchableOpacity>

          {/* Ferie */}
          <TouchableOpacity
            style={[styles.toolbarPill, { backgroundColor: theme.ferieBadgeBg }]}
            onPress={() => setShowFerieModal(true)}
            activeOpacity={0.7}
          >
            <Text style={[styles.toolbarPillText, { color: "#ffffff" }]}>
              🏖️ Ferie
            </Text>
          </TouchableOpacity>

          {/* Innstillingar */}
          <TouchableOpacity
            style={[styles.toolbarIconBtn, { backgroundColor: theme.navButtonBg }]}
            onPress={() => setShowSettings(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.toolbarIconText}>⚙️</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!isPinchingActive}
      >
        {/* Skiftvelger */}
        <View style={[styles.selectorCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <Text style={[styles.selectorTitle, { color: theme.textMuted, marginBottom: 0 }]}>
              {isCompareMode
                ? "Vel lag å samanlikne:"
                : "Vel skiftgruppe / lag:"}
            </Text>
            <TouchableOpacity onPress={() => setShowTurnusModal(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={{ fontSize: 11, color: isDark ? "#38bdf8" : "#0284c7", fontWeight: "600" }}>
                {activePlan?.shortName || activePlan?.name || "Endre turnus"} ▾
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.shiftButtonGroup}>
            {getGroupsForPlan(activePlan).map((grpItem) => {
              const num = Number(grpItem.id);
              const isSelected = isCompareMode
                ? compareGroups.includes(num)
                : Number(shiftGroup) === num;

              return (
                <TouchableOpacity
                  key={grpItem.id}
                  style={[
                    styles.shiftButton,
                    { backgroundColor: theme.inactiveButtonBg },
                    isSelected && { backgroundColor: theme.activeButtonBg },
                  ]}
                  onPress={() =>
                    isCompareMode
                      ? handleToggleCompareGroup(num)
                      : handleSelectShiftGroup(num)
                  }
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.shiftButtonText,
                      { color: isSelected ? theme.activeButtonText : theme.inactiveButtonText },
                    ]}
                    numberOfLines={1}
                  >
                    {grpItem.name || `Lag ${num}`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Måneds-navigator */}
        <View style={[styles.headerContainer, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
          <TouchableOpacity
            style={[styles.navButton, { backgroundColor: theme.navButtonBg }]}
            onPress={() => setCurrentMonth(subMonths(currentMonth, 1))}
            activeOpacity={0.6}
          >
            <Text style={[styles.navButtonText, { color: theme.navButtonText }]}>‹</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setCurrentMonth(new Date())}
            activeOpacity={0.7}
            style={{ alignItems: "center" }}
          >
            <Text style={[styles.monthTitle, { color: theme.textPrimary }]}>{formattedMonthTitle}</Text>
            <Text style={[styles.todayHint, { color: theme.textMuted }]}>
              Trykk for «I dag» • Klyp for å zoome
            </Text>
            {Math.abs(zoomScale - 1.0) > 0.04 && (
              <TouchableOpacity
                style={[
                  styles.zoomIndicatorPill,
                  {
                    backgroundColor: isDark ? "#1e293b" : "#f1f5f9",
                    borderColor: isDark ? "#334155" : "#cbd5e1",
                  },
                ]}
                onPress={handleResetZoom}
                activeOpacity={0.7}
              >
                <Text style={[styles.zoomIndicatorText, { color: isDark ? "#38bdf8" : "#0284c7" }]}>
                  🔍 {Math.round(zoomScale * 100)}% • Trykk for standard (100%)
                </Text>
              </TouchableOpacity>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navButton, { backgroundColor: theme.navButtonBg }]}
            onPress={() => setCurrentMonth(addMonths(currentMonth, 1))}
            activeOpacity={0.6}
          >
            <Text style={[styles.navButtonText, { color: theme.navButtonText }]}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Ukedags-overskrift (med Uke-kolonne) */}
        <View style={styles.weekDaysRow}>
          <View style={[styles.weekNumberHeaderCell, { width: scaledWeekNumWidth }]}>
            <Text style={[styles.weekNumberHeaderText, { color: theme.weekHeaderColor, fontSize: scaledWeekNumFontSize }]}>
              Uke
            </Text>
          </View>
          {["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"].map((dayName, idx) => (
            <View key={dayName} style={styles.weekDayCell}>
              <Text
                style={[
                  styles.weekDayText,
                  { color: theme.weekHeaderColor },
                  (idx === 5 || idx === 6) && { color: theme.weekEndColor },
                ]}
              >
                {dayName}
              </Text>
            </View>
          ))}
        </View>

        {/* Kalenderrutenett med PanResponder for sveiping og klype-zoom */}
        <View
          style={[styles.gridContainer, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}
          {...panResponder.panHandlers}
        >
          {weeks.map(({ weekNumber, days }, weekIdx) => (
            <View key={weekIdx} style={styles.weekRow}>
              {/* Ukenummer-celle */}
              <View
                style={[
                  styles.weekNumberCell,
                  {
                    backgroundColor: theme.weekNumberBg,
                    width: scaledWeekNumWidth,
                    height: scaledCellHeight,
                  },
                ]}
              >
                <Text style={[styles.weekNumberText, { color: theme.weekNumberText, fontSize: scaledWeekNumFontSize }]}>
                  {weekNumber}
                </Text>
              </View>

              {/* Dags-celler */}
              {days.map((d) => {
                const inCurrentMonth = isSameMonth(d, monthStart);
                const dateStr = format(d, "yyyy-MM-dd");
                const dateKey = `${shiftGroup}-${dateStr}`;
                const isCurrentDay = isSameDay(d, today);
                const hasComment = Boolean(comments[dateKey]);

                if (!inCurrentMonth) {
                  return (
                    <View
                      key={dateStr}
                      style={[
                        styles.dayCell,
                        {
                          backgroundColor: theme.outsideCellBg,
                          borderColor: "transparent",
                          height: scaledCellHeight,
                        },
                      ]}
                    >
                      <Text style={[styles.dayNumberOutside, { color: theme.outsideCellText, fontSize: scaledOutsideNumberFontSize }]}>
                        {format(d, "d")}
                      </Text>
                    </View>
                  );
                }

                // Samanlikningsmodus
                if (isCompareMode) {
                  return (
                    <View
                      key={dateStr}
                      style={[
                        styles.dayCell,
                        styles.compareDayCell,
                        {
                          backgroundColor: theme.cardBg,
                          borderColor: theme.cardBorder,
                          height: scaledCellHeight,
                        },
                        isCurrentDay && { borderColor: theme.todayBorder, borderWidth: 2 },
                      ]}
                    >
                      <View style={styles.dayHeader}>
                        <View
                          style={[
                            styles.dayNumberContainer,
                            {
                              width: scaledDayNumberContainer,
                              height: scaledDayNumberContainer,
                              borderRadius: scaledDayNumberContainer / 2,
                            },
                            isCurrentDay && { backgroundColor: theme.todayBorder },
                          ]}
                        >
                          <Text
                            style={[
                              styles.dayNumberText,
                              {
                                color: isCurrentDay ? "#ffffff" : theme.textPrimary,
                                fontSize: scaledDayNumberFontSize,
                              },
                            ]}
                          >
                            {format(d, "d")}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.compareShiftsList}>
                        {compareGroups.map((grp) => {
                          const s = getShiftForDate(d, grp, activePlan);
                          const sc = getShiftColor(s, isDark);
                          return (
                            <View
                              key={grp}
                              style={[
                                styles.compareShiftPill,
                                { backgroundColor: sc.bg, borderColor: sc.border },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.compareShiftPillText,
                                  { color: sc.text, fontSize: scaledCompareShiftFontSize },
                                ]}
                                numberOfLines={1}
                              >
                                S{grp}: {s}
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  );
                }

                // Enkelt-skift visning
                const rawShift = getShiftForDate(d, shiftGroup, activePlan);
                const override = overrides[dateKey];
                const dayIsFerie = Boolean(override?.isFerie);
                const dayByttet = override?.bytteShift || (override?.shift && !override?.isOvertid ? override.shift : null);
                const dayOvertid = override?.overtidShift || (override?.isOvertid ? (override.shift || rawShift) : null);

                // Bestem aktiv visningsvakt og farge
                let displayShift = rawShift;
                let displayColor = getShiftColor(rawShift, isDark);

                if (dayIsFerie) {
                  displayShift = "🏖️ Ferie";
                  displayColor = getShiftColor("Ferie", isDark);
                } else if (dayByttet) {
                  displayShift = dayByttet;
                  displayColor = getShiftColor(dayByttet, isDark);
                } else if (dayOvertid && rawShift === "Fri") {
                  // Tok overtid på ein fridag
                  displayShift = dayOvertid;
                  displayColor = getShiftColor(dayOvertid, isDark);
                }

                return (
                  <TouchableOpacity
                    key={dateStr}
                    style={[
                      styles.dayCell,
                      {
                        backgroundColor: displayColor.bg,
                        borderColor: displayColor.border,
                        height: scaledCellHeight,
                      },
                      isCurrentDay && { borderColor: theme.todayBorder, borderWidth: 2 },
                    ]}
                    onPress={() => handleDayPress(d, rawShift, dateKey)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.dayHeader}>
                      <View
                        style={[
                          styles.dayNumberContainer,
                          {
                            width: scaledDayNumberContainer,
                            height: scaledDayNumberContainer,
                            borderRadius: scaledDayNumberContainer / 2,
                          },
                          isCurrentDay && { backgroundColor: theme.todayBorder },
                        ]}
                      >
                        <Text
                          style={[
                            styles.dayNumberText,
                            {
                              color: isCurrentDay ? "#ffffff" : displayColor.text,
                              fontSize: scaledDayNumberFontSize,
                            },
                          ]}
                        >
                          {format(d, "d")}
                        </Text>
                      </View>

                      {/* Merke-rad: Vaktbytte (Lilla 🔄), Overtid (Oransje ⚡), Notat 📝 */}
                      <View style={styles.badgeRow}>
                        {dayByttet && !dayIsFerie && (
                          <View
                            style={[
                              styles.symbolBadge,
                              {
                                backgroundColor: theme.bytteBadgeBg,
                                width: scaledBadgeSize,
                                height: scaledBadgeSize,
                                borderRadius: Math.max(3, Math.round(scaledBadgeSize / 3.5)),
                              },
                            ]}
                          >
                            <Text style={[styles.symbolBadgeText, { fontSize: scaledBadgeFontSize }]}>🔄</Text>
                          </View>
                        )}
                        {dayOvertid && !dayIsFerie && (
                          <View
                            style={[
                              styles.symbolBadge,
                              {
                                backgroundColor: theme.overtidBadgeBg,
                                width: scaledBadgeSize,
                                height: scaledBadgeSize,
                                borderRadius: Math.max(3, Math.round(scaledBadgeSize / 3.5)),
                              },
                            ]}
                          >
                            <Text style={[styles.symbolBadgeText, { fontSize: scaledBadgeFontSize }]}>⚡</Text>
                          </View>
                        )}
                        {hasComment && (
                          <Text style={[styles.commentIndicator, { fontSize: scaledBadgeFontSize }]}>📝</Text>
                        )}
                      </View>
                    </View>

                    <Text
                      style={[
                        styles.shiftText,
                        {
                          color: displayColor.text,
                          fontSize: scaledShiftFontSize,
                        },
                      ]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                    >
                      {displayShift}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>

        {/* Fargeforklaring med skifttider, ferie og merker */}
        <View style={[styles.legendContainer, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
          <Text style={[styles.legendTitle, { color: theme.textSecondary }]}>
            Skift, ferie og merker
          </Text>
          <View style={styles.legendGrid}>
            {[
              { label: "Fm (Formiddag)", shift: "Fm" },
              { label: "Em (Ettermiddag)", shift: "Em" },
              { label: "N (Natt)", shift: "N" },
              { label: "12tFm (12t Formiddag)", shift: "12tFm" },
              { label: "12tN (12t Natt)", shift: "12tN" },
              { label: "Fri", shift: "Fri" },
              { label: "🏖️ Ferie", shift: "Ferie" },
            ].map((item) => {
              const c = getShiftColor(item.shift, isDark);
              const time = shiftTimes[item.shift] || "";
              return (
                <View key={item.shift} style={styles.legendItem}>
                  <View
                    style={[
                      styles.legendColorBox,
                      { backgroundColor: c.bg, borderColor: c.border },
                    ]}
                  />
                  <View style={styles.legendTextContainer}>
                    <Text style={[styles.legendText, { color: theme.textPrimary }]}>
                      {item.label}
                    </Text>
                    {time ? (
                      <Text style={[styles.legendTimeText, { color: theme.textMuted }]}>
                        {time}
                      </Text>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>

          {/* Forklaring for symboler: Vaktbytte og Overtid */}
          <View style={styles.symbolLegendRow}>
            <View style={styles.symbolLegendItem}>
              <View style={[styles.symbolBadgeLarge, { backgroundColor: theme.bytteBadgeBg }]}>
                <Text style={styles.symbolBadgeLargeText}>🔄</Text>
              </View>
              <Text style={[styles.symbolLegendLabel, { color: theme.textPrimary }]}>
                Vaktbytte (Lilla)
              </Text>
            </View>

            <View style={styles.symbolLegendItem}>
              <View style={[styles.symbolBadgeLarge, { backgroundColor: theme.overtidBadgeBg }]}>
                <Text style={styles.symbolBadgeLargeText}>⚡</Text>
              </View>
              <Text style={[styles.symbolLegendLabel, { color: theme.textPrimary }]}>
                Overtid (Oransje)
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Innstillings-modal for klokkeslett */}
      <SettingsModal
        visible={showSettings}
        onClose={() => setShowSettings(false)}
        shiftTimes={shiftTimes}
        onSaveShiftTimes={handleSaveShiftTimes}
        theme={theme}
        activePlan={activePlan}
      />

      {/* Turnus-byggjar modal */}
      <TurnusBuilderModal
        visible={showTurnusModal}
        onClose={() => setShowTurnusModal(false)}
        activePlan={activePlan}
        onSelectPlan={handleSelectPlan}
        customPlans={customPlans}
        onSaveCustomPlan={handleSaveCustomPlan}
        onDeleteCustomPlan={handleDeleteCustomPlan}
        theme={theme}
        isDark={isDark}
      />

      {/* Ferie-modal for heile periodar */}
      <FerieModal
        visible={showFerieModal}
        onClose={() => setShowFerieModal(false)}
        onSaveFeriePeriod={handleSaveFeriePeriod}
        onRemoveFeriePeriod={handleRemoveFeriePeriod}
        theme={theme}
      />

      {/* Årsoversikt-modal for overtid og ferie */}
      <YearOverviewModal
        visible={showYearOverview}
        onClose={() => setShowYearOverview(false)}
        overrides={overrides}
        comments={comments}
        shiftGroup={shiftGroup}
        shiftTimes={shiftTimes}
        theme={theme}
        isDark={isDark}
        onSelectDate={handleSelectDateFromOverview}
      />

      {/* Synkronisering og deling-modal */}
      <SyncShareModal
        visible={showSyncModal}
        onClose={() => setShowSyncModal(false)}
        currentMonth={currentMonth}
        shiftGroup={shiftGroup}
        getShiftForDate={getShiftForDate}
        overrides={overrides}
        comments={comments}
        shiftTimes={shiftTimes}
        theme={theme}
        isDark={isDark}
        activePlan={activePlan}
      />

      {/* Smart vekkeklokke / skiftalarm modal */}
      <AlarmModal
        visible={showAlarmModal}
        onClose={() => setShowAlarmModal(false)}
        alarmConfig={alarmConfig}
        onSaveAlarmConfig={handleSaveAlarmConfig}
        shiftGroup={shiftGroup}
        overrides={overrides}
        theme={theme}
        isDark={isDark}
      />

      {/* Dag-modal for vaktbytte, overtid, ferie og notater */}
      <Modal
        visible={showDayModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDayModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={[styles.modalOverlay, { backgroundColor: theme.modalOverlay }]}
        >
          <View style={[styles.modalCard, { backgroundColor: theme.cardBg }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.modalDate, { color: theme.textPrimary }]}>
                {activeDate
                  ? format(activeDate, "EEEE d. MMMM yyyy", { locale: nb })
                  : ""}
              </Text>

              {/* Turnusinfo */}
              <View style={[styles.modalInfoBox, { backgroundColor: theme.inactiveButtonBg }]}>
                <Text style={[styles.modalOriginalShiftText, { color: theme.textSecondary }]}>
                  Turnusvakt:{" "}
                  <Text style={{ fontWeight: "bold", color: theme.textPrimary }}>
                    {originalShift}
                  </Text>{" "}
                  (Gruppe {shiftGroup})
                </Text>
                {currentModalTime ? (
                  <Text style={[styles.modalTimeText, { color: theme.textMuted }]}>
                    ⏰ Arbeidstid: {currentModalTime}
                  </Text>
                ) : null}
                {(() => {
                  if (!alarmConfig?.enabled) return null;
                  const effective = isFerie ? "Ferie" : (bytteShift || originalShift);
                  if (effective === "Fri" || effective === "Ferie") {
                    return (
                      <Text style={[styles.modalTimeText, { color: theme.textMuted, marginTop: 4 }]}>
                        🔕 Skiftalarm: Ingen alarm ({effective})
                      </Text>
                    );
                  }
                  const sc = alarmConfig.times?.[effective];
                  if (sc?.enabled && sc?.time) {
                    return (
                      <View style={{ marginTop: 4 }}>
                        <Text style={[styles.modalTimeText, { color: isDark ? "#93c5fd" : "#2563eb", fontWeight: "600" }]}>
                          ⏰ Skiftalarm: kl. {sc.time} ({effective})
                        </Text>
                        <TouchableOpacity
                          style={{
                            marginTop: 6,
                            backgroundColor: isDark ? "#1e3a8a" : "#dbeafe",
                            paddingVertical: 6,
                            paddingHorizontal: 10,
                            borderRadius: 6,
                            alignSelf: "flex-start",
                          }}
                          onPress={() => {
                            const [h, m] = sc.time.split(":");
                            const dayTitle = activeDate ? format(activeDate, "EEEE d. MMM", { locale: nb }) : effective;
                            setNativeClockAlarm({
                              hour: h,
                              minutes: m,
                              message: `Vakt: ${effective} (${dayTitle})`,
                              skipUi: false,
                            });
                          }}
                          activeOpacity={0.7}
                        >
                          <Text style={{ fontSize: 11.5, fontWeight: "700", color: isDark ? "#93c5fd" : "#1d4ed8" }}>
                            📱 Still vekkeklokke i Klokke-appen
                          </Text>
                        </TouchableOpacity>
                      </View>
                    );
                  }
                  return null;
                })()}
              </View>

              {/* 1. FERIE-VELGER */}
              <TouchableOpacity
                style={[
                  styles.ferieToggleBtn,
                  { backgroundColor: theme.inactiveButtonBg, borderColor: theme.cardBorder },
                  isFerie && { backgroundColor: theme.ferieBadgeBg },
                ]}
                onPress={() => setIsFerie(!isFerie)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.ferieToggleBtnText,
                    { color: isFerie ? "#ffffff" : theme.textPrimary },
                  ]}
                >
                  {isFerie ? "✓ Merka som Ferie (🏖️)" : "🏖️ Merk denne dagen som Ferie"}
                </Text>
              </TouchableOpacity>

              {!isFerie && (
                <>
                  {/* 2. VAKTBYTTE (LILLA 🔄) */}
                  <View style={styles.sectionHeader}>
                    <View style={[styles.symbolBadgeSmall, { backgroundColor: theme.bytteBadgeBg }]}>
                      <Text style={styles.symbolBadgeSmallText}>🔄</Text>
                    </View>
                    <Text style={[styles.modalSectionTitle, { color: theme.textSecondary }]}>
                      Vaktbytte (velg vakt du bytte til):
                    </Text>
                  </View>
                  <View style={styles.chipsRow}>
                    {getShiftTypesForPlan(activePlan).map((s) => {
                      const isSelected = bytteShift === s;
                      const sc = getShiftColor(s, isDark);
                      return (
                        <TouchableOpacity
                          key={s}
                          style={[
                            styles.overrideChip,
                            { backgroundColor: sc.bg, borderColor: sc.border },
                            isSelected && {
                              backgroundColor: theme.bytteBadgeBg,
                              borderColor: theme.bytteBadgeBg,
                              borderWidth: 2,
                            },
                          ]}
                          onPress={() => setBytteShift(isSelected ? null : s)}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.overrideChipText,
                              { color: isSelected ? "#ffffff" : sc.text },
                            ]}
                          >
                            {s}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* 3. OVERTID (ORANSJE ⚡) */}
                  <View style={styles.sectionHeader}>
                    <View style={[styles.symbolBadgeSmall, { backgroundColor: theme.overtidBadgeBg }]}>
                      <Text style={styles.symbolBadgeSmallText}>⚡</Text>
                    </View>
                    <Text style={[styles.modalSectionTitle, { color: theme.textSecondary }]}>
                      Overtid / Ekstravakt (velg vakt du tok):
                    </Text>
                  </View>
                  <View style={styles.chipsRow}>
                    {getShiftTypesForPlan(activePlan).filter((s) => s !== "Fri").map((s) => {
                      const isSelected = overtidShift === s;
                      const sc = getShiftColor(s, isDark);
                      return (
                        <TouchableOpacity
                          key={s}
                          style={[
                            styles.overrideChip,
                            { backgroundColor: sc.bg, borderColor: sc.border },
                            isSelected && {
                              backgroundColor: theme.overtidBadgeBg,
                              borderColor: theme.overtidBadgeBg,
                              borderWidth: 2,
                            },
                          ]}
                          onPress={() => setOvertidShift(isSelected ? null : s)}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.overrideChipText,
                              { color: isSelected ? "#ffffff" : sc.text },
                            ]}
                          >
                            {s}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}

              {/* 4. NOTAT */}
              <Text style={[styles.modalSectionTitle, { color: theme.textSecondary, marginTop: 10 }]}>
                📝 Notat for denne dagen:
              </Text>
              <TextInput
                style={[
                  styles.modalInput,
                  {
                    backgroundColor: theme.inputBg,
                    borderColor: theme.inputBorder,
                    color: theme.inputText,
                  },
                ]}
                value={commentText}
                onChangeText={setCommentText}
                placeholder="F.eks. bytta med Arne, tok 12t overtid..."
                placeholderTextColor={theme.textMuted}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />

              {/* Handlingsknappar */}
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.deleteButton, { borderColor: theme.cardBorder }]}
                  onPress={handleResetDay}
                  activeOpacity={0.7}
                >
                  <Text style={styles.deleteButtonText}>Nullstill dato</Text>
                </TouchableOpacity>

                <View style={styles.modalRightActions}>
                  <TouchableOpacity
                    style={[styles.cancelButton, { backgroundColor: theme.inactiveButtonBg }]}
                    onPress={() => setShowDayModal(false)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.cancelButtonText, { color: theme.inactiveButtonText }]}>
                      Avbryt
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.saveButton, { backgroundColor: theme.activeButtonBg }]}
                    onPress={handleSaveDay}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.saveButtonText, { color: theme.activeButtonText }]}>
                      Lagre
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  mainWrapper: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 12,
    paddingBottom: 40,
  },
  topToolbar: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 7,
  },
  topToolbarContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 8,
  },
  toolbarPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  toolbarPillText: {
    fontSize: 12.5,
    fontWeight: "700",
  },
  toolbarIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  toolbarIconText: {
    fontSize: 16,
  },
  selectorCard: {
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  selectorTitle: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  shiftButtonGroup: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 6,
  },
  shiftButton: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: "center",
  },
  shiftButtonText: {
    fontSize: 12,
    fontWeight: "700",
  },
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  navButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
  },
  navButtonText: {
    fontSize: 24,
    fontWeight: "bold",
    marginTop: -2,
  },
  monthTitle: {
    fontSize: 17,
    fontWeight: "bold",
    textAlign: "center",
  },
  todayHint: {
    fontSize: 11,
    textAlign: "center",
    marginTop: 2,
  },
  zoomIndicatorPill: {
    marginTop: 5,
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignSelf: "center",
  },
  zoomIndicatorText: {
    fontSize: 10.5,
    fontWeight: "700",
  },
  weekDaysRow: {
    flexDirection: "row",
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  weekNumberHeaderCell: {
    width: 26,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 2,
  },
  weekNumberHeaderText: {
    fontSize: 11,
    fontWeight: "800",
  },
  weekDayCell: {
    flex: 1,
    alignItems: "center",
  },
  weekDayText: {
    fontSize: 12,
    fontWeight: "700",
  },
  gridContainer: {
    borderRadius: 14,
    padding: 3,
    marginBottom: 14,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  weekRow: {
    flexDirection: "row",
    marginBottom: 3,
  },
  weekNumberCell: {
    width: 26,
    height: 58,
    borderRadius: 6,
    marginRight: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  weekNumberText: {
    fontSize: 11,
    fontWeight: "700",
  },
  dayCell: {
    flex: 1,
    height: 58,
    borderRadius: 8,
    borderWidth: 1,
    marginHorizontal: 1.5,
    padding: 2,
    justifyContent: "space-between",
  },
  compareDayCell: {
    padding: 2,
    justifyContent: "flex-start",
  },
  compareShiftsList: {
    flex: 1,
    justifyContent: "center",
    gap: 2,
  },
  compareShiftPill: {
    borderRadius: 4,
    paddingVertical: 1,
    paddingHorizontal: 2,
    borderWidth: 0.5,
  },
  compareShiftPillText: {
    fontSize: 9,
    fontWeight: "700",
    textAlign: "center",
  },
  dayHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dayNumberContainer: {
    width: 17,
    height: 17,
    borderRadius: 8.5,
    justifyContent: "center",
    alignItems: "center",
  },
  dayNumberText: {
    fontSize: 10,
    fontWeight: "700",
  },
  dayNumberOutside: {
    fontSize: 11,
    padding: 2,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 1.5,
  },
  symbolBadge: {
    width: 14,
    height: 14,
    borderRadius: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  symbolBadgeText: {
    fontSize: 8,
  },
  commentIndicator: {
    fontSize: 8,
  },
  shiftText: {
    fontSize: 10.5,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 1,
  },
  legendContainer: {
    borderRadius: 14,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  legendTitle: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  legendGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    width: "48%",
    marginBottom: 8,
  },
  legendColorBox: {
    width: 14,
    height: 14,
    borderRadius: 4,
    borderWidth: 1,
    marginRight: 6,
    marginTop: 2,
  },
  legendTextContainer: {
    flex: 1,
  },
  legendText: {
    fontSize: 12,
    fontWeight: "600",
  },
  legendTimeText: {
    fontSize: 10,
    marginTop: 1,
  },
  symbolLegendRow: {
    flexDirection: "row",
    gap: 14,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#cbd5e1",
  },
  symbolLegendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  symbolBadgeLarge: {
    width: 18,
    height: 18,
    borderRadius: 5,
    justifyContent: "center",
    alignItems: "center",
  },
  symbolBadgeLargeText: {
    fontSize: 10,
  },
  symbolLegendLabel: {
    fontSize: 11,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalCard: {
    width: "100%",
    maxWidth: 400,
    maxHeight: "90%",
    borderRadius: 20,
    padding: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
  },
  modalDate: {
    fontSize: 16,
    fontWeight: "bold",
    textTransform: "capitalize",
    marginBottom: 8,
  },
  modalInfoBox: {
    padding: 8,
    borderRadius: 8,
    marginBottom: 10,
  },
  modalOriginalShiftText: {
    fontSize: 13,
  },
  modalTimeText: {
    fontSize: 12,
    marginTop: 2,
  },
  ferieToggleBtn: {
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 1,
    marginBottom: 10,
  },
  ferieToggleBtnText: {
    fontSize: 13,
    fontWeight: "700",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 6,
    marginBottom: 6,
  },
  symbolBadgeSmall: {
    width: 16,
    height: 16,
    borderRadius: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  symbolBadgeSmallText: {
    fontSize: 9,
  },
  modalSectionTitle: {
    fontSize: 12,
    fontWeight: "700",
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 6,
  },
  overrideChip: {
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 8,
    borderWidth: 1,
  },
  overrideChipText: {
    fontSize: 11,
    fontWeight: "700",
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    fontSize: 13,
    height: 65,
    marginBottom: 14,
    marginTop: 4,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalRightActions: {
    flexDirection: "row",
    gap: 8,
  },
  deleteButton: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  deleteButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#ef4444",
  },
  cancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  cancelButtonText: {
    fontSize: 13,
    fontWeight: "600",
  },
  saveButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  saveButtonText: {
    fontSize: 13,
    fontWeight: "700",
  },
});

export default Calendar;
