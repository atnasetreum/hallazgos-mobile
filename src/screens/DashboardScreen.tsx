import { StyleSheet, View } from "react-native";
import { Button, Text } from "react-native-paper";

interface Props {
  onLogout: () => void;
}

export const DashboardScreen = ({ onLogout }: Props) => {
  return (
    <View style={styles.container}>
      <Text variant="headlineMedium" style={styles.title}>
        Dashboard
      </Text>
      <Text variant="bodyLarge" style={styles.subtitle}>
        Inicio de sesión correctamente.
      </Text>
      <Button mode="contained" onPress={onLogout}>
        Cerrar sesión
      </Button>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    paddingTop: 32,
  },
  title: {
    fontWeight: "700",
  },
  subtitle: {
    textAlign: "center",
  },
});
