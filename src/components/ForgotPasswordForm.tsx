import { useState } from "react";

import { Button, TextInput } from "react-native-paper";
import { StyleSheet, View } from "react-native";

import { AuthService } from "../services/auth.service";
import { constants } from "../constants/app";
import { isValidEmail, notify } from "../utils";

interface Props {
  setForgotPassword: (value: boolean) => void;
}

export const ForgotPasswordForm = ({ setForgotPassword }: Props) => {
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState(
    process.env.NODE_ENV === constants.environments.development
      ? "eduardo-266@hotmail.com"
      : "",
  );

  const handleForgotPassword = async () => {
    const emailClear = email.trim();

    if (!emailClear) {
      notify("El correo electrónico es requerido");
      return;
    }

    if (!isValidEmail(emailClear)) {
      notify("El correo electrónico no es válido");
      return;
    }

    try {
      setIsLoading(true);
      const { message } = await AuthService.forgotPassword(email);
      notify(message, true);
      setForgotPassword(false);
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
      <Button
        mode="contained"
        onPress={handleForgotPassword}
        loading={isLoading}
        disabled={isLoading}
        style={styles.sendButton}
      >
        Enviar correo de recuperación
      </Button>
      <Button
        mode="text"
        onPress={() => setForgotPassword(false)}
        textColor="#4b8f2e"
      >
        Volver al login
      </Button>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginTop: 8,
    width: "100%",
    gap: 14,
  },
  sendButton: {
    marginTop: 10,
  },
});
