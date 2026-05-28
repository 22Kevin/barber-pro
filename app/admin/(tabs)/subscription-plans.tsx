import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function SubscriptionPlansScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Planos de Assinatura</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0A0A0A" },
  text: { color: "#fff", fontSize: 18 },
});
