import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Switch,
  Alert,
  ActivityIndicator,
} from "react-native";
import { getShiftColor } from "./theme";
import { isRunningInExpoGo } from "expo";
import {
  calculateUpcomingAlarms,
  triggerTestAlarm,
  DEFAULT_ALARM_CONFIG,
  getNextUpcomingShiftAlarm,
  setNativeClockAlarm,
  openNativeClockApp,
} from "./alarmService";

const SHIFTS_WITH_ALARM = [
  { shift: "Fm", defaultTime: "05:30", note: "Standard vaktstart 07:00" },
  { shift: "Em", defaultTime: "12:30", note: "Standard vaktstart 15:00" },
  { shift: "N", defaultTime: "20:00", note: "Standard vaktstart 23:00" },
  { shift: "12tFm", defaultTime: "05:00", note: "Standard vaktstart 07:00" },
  { shift: "12tN", defaultTime: "16:30", note: "Standard vaktstart 19:00" },
];

const AlarmModal = ({
  visible,
  onClose,
  alarmConfig = DEFAULT_ALARM_CONFIG,
  onSaveAlarmConfig,
  shiftGroup,
  overrides,
  theme,
  isDark,
}) => {
  const [localConfig, setLocalConfig] = useState(alarmConfig);
  const [saving, setSaving] = useState(false);
  const [testPlaying, setTestPlaying] = useState(false);

  useEffect(() => {
    if (visible) {
      setLocalConfig(alarmConfig);
    }
  }, [visible, alarmConfig]);

  const handleToggleMaster = (val) => {
    setLocalConfig((prev) => ({
      ...prev,
      enabled: val,
    }));
  };

  const handleToggleShiftAlarm = (shift, val) => {
    setLocalConfig((prev) => {
      const cur = prev.times?.[shift] || { enabled: false, time: "05:30" };
      return {
        ...prev,
        times: {
          ...prev.times,
          [shift]: {
            ...cur,
            enabled: val,
          },
        },
      };
    });
  };

  const handleChangeTime = (shift, newTime) => {
    setLocalConfig((prev) => {
      const cur = prev.times?.[shift] || { enabled: true, time: "05:30" };
      return {
        ...prev,
        times: {
          ...prev.times,
          [shift]: {
            ...cur,
            time: newTime,
          },
        },
      };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSaveAlarmConfig(localConfig);
      Alert.alert(
        "Alarmar oppdaterte! ⏰",
        localConfig.enabled
          ? "Skiftalarm er aktivert. Vekkeklokka justerer seg automatisk etter vaktene dine dei neste 14 dagane."
          : "Skiftalarm er slått av. Alle planlagde vekkeklokker er kansellerte."
      );
      onClose();
    } catch (err) {
      Alert.alert("Feil", err.message || "Kunne ikkje lagre alarminnstillingar.");
    } finally {
      setSaving(false);
    }
  };

  const handleTestAlarm = async () => {
    setTestPlaying(true);
    const ok = await triggerTestAlarm();
    setTestPlaying(false);
    if (ok) {
      Alert.alert("Test sendt!", "Testalarmen skal ringe om ca. 2 sekund.");
    }
  };

  // Rekn ut dei neste 7 dagane for førehandsvising
  const upcomingPreview = calculateUpcomingAlarms({
    shiftGroup,
    overrides,
    alarmConfig: localConfig,
    daysAhead: 7,
  });

  // Finn neste komande vakt med vekketid
  const nextAlarm = getNextUpcomingShiftAlarm({
    shiftGroup,
    overrides,
    alarmConfig: localConfig,
  });

  const handleSetNativeAlarm = async (targetItem) => {
    const item = targetItem || nextAlarm;
    if (!item?.alarmTime) {
      Alert.alert("Ingen vekketid", "Fann ingen aktiv vekketid for denne vakta.");
      return;
    }
    const [h, m] = item.alarmTime.split(":");
    await setNativeClockAlarm({
      hour: h,
      minutes: m,
      message: `Vakt: ${item.shift} (${item.dayName})`,
      skipUi: false,
    });
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
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={{ fontSize: 20 }}>⏰</Text>
              <Text style={[styles.title, { color: theme.textPrimary }]}>
                Smart Skiftalarm
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={[styles.closeIcon, { color: theme.textSecondary }]}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {(() => {
              let inExpoGo = false;
              try {
                inExpoGo = typeof isRunningInExpoGo === "function" && isRunningInExpoGo();
              } catch {}
              if (!inExpoGo) return null;
              return (
                <View
                  style={{
                    backgroundColor: isDark ? "#451a03" : "#fef3c7",
                    borderColor: isDark ? "#78350f" : "#fde68a",
                    borderWidth: 1,
                    padding: 10,
                    borderRadius: 8,
                    marginBottom: 12,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      color: isDark ? "#fde68a" : "#92400e",
                      lineHeight: 17,
                    }}
                  >
                    ℹ️ <Text style={{ fontWeight: "bold" }}>Expo Go:</Text> Frå SDK 53 støttar ikkje Expo Go bakgrunnsalarmar på Android. Vekkeklokke og widgets fungerer fullt ut i ein eigen APK (med "eas build").
                  </Text>
                </View>
              );
            })()}

            {/* HOVUDBRYTAR */}
            <View style={[styles.masterSwitchBox, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={[styles.masterTitle, { color: theme.textPrimary }]}>
                  Slå på automatisk vekking
                </Text>
                <Text style={[styles.masterSubtitle, { color: theme.textSecondary }]}>
                  Vekkjer deg automatisk til rett tid for vakta di. Alltid stille på fridagar og i ferien!
                </Text>
              </View>
              <Switch
                value={localConfig.enabled}
                onValueChange={handleToggleMaster}
                trackColor={{ false: theme.cardBorder, true: "#0284c7" }}
                thumbColor={localConfig.enabled ? "#ffffff" : "#f4f3f4"}
              />
            </View>

            {/* HURTIGKNAPP: STILL I TELEFONEN SI KLOKKE-APP */}
            <View
              style={[
                styles.nativeClockCard,
                {
                  backgroundColor: isDark ? "#0f172a" : "#f0fdf4",
                  borderColor: isDark ? "#1e293b" : "#bbf7d0",
                },
              ]}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <Text style={{ fontSize: 16 }}>📱</Text>
                <Text style={[styles.nativeClockTitle, { color: isDark ? "#38bdf8" : "#15803d" }]}>
                  Telefonen si Klokke-app (Ekte vekkeklokke)
                </Text>
              </View>
              <Text style={[styles.nativeClockSubtitle, { color: theme.textSecondary }]}>
                Still inn vekkeklokke i Samsung / Google Klokke med full alarmlyd og slumring:
              </Text>

              {nextAlarm ? (
                <View style={styles.nativeClockNextBox}>
                  <Text style={[styles.nativeClockNextLabel, { color: theme.textPrimary }]}>
                    Neste vakt:{" "}
                    <Text style={{ fontWeight: "bold" }}>
                      {nextAlarm.dayName} ({nextAlarm.shift})
                    </Text>
                  </Text>
                  <TouchableOpacity
                    style={styles.nativeClockSetBtn}
                    onPress={() => handleSetNativeAlarm(nextAlarm)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.nativeClockSetBtnText}>
                      ⏰ Still vekkeklokke for neste vakt (kl. {nextAlarm.alarmTime})
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <Text style={[styles.nativeClockMuted, { color: theme.textMuted }]}>
                  Ingen kommande vakt med aktiv vekketid dei neste dagane.
                </Text>
              )}

              <TouchableOpacity
                style={[styles.nativeClockOpenBtn, { borderColor: theme.cardBorder }]}
                onPress={openNativeClockApp}
                activeOpacity={0.7}
              >
                <Text style={[styles.nativeClockOpenBtnText, { color: theme.textSecondary }]}>
                  🕒 Opna Klokke-appen på mobilen
                </Text>
              </TouchableOpacity>
            </View>

            {/* TIDSPUNKT PER VAKTTYPE */}
            <Text style={[styles.sectionTitle, { color: theme.textPrimary, marginTop: 14 }]}>
              Vekketider per vakttype:
            </Text>

            <View style={styles.shiftTimesList}>
              {SHIFTS_WITH_ALARM.map((item) => {
                const conf = localConfig.times?.[item.shift] || {
                  enabled: true,
                  time: item.defaultTime,
                };
                const sc = getShiftColor(item.shift, isDark);

                return (
                  <View
                    key={item.shift}
                    style={[
                      styles.shiftAlarmRow,
                      {
                        backgroundColor: theme.inputBg,
                        borderColor: theme.inputBorder,
                        opacity: localConfig.enabled ? 1 : 0.6,
                      },
                    ]}
                  >
                    {/* Vaktmerke */}
                    <View
                      style={[
                        styles.shiftBadge,
                        { backgroundColor: sc.bg, borderColor: sc.border },
                      ]}
                    >
                      <Text style={[styles.shiftBadgeText, { color: sc.text }]}>
                        {item.shift}
                      </Text>
                    </View>

                    {/* Vaktinfo */}
                    <View style={styles.shiftInfoCol}>
                      <Text style={[styles.shiftName, { color: theme.textPrimary }]}>
                        {item.shift === "Fm"
                          ? "Formiddag"
                          : item.shift === "Em"
                          ? "Ettermiddag"
                          : item.shift === "N"
                          ? "Natt"
                          : item.shift === "12tFm"
                          ? "12t Formiddag"
                          : "12t Natt"}
                      </Text>
                      <Text style={[styles.shiftNote, { color: theme.textMuted }]}>
                        {item.note}
                      </Text>
                    </View>

                    {/* Tid-input */}
                    <View style={styles.timeInputBox}>
                      <TextInput
                        style={[
                          styles.timeInput,
                          {
                            backgroundColor: theme.cardBg,
                            borderColor: theme.cardBorder,
                            color: theme.textPrimary,
                          },
                        ]}
                        value={conf.time}
                        onChangeText={(txt) => handleChangeTime(item.shift, txt)}
                        placeholder="05:30"
                        placeholderTextColor={theme.textMuted}
                        maxLength={5}
                        keyboardType="numbers-and-punctuation"
                        editable={localConfig.enabled && conf.enabled}
                      />
                    </View>

                    {/* Brytar for denne vakta */}
                    <Switch
                      value={Boolean(conf.enabled)}
                      onValueChange={(val) => handleToggleShiftAlarm(item.shift, val)}
                      disabled={!localConfig.enabled}
                      trackColor={{ false: theme.cardBorder, true: "#0284c7" }}
                      thumbColor={conf.enabled ? "#ffffff" : "#f4f3f4"}
                    />
                  </View>
                );
              })}
            </View>

            {/* KOMMANDE ALARMAR DE NÆRASTE DAGANE */}
            <Text style={[styles.sectionTitle, { color: theme.textPrimary, marginTop: 16 }]}>
              Planlagde vekkinger dei neste 7 dagane:
            </Text>

            <View style={[styles.previewContainer, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}>
              {upcomingPreview.map((item) => {
                const sc = getShiftColor(item.shift, isDark);
                return (
                  <View key={item.dateStr} style={[styles.previewRow, { borderBottomColor: theme.cardBorder }]}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <View style={[styles.previewPill, { backgroundColor: sc.bg, borderColor: sc.border }]}>
                        <Text style={[styles.previewPillText, { color: sc.text }]}>
                          {item.shift}
                        </Text>
                      </View>
                      <Text style={[styles.previewDayText, { color: theme.textPrimary }]}>
                        {item.dayName}
                      </Text>
                    </View>

                    <View>
                      {item.alarmActive ? (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <View style={[styles.activeAlarmBadge, { backgroundColor: isDark ? "#14532d" : "#dcfce7" }]}>
                            <Text style={[styles.activeAlarmText, { color: isDark ? "#86efac" : "#15803d" }]}>
                              ⏰ {item.alarmTime}
                            </Text>
                          </View>
                          <TouchableOpacity
                            style={[styles.smallClockBtn, { backgroundColor: isDark ? "#0369a1" : "#e0f2fe" }]}
                            onPress={() => handleSetNativeAlarm(item)}
                            activeOpacity={0.7}
                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                          >
                            <Text style={[styles.smallClockBtnText, { color: isDark ? "#e0f2fe" : "#0369a1" }]}>
                              📱 Still
                            </Text>
                          </TouchableOpacity>
                        </View>
                      ) : item.isFerie ? (
                        <Text style={[styles.inactiveAlarmText, { color: "#06b6d4" }]}>
                          🏖️ Ferie (Stille)
                        </Text>
                      ) : item.shift === "Fri" ? (
                        <Text style={[styles.inactiveAlarmText, { color: theme.textMuted }]}>
                          🔕 Fri (Stille)
                        </Text>
                      ) : (
                        <Text style={[styles.inactiveAlarmText, { color: theme.textMuted }]}>
                          Avslått
                        </Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>

            {/* TEST ALARM KNAPP */}
            <TouchableOpacity
              style={[styles.testBtn, { backgroundColor: theme.inactiveButtonBg, borderColor: theme.cardBorder }]}
              onPress={handleTestAlarm}
              disabled={testPlaying}
              activeOpacity={0.7}
            >
              {testPlaying ? (
                <ActivityIndicator size="small" color={theme.textPrimary} />
              ) : (
                <Text style={[styles.testBtnText, { color: theme.textPrimary }]}>
                  🔔 Test alarm no (ringer om 2 sek)
                </Text>
              )}
            </TouchableOpacity>

            {/* LAGRE-KNAPP */}
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: theme.activeButtonBg }]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.8}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.saveBtnText}>Lagre og oppdater alarmar</Text>
              )}
            </TouchableOpacity>
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
    maxHeight: "92%",
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
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
  },
  closeIcon: {
    fontSize: 18,
    fontWeight: "bold",
    padding: 4,
  },
  masterSwitchBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  masterTitle: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 3,
  },
  masterSubtitle: {
    fontSize: 11.5,
    lineHeight: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  shiftTimesList: {
    gap: 8,
  },
  shiftAlarmRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  shiftBadge: {
    width: 50,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  shiftBadgeText: {
    fontSize: 12,
    fontWeight: "bold",
  },
  shiftInfoCol: {
    flex: 1,
  },
  shiftName: {
    fontSize: 13,
    fontWeight: "700",
  },
  shiftNote: {
    fontSize: 10.5,
  },
  timeInputBox: {
    marginRight: 10,
  },
  timeInput: {
    width: 64,
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderRadius: 8,
    borderWidth: 1,
    textAlign: "center",
    fontSize: 13,
    fontWeight: "700",
  },
  previewContainer: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 12,
  },
  previewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  previewPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  previewPillText: {
    fontSize: 10.5,
    fontWeight: "bold",
  },
  previewDayText: {
    fontSize: 12,
    fontWeight: "600",
  },
  activeAlarmBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  activeAlarmText: {
    fontSize: 11.5,
    fontWeight: "700",
  },
  inactiveAlarmText: {
    fontSize: 11,
    fontWeight: "600",
  },
  testBtn: {
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  testBtnText: {
    fontSize: 12.5,
    fontWeight: "700",
  },
  saveBtn: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  saveBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  nativeClockCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    marginBottom: 4,
  },
  nativeClockTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  nativeClockSubtitle: {
    fontSize: 11.5,
    lineHeight: 16,
    marginBottom: 10,
  },
  nativeClockNextBox: {
    marginBottom: 8,
  },
  nativeClockNextLabel: {
    fontSize: 12.5,
    marginBottom: 6,
  },
  nativeClockSetBtn: {
    backgroundColor: "#0284c7",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  nativeClockSetBtnText: {
    color: "#ffffff",
    fontSize: 12.5,
    fontWeight: "700",
  },
  nativeClockOpenBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 7,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  nativeClockOpenBtnText: {
    fontSize: 11.5,
    fontWeight: "600",
  },
  nativeClockMuted: {
    fontSize: 11.5,
    fontStyle: "italic",
    marginBottom: 6,
  },
  smallClockBtn: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 5,
  },
  smallClockBtnText: {
    fontSize: 10.5,
    fontWeight: "700",
  },
});

export default AlarmModal;
