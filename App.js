import React, { useState, useEffect } from "react";
import { StyleSheet, View, Text, TouchableOpacity, useColorScheme } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Calendar from "./src/Calendar";
import { getTheme } from "./src/theme";

const THEME_PREF_KEY = "@themePreference";

export default function App() {
  const systemColorScheme = useColorScheme();
  const [isDark, setIsDark] = useState(systemColorScheme === "dark");

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const saved = await AsyncStorage.getItem(THEME_PREF_KEY);
        if (saved !== null) {
          setIsDark(saved === "dark");
        } else {
          setIsDark(systemColorScheme === "dark");
        }
      } catch (err) {
        console.warn("Kunne ikke laste temainnstilling:", err);
      }
    };
    loadTheme();
  }, [systemColorScheme]);

  const toggleTheme = async () => {
    const nextVal = !isDark;
    setIsDark(nextVal);
    try {
      await AsyncStorage.setItem(THEME_PREF_KEY, nextVal ? "dark" : "light");
    } catch (err) {
      console.warn("Kunne ikke lagre temainnstilling:", err);
    }
  };

  const theme = getTheme(isDark);

  return (
    <SafeAreaProvider>
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.bg }]}
        edges={["top", "left", "right"]}
      >
        <StatusBar style={isDark ? "light" : "dark"} />
        <View
          style={[
            styles.header,
            { backgroundColor: theme.headerBg, borderBottomColor: theme.headerBorder },
          ]}
        >
          <Text style={[styles.title, { color: theme.textPrimary }]}>
            Skiftkalender
          </Text>
          <TouchableOpacity
            onPress={toggleTheme}
            style={[styles.themeBtn, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.themeBtnText}>{isDark ? "☀️" : "🌙"}</Text>
          </TouchableOpacity>
        </View>
        <Calendar isDark={isDark} toggleTheme={toggleTheme} />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  themeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  themeBtnText: {
    fontSize: 18,
  },
});
