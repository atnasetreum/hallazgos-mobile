import { useState } from "react";

import { Button, TextInput } from "react-native-paper";
import { StyleSheet, TouchableOpacity, View } from "react-native";

import { AuthService } from "../services/auth.service";
import { constants } from "../constants/app";
import { isValidEmail, notify } from "../utils";

interface Props {
  setForgotPassword: (value: boolean) => void;
  onLoginSuccess: () => void;
}

export const LoginForm = ({ setForgotPassword, onLoginSuccess }: Props) => {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState(
    process.env.NODE_ENV === constants.environments.development
      ? "eduardo-266@hotmail.com"
      : "",
  );
  const [password, setPassword] = useState(
    process.env.NODE_ENV === constants.environments.development ? "12345" : "",
  );

  const login = async () => {
    const emailClear = email.trim();
    const passwordClear = password.trim();

    if (!emailClear) {
      notify("El correo electrónico es requerido");
      return;
    }

    if (!passwordClear) {
      notify("La contraseña es requerida");
      return;
    }

    if (!isValidEmail(emailClear)) {
      notify("El correo electrónico no es válido");
      return;
    }

    try {
      setIsLoading(true);

      const { message } = await AuthService.login({
        email,
        password,
      });

      notify(message, true);
      onLoginSuccess();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.wrapper}>
      <TextInput
        mode="outlined"
        label="Correo Electrónico"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        mode="outlined"
        label="Contraseña"
        secureTextEntry={!showPassword}
        autoComplete="current-password"
        value={password}
        onChangeText={setPassword}
        right={
          <TextInput.Icon
            icon={showPassword ? "eye-off" : "eye"}
            onPress={() => setShowPassword((value) => !value)}
          />
        }
      />
      <Button
        mode="contained"
        onPress={login}
        loading={isLoading}
        disabled={isLoading}
        style={styles.loginButton}
      >
        Iniciar
      </Button>

      <TouchableOpacity onPress={() => setForgotPassword(true)}>
        <Button compact mode="text" textColor="#4b8f2e">
          ¿Has olvidado tu contraseña?
        </Button>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginTop: 8,
    width: "100%",
    gap: 14,
  },
  loginButton: {
    marginTop: 10,
  },
});
