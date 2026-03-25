import { useEffect, useMemo, useState } from "react";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { StatusBar } from "expo-status-bar";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import {
  MD3LightTheme as DefaultTheme,
  PaperProvider,
} from "react-native-paper";
import Toast from "react-native-toast-message";

import { appConfig } from "./src/constants/app";
import { AuthService } from "./src/services/auth.service";
import { notify } from "./src/utils";
import { AuthScreen } from "./src/screens/AuthScreen";
import { HallazgosScreen } from "./src/screens/HallazgosScreen";

export default function App() {
  const [forgotPassword, setForgotPassword] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const theme = useMemo(
    () => ({
      ...DefaultTheme,
      roundness: 10,
      colors: {
        ...DefaultTheme.colors,
        primary: "#71BF44",
        secondary: "#9c27b0",
        background: "#f3f4f6",
        surface: "#ffffff",
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
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <StatusBar style="dark" />
        <SafeAreaView
          style={styles.safeArea}
          edges={["top", "left", "right", "bottom"]}
        >
          {!isReady ? (
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="large" color="#71BF44" />
            </View>
          ) : isAuthenticated ? (
            <HallazgosScreen onLogout={handleLogout} />
          ) : (
            <KeyboardAvoidingView
              style={styles.flex}
              behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
              <ScrollView
                contentContainerStyle={styles.scroll}
                keyboardShouldPersistTaps="handled"
              >
                <View style={styles.container}>
                  <AuthScreen
                    forgotPassword={forgotPassword}
                    setForgotPassword={setForgotPassword}
                    onLoginSuccess={() => setIsAuthenticated(true)}
                  />
                </View>
              </ScrollView>
            </KeyboardAvoidingView>
          )}
        </SafeAreaView>
        <Toast />
      </PaperProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f3f4f6",
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
  loaderContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
