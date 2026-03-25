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

export const stringToDateWithTime = (date: string | Date) => {
  const value = new Date(date);
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(value);
};

export const durationToText = (
  startDate: string | Date,
  endDate: string | Date,
) => {
  const diffMs = new Date(endDate).getTime() - new Date(startDate).getTime();

  if (diffMs <= 0) {
    return "0m";
  }

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  return `${hours ? `${hours}h ` : ""}${minutes}m`.trim();
};
