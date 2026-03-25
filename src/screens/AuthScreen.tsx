import { Dispatch, SetStateAction } from "react";

import { Image, StyleSheet, View } from "react-native";

import { LoginForm } from "../components/LoginForm";
import { ForgotPasswordForm } from "../components/ForgotPasswordForm";

interface Props {
  forgotPassword: boolean;
  setForgotPassword: Dispatch<SetStateAction<boolean>>;
  onLoginSuccess: () => void;
}

export const AuthScreen = ({
  forgotPassword,
  setForgotPassword,
  onLoginSuccess,
}: Props) => {
  return (
    <View style={styles.main}>
      <Image
        source={require("../../assets/images/logo-superior.png")}
        style={styles.topLogo}
        resizeMode="contain"
      />
      {!forgotPassword ? (
        <LoginForm
          setForgotPassword={setForgotPassword}
          onLoginSuccess={onLoginSuccess}
        />
      ) : (
        <ForgotPasswordForm setForgotPassword={setForgotPassword} />
      )}
      <Image
        source={require("../../assets/images/logo-inferior.png")}
        style={styles.bottomLogo}
        resizeMode="contain"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  main: {
    width: "100%",
    alignItems: "center",
  },
  topLogo: {
    width: 300,
    height: 200,
  },
  bottomLogo: {
    marginTop: 20,
    width: 330,
    height: 90,
  },
});
