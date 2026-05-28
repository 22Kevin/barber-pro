import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function PlanBookingScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Assinar Plano</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0A0A0A" },
  text: { color: "#fff", fontSize: 18 },
});
