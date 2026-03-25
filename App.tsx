import { useEffect, useMemo, useState } from "react";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { StatusBar } from "expo-status-bar";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import {
  MD3LightTheme as DefaultTheme,
  PaperProvider,
} from "react-native-paper";
import Toast from "react-native-toast-message";

import { appConfig } from "./src/constants/app";
import { AuthService } from "./src/services/auth.service";
import { notify } from "./src/utils";
import { AuthScreen } from "./src/screens/AuthScreen";
import { DashboardScreen } from "./src/screens/DashboardScreen";

export default function App() {
  const [forgotPassword, setForgotPassword] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const theme = useMemo(
    () => ({
      ...DefaultTheme,
      colors: {
        ...DefaultTheme.colors,
        primary: "#1976d2",
      },
    }),
    [],
  );

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const token = await AsyncStorage.getItem(appConfig.tokenStorageKey);

        if (!token) {
          setIsAuthenticated(false);
          return;
        }

        await AuthService.checkToken();
        setIsAuthenticated(true);
      } catch {
        await AsyncStorage.removeItem(appConfig.tokenStorageKey);
        setIsAuthenticated(false);
      } finally {
        setIsReady(true);
      }
    };

    bootstrap();
  }, []);

  const handleLogout = async () => {
    await AuthService.logout();
    setIsAuthenticated(false);
    setForgotPassword(false);
    notify("Sesión cerrada correctamente.", true);
  };

  return (
    <PaperProvider theme={theme}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.container}>
              {!isReady ? (
                <ActivityIndicator size="large" color="#1976d2" />
              ) : isAuthenticated ? (
                <DashboardScreen onLogout={handleLogout} />
              ) : (
                <AuthScreen
                  forgotPassword={forgotPassword}
                  setForgotPassword={setForgotPassword}
                  onLoginSuccess={() => setIsAuthenticated(true)}
                />
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
      <Toast />
    </PaperProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#fff",
  },
  flex: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  container: {
    width: "100%",
    maxWidth: 380,
    alignSelf: "center",
    alignItems: "center",
  },
});
