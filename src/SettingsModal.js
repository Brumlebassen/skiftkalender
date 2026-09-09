import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";

export const DEFAULT_SHIFT_TIMES = {
  Fm: "07:00 - 15:00",
  Em: "15:00 - 23:00",
  N: "23:00 - 07:00",
  "12tFm": "07:00 - 19:00",
  "12tN": "19:00 - 07:00",
  Fri: "Fri",
};

const SettingsModal = ({
  visible,
  onClose,
  shiftTimes,
  onSaveShiftTimes,
  theme,
}) => {
  const [localTimes, setLocalTimes] = useState(DEFAULT_SHIFT_TIMES);

  useEffect(() => {
    if (shiftTimes) {
      setLocalTimes({ ...DEFAULT_SHIFT_TIMES, ...shiftTimes });
    }
  }, [shiftTimes, visible]);

  const handleChange = (shiftKey, value) => {
    setLocalTimes((prev) => ({ ...prev, [shiftKey]: value }));
  };

  const handleReset = () => {
    setLocalTimes(DEFAULT_SHIFT_TIMES);
  };

  const handleSave = () => {
    onSaveShiftTimes(localTimes);
    onClose();
  };

  const shiftLabels = [
    { key: "Fm", name: "Formiddag (Fm)" },
    { key: "Em", name: "Ettermiddag (Em)" },
    { key: "N", name: "Natt (N)" },
    { key: "12tFm", name: "12t Formiddag (12tFm)" },
    { key: "12tN", name: "12t Natt (12tN)" },
    { key: "Fri", name: "Fridag (Fri)" },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={[styles.overlay, { backgroundColor: theme.modalOverlay }]}
      >
        <View style={[styles.card, { backgroundColor: theme.cardBg }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.textPrimary }]}>
              ⚙️ Innstillinger for klokkeslett
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={[styles.closeIcon, { color: theme.textSecondary }]}>✕</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Her kan du justere standard arbeidstid for kvart skift. Dette visast når du trykkjer på ein dag i kalenderen.
          </Text>

          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {shiftLabels.map(({ key, name }) => (
              <View key={key} style={styles.row}>
                <Text style={[styles.label, { color: theme.textPrimary }]}>{name}</Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.inputBg,
                      borderColor: theme.inputBorder,
                      color: theme.inputText,
                    },
                  ]}
                  value={localTimes[key] || ""}
                  onChangeText={(val) => handleChange(key, val)}
                  placeholder="f.eks. 07:00 - 15:00"
                  placeholderTextColor={theme.textMuted}
                />
              </View>
            ))}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.resetButton, { borderColor: theme.cardBorder }]}
              onPress={handleReset}
              activeOpacity={0.7}
            >
              <Text style={[styles.resetButtonText, { color: theme.textSecondary }]}>
                Standard
              </Text>
            </TouchableOpacity>

            <View style={styles.rightButtons}>
              <TouchableOpacity
                style={[styles.cancelButton, { backgroundColor: theme.inactiveButtonBg }]}
                onPress={onClose}
                activeOpacity={0.7}
              >
                <Text style={[styles.cancelButtonText, { color: theme.inactiveButtonText }]}>
                  Avbryt
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveButton, { backgroundColor: theme.activeButtonBg }]}
                onPress={handleSave}
                activeOpacity={0.7}
              >
                <Text style={[styles.saveButtonText, { color: theme.activeButtonText }]}>
                  Lagre tider
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
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
    maxWidth: 420,
    maxHeight: "85%",
    borderRadius: 20,
    padding: 20,
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
    marginBottom: 6,
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
  subtitle: {
    fontSize: 12,
    marginBottom: 16,
    lineHeight: 16,
  },
  list: {
    marginBottom: 16,
  },
  row: {
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#cbd5e1",
  },
  resetButton: {
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  resetButtonText: {
    fontSize: 12,
    fontWeight: "600",
  },
  rightButtons: {
    flexDirection: "row",
    gap: 8,
  },
  cancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
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

export default SettingsModal;
