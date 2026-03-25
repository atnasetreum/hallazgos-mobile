import Toast from "react-native-toast-message";

export const notify = (message: string, success?: boolean) => {
  if (success) {
    Toast.show({
      type: "success",
      text1: "¡ Correcto !",
      text2: message,
      visibilityTime: 7000,
    });
    return;
  }

  Toast.show({
    type: "error",
    text1: "¡ Atención !",
    text2: message,
    visibilityTime: 7000,
  });
};

export const isValidEmail = (email: string) => {
  const re = /\S+@\S+\.\S+/;
  return re.test(email);
};
