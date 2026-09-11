import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { startOfMonth, endOfMonth, addMonths, startOfYear, endOfYear } from "date-fns";
import {
  syncShiftsToDevice,
  deleteShiftCalendar,
  shareAsIcsFile,
  shareMonthAsText,
  getAvailableCalendars,
} from "./calendarSyncService";

const SyncShareModal = ({
  visible,
  onClose,
  currentMonth,
  shiftGroup,
  getShiftForDate,
  overrides,
  comments,
  shiftTimes,
  theme,
  isDark,
  activePlan,
}) => {
  const [syncPeriod, setSyncPeriod] = useState("3months"); // '1month' | '3months' | 'year'
  const [includeFri, setIncludeFri] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusInfo, setStatusInfo] = useState(null);
  const [availableCalendars, setAvailableCalendars] = useState([]);
  const [selectedCalendarId, setSelectedCalendarId] = useState("dedicated"); // 'dedicated' | calendarId
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    if (visible) {
      loadCalendars();
    }
  }, [visible]);

  const loadCalendars = async () => {
    try {
      const cals = await getAvailableCalendars();
      setAvailableCalendars(cals);
    } catch {
      // Ignorer permission denial her, vert handtert ved trykk
    }
  };

  const getDatesForPeriod = () => {
    if (syncPeriod === "1month") {
      return {
        startDate: startOfMonth(currentMonth),
        endDate: endOfMonth(currentMonth),
      };
    } else if (syncPeriod === "3months") {
      return {
        startDate: startOfMonth(currentMonth),
        endDate: endOfMonth(addMonths(currentMonth, 2)),
      };
    } else {
      return {
        startDate: startOfYear(currentMonth),
        endDate: endOfYear(currentMonth),
      };
    }
  };

  const handleSync = async () => {
    setLoading(true);
    setStatusInfo(null);
    try {
      const { startDate, endDate } = getDatesForPeriod();
      const targetId = selectedCalendarId === "dedicated" ? null : selectedCalendarId;

      const result = await syncShiftsToDevice({
        startDate,
        endDate,
        shiftGroup,
        getShiftForDate,
        overrides,
        comments,
        shiftTimes,
        includeFridager: includeFri,
        targetCalendarId: targetId,
        activePlan,
      });

      setStatusInfo({
        text: `✓ Vellykka! ${result.count} vakter vart lagt inn i «${result.calendarTitle}».`,
        isDedicated: result.isDedicated,
        calendarTitle: result.calendarTitle,
      });
      setShowHelp(result.isDedicated);
    } catch (err) {
      Alert.alert("Kunne ikkje synkronisere", err.message || "Eit problem oppstod.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    Alert.alert(
      "Fjern Skiftkalender",
      "Vil du fjerne alle synkroniserte vakter og slette «Skiftkalender» frå telefonen?",
      [
        { text: "Avbryt", style: "cancel" },
        {
          text: "Slett",
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            try {
              const deleted = await deleteShiftCalendar();
              if (deleted) {
                setStatusMessage("✓ «Skiftkalender» vart fjerna frå telefonen.");
              } else {
                setStatusMessage("Ingen «Skiftkalender» vart funnen på telefonen.");
              }
            } catch (err) {
              Alert.alert("Feil", err.message);
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleShareIcs = async () => {
    setLoading(true);
    try {
      const { startDate, endDate } = getDatesForPeriod();
      await shareAsIcsFile({
        startDate,
        endDate,
        shiftGroup,
        getShiftForDate,
        overrides,
        comments,
        shiftTimes,
        activePlan,
      });
    } catch (err) {
      if (!err.message?.includes("User cancelled")) {
        Alert.alert("Delingsfeil", err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleShareText = async () => {
    try {
      await shareMonthAsText({
        currentMonth,
        shiftGroup,
        getShiftForDate,
        overrides,
        comments,
        activePlan,
      });
    } catch (err) {
      Alert.alert("Feil", err.message);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, { backgroundColor: theme.modalOverlay }]}>
        <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.textPrimary }]}>
              📲 Synkronisering og Deling
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={[styles.closeIcon, { color: theme.textSecondary }]}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Statusmelding */}
            {statusInfo && (
              <View style={[styles.statusBox, { backgroundColor: isDark ? "#14532d" : "#dcfce7" }]}>
                <Text style={[styles.statusText, { color: isDark ? "#86efac" : "#15803d" }]}>
                  {statusInfo.text}
                </Text>
              </View>
            )}

            {/* Hjelpetips for Google Kalender */}
            {(showHelp || statusInfo?.isDedicated) && (
              <View
                style={[
                  styles.tipCard,
                  {
                    backgroundColor: isDark ? "#1e293b" : "#eff6ff",
                    borderColor: isDark ? "#334155" : "#bfdbfe",
                  },
                ]}
              >
                <Text style={[styles.tipTitle, { color: isDark ? "#93c5fd" : "#1d4ed8" }]}>
                  💡 Finn du ikkje «Skiftkalender» i Google Kalender?
                </Text>
                <Text style={[styles.tipStep, { color: theme.textSecondary }]}>
                  1. Opne Google Kalender-appen på telefonen.
                </Text>
                <Text style={[styles.tipStep, { color: theme.textSecondary }]}>
                  2. Trykk på meny-ikonet (≡ øvst til venstre).
                </Text>
                <Text style={[styles.tipStep, { color: theme.textSecondary }]}>
                  3. Trykk «Oppdater» (eller dra ned for å oppdatere).
                </Text>
                <Text style={[styles.tipStep, { color: theme.textSecondary }]}>
                  4. Viss den framleis ikkje visest: Scroll heilt ned til «Innstillingar» i menyen ➔ trykk «Vis fleire» under kontoen din ➔ trykk «Skiftkalender» og slå på «Synkroniser».
                </Text>
              </View>
            )}

            {/* SEKSJON 1: SYNKRONISER TIL TELEFON */}
            <View style={[styles.sectionBox, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}>
              <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
                📅 Synkroniser til telefonens kalender
              </Text>
              <Text style={[styles.sectionDesc, { color: theme.textSecondary }]}>
                Legg vaktene dine inn i Google Kalender eller Apple Kalender med korrekte klokkeslett og turnustider.
              </Text>

              {/* Kalendervalg hvis telefonen har flere kontoer/kalendere */}
              {availableCalendars.length > 0 && (
                <View style={styles.calendarPickerContainer}>
                  <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
                    Vel kva kalender vaktene skal inn i:
                  </Text>
                  <View style={styles.calendarOptionsList}>
                    <TouchableOpacity
                      style={[
                        styles.calendarOptionBtn,
                        { backgroundColor: theme.inactiveButtonBg },
                        selectedCalendarId === "dedicated" && {
                          backgroundColor: theme.activeButtonBg,
                        },
                      ]}
                      onPress={() => setSelectedCalendarId("dedicated")}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.calendarOptionText,
                          {
                            color:
                              selectedCalendarId === "dedicated"
                                ? theme.activeButtonText
                                : theme.textPrimary,
                          },
                        ]}
                      >
                        ⭐ Eiga «Skiftkalender» (kan skrus av/på)
                      </Text>
                    </TouchableOpacity>

                    {availableCalendars
                      .filter((c) => c.title !== "Skiftkalender" && c.name !== "Skiftkalender")
                      .slice(0, 3)
                      .map((cal) => {
                        const isChosen = selectedCalendarId === cal.id;
                        return (
                          <TouchableOpacity
                            key={cal.id}
                            style={[
                              styles.calendarOptionBtn,
                              { backgroundColor: theme.inactiveButtonBg },
                              isChosen && { backgroundColor: theme.activeButtonBg },
                            ]}
                            onPress={() => setSelectedCalendarId(cal.id)}
                            activeOpacity={0.7}
                          >
                            <Text
                              style={[
                                styles.calendarOptionText,
                                {
                                  color: isChosen
                                    ? theme.activeButtonText
                                    : theme.textPrimary,
                                },
                              ]}
                              numberOfLines={1}
                            >
                              📁 {cal.title || cal.name}
                              {cal.source?.name ? ` (${cal.source.name})` : ""}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                  </View>
                </View>
              )}

              {/* Periode-knapper */}
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Vel periode:</Text>
              <View style={styles.periodGroup}>
                {[
                  { key: "1month", label: "1 månad" },
                  { key: "3months", label: "Neste 3 mnd" },
                  { key: "year", label: "Heile året" },
                ].map((item) => {
                  const isSelected = syncPeriod === item.key;
                  return (
                    <TouchableOpacity
                      key={item.key}
                      style={[
                        styles.periodBtn,
                        { backgroundColor: theme.inactiveButtonBg },
                        isSelected && { backgroundColor: theme.activeButtonBg },
                      ]}
                      onPress={() => setSyncPeriod(item.key)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.periodBtnText,
                          { color: isSelected ? theme.activeButtonText : theme.textPrimary },
                        ]}
                      >
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Inkluder fridager toggle */}
              <TouchableOpacity
                style={[
                  styles.toggleRow,
                  { backgroundColor: theme.inactiveButtonBg },
                  includeFri && { backgroundColor: isDark ? "#1e3a8a" : "#dbeafe" },
                ]}
                onPress={() => setIncludeFri(!includeFri)}
                activeOpacity={0.7}
              >
                <Text style={[styles.toggleText, { color: theme.textPrimary }]}>
                  {includeFri
                    ? "✓ Fridagar og ferie vert lagt inn som heldagshending"
                    : "+ Ta med fridagar som heldagshending i kalenderen"}
                </Text>
              </TouchableOpacity>

              {/* Hovedknapp for synkronisering */}
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: theme.activeButtonBg }]}
                onPress={handleSync}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.actionBtnText}>
                    ⚡ Synkroniser til Google / Apple Kalender
                  </Text>
                )}
              </TouchableOpacity>

              {/* Hjelp-knapp for Google Kalender */}
              <TouchableOpacity
                style={styles.helpToggleBtn}
                onPress={() => setShowHelp(!showHelp)}
                hitSlop={{ top: 6, bottom: 6 }}
              >
                <Text style={[styles.helpToggleText, { color: theme.activeButtonBg }]}>
                  {showHelp ? "▲ Skjul hjelp for Google Kalender" : "💡 Finn du ikkje kalenderen i Google Kalender?"}
                </Text>
              </TouchableOpacity>

              {/* Slett kalender-lenke */}
              <TouchableOpacity
                style={styles.deleteLink}
                onPress={handleDelete}
                disabled={loading}
              >
                <Text style={styles.deleteLinkText}>
                  Fjern «Skiftkalender» frå telefonen
                </Text>
              </TouchableOpacity>
            </View>

            {/* SEKSJON 2: DEL MED ANDRE */}
            <View style={[styles.sectionBox, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, marginTop: 14 }]}>
              <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
                📤 Del skiftplan med partner / familie
              </Text>
              <Text style={[styles.sectionDesc, { color: theme.textSecondary }]}>
                Gjer det enkelt for andre å sjå når du jobbar.
              </Text>

              {/* Del som ICS */}
              <TouchableOpacity
                style={[styles.shareCardBtn, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}
                onPress={handleShareIcs}
                disabled={loading}
                activeOpacity={0.7}
              >
                <Text style={styles.shareCardIcon}>📎</Text>
                <View style={styles.shareCardContent}>
                  <Text style={[styles.shareCardTitle, { color: theme.textPrimary }]}>
                    Send kalenderfil (.ics)
                  </Text>
                  <Text style={[styles.shareCardDesc, { color: theme.textMuted }]}>
                    Mottakaren kan importere alle vaktene rett inn i sin eigen kalender på iPhone eller Android.
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Del som tekst */}
              <TouchableOpacity
                style={[styles.shareCardBtn, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, marginTop: 8 }]}
                onPress={handleShareText}
                disabled={loading}
                activeOpacity={0.7}
              >
                <Text style={styles.shareCardIcon}>💬</Text>
                <View style={styles.shareCardContent}>
                  <Text style={[styles.shareCardTitle, { color: theme.textPrimary }]}>
                    Del månad som melding
                  </Text>
                  <Text style={[styles.shareCardDesc, { color: theme.textMuted }]}>
                    Lager ei ryddig veke-for-veke tekstmelding for valgt månad (for SMS, WhatsApp osb.).
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  card: {
    width: "100%",
    maxWidth: 440,
    maxHeight: "90%",
    borderRadius: 20,
    padding: 18,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  title: {
    fontSize: 17,
    fontWeight: "bold",
  },
  closeIcon: {
    fontSize: 18,
    fontWeight: "bold",
    padding: 4,
  },
  statusBox: {
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  sectionBox: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 4,
  },
  sectionDesc: {
    fontSize: 12,
    marginBottom: 12,
    lineHeight: 16,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  periodGroup: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 10,
  },
  periodBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  periodBtnText: {
    fontSize: 12,
    fontWeight: "700",
  },
  toggleRow: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  toggleText: {
    fontSize: 11.5,
    fontWeight: "600",
  },
  actionBtn: {
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#ffffff",
  },
  deleteLink: {
    marginTop: 10,
    alignItems: "center",
    paddingVertical: 4,
  },
  deleteLinkText: {
    fontSize: 11,
    color: "#ef4444",
    fontWeight: "600",
  },
  tipCard: {
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    marginBottom: 14,
  },
  tipTitle: {
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 6,
  },
  tipStep: {
    fontSize: 11.5,
    lineHeight: 16,
    marginBottom: 3,
  },
  calendarPickerContainer: {
    marginBottom: 10,
  },
  calendarOptionsList: {
    gap: 6,
  },
  calendarOptionBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  calendarOptionText: {
    fontSize: 12,
    fontWeight: "700",
  },
  helpToggleBtn: {
    alignItems: "center",
    marginTop: 8,
    paddingVertical: 4,
  },
  helpToggleText: {
    fontSize: 11.5,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  shareCardBtn: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  shareCardIcon: {
    fontSize: 24,
  },
  shareCardContent: {
    flex: 1,
  },
  shareCardTitle: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 2,
  },
  shareCardDesc: {
    fontSize: 11,
    lineHeight: 14,
  },
});

export default SyncShareModal;
