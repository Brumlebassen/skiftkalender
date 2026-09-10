import React, { useState } from "react";
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
}) => {
  const [syncPeriod, setSyncPeriod] = useState("3months"); // '1month' | '3months' | 'year'
  const [includeFri, setIncludeFri] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

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
    setStatusMessage(null);
    try {
      const { startDate, endDate } = getDatesForPeriod();
      const count = await syncShiftsToDevice({
        startDate,
        endDate,
        shiftGroup,
        getShiftForDate,
        overrides,
        comments,
        shiftTimes,
        includeFridager: includeFri,
      });

      setStatusMessage(`✓ Vellykka! ${count} vakter vart synkroniserte til «Skiftkalender» på telefonen din.`);
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
            {statusMessage && (
              <View style={[styles.statusBox, { backgroundColor: isDark ? "#14532d" : "#dcfce7" }]}>
                <Text style={[styles.statusText, { color: isDark ? "#86efac" : "#15803d" }]}>
                  {statusMessage}
                </Text>
              </View>
            )}

            {/* SEKSJON 1: SYNKRONISER TIL TELEFON */}
            <View style={[styles.sectionBox, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}>
              <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
                📅 Synkroniser til telefonens kalender
              </Text>
              <Text style={[styles.sectionDesc, { color: theme.textSecondary }]}>
                Opprettar ein eigen kalender kalla «Skiftkalender» i Google Kalender eller Apple Kalender med korrekte klokkeslett.
              </Text>

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
