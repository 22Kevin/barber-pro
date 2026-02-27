import React, { useRef } from "react";
import { View, Text, TouchableOpacity, Alert, Platform, StyleSheet } from "react-native";
import * as Sharing from "expo-sharing";
import ViewShot from "react-native-view-shot";

interface AppointmentShareCardProps {
  shopName: string;
  serviceName: string;
  barberName: string;
  date: string; // ex: "Segunda, 3 de março"
  time: string; // ex: "14:30"
  primaryColor?: string;
}

export function AppointmentShareCard({
  shopName,
  serviceName,
  barberName,
  date,
  time,
  primaryColor = "#EAB308",
}: AppointmentShareCardProps) {
  const cardRef = useRef<ViewShot>(null);

  const handleShare = async () => {
    if (Platform.OS === "web") {
      Alert.alert("Compartilhar", "Compartilhamento disponível apenas no app mobile.");
      return;
    }
    try {
      const uri = await (cardRef.current as any)?.capture?.();
      if (!uri) { Alert.alert("Erro", "Não foi possível capturar o card."); return; }
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) { Alert.alert("Compartilhamento não disponível neste dispositivo."); return; }
      await Sharing.shareAsync(uri, {
        mimeType: "image/png",
        dialogTitle: "Compartilhar agendamento",
        UTI: "public.png",
      });
    } catch (e: any) {
      Alert.alert("Erro ao compartilhar", e.message ?? "Tente novamente.");
    }
  };

  return (
    <View style={styles.wrapper}>
      {/* Card capturável */}
      <ViewShot ref={cardRef} options={{ format: "png", quality: 1.0 }} style={styles.card}>
        {/* Fundo gradiente simulado */}
        <View style={[styles.cardBg, { backgroundColor: "#0A0A0A" }]}>
          {/* Barra colorida no topo */}
          <View style={[styles.topBar, { backgroundColor: primaryColor }]} />
          {/* Conteúdo */}
          <View style={styles.cardContent}>
            <Text style={[styles.emoji]}>✂️</Text>
            <Text style={[styles.shopName, { color: primaryColor }]}>{shopName}</Text>
            <Text style={styles.confirmed}>Agendamento Confirmado!</Text>
            <View style={styles.divider} />
            <View style={styles.row}>
              <Text style={styles.label}>Serviço</Text>
              <Text style={styles.value}>{serviceName}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Profissional</Text>
              <Text style={styles.value}>{barberName}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Data</Text>
              <Text style={styles.value}>{date}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Horário</Text>
              <Text style={[styles.value, { color: primaryColor, fontWeight: "800" }]}>{time}</Text>
            </View>
            <View style={styles.divider} />
            <Text style={styles.footer}>Agendado pelo app Barber Pro 💈</Text>
          </View>
        </View>
      </ViewShot>

      {/* Botão de compartilhar */}
      <TouchableOpacity
        onPress={handleShare}
        style={[styles.shareBtn, { backgroundColor: primaryColor }]}
        activeOpacity={0.8}
      >
        <Text style={styles.shareBtnText}>📲 Compartilhar nos Stories</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: "center",
    gap: 16,
  },
  card: {
    width: 300,
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  cardBg: {
    width: "100%",
  },
  topBar: {
    height: 6,
    width: "100%",
  },
  cardContent: {
    padding: 24,
    alignItems: "center",
  },
  emoji: {
    fontSize: 40,
    marginBottom: 8,
  },
  shopName: {
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 4,
    textAlign: "center",
  },
  confirmed: {
    color: "#ECEDEE",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 16,
    textAlign: "center",
  },
  divider: {
    height: 1,
    backgroundColor: "#1F2937",
    width: "100%",
    marginVertical: 12,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 8,
  },
  label: {
    color: "#9CA3AF",
    fontSize: 13,
  },
  value: {
    color: "#ECEDEE",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "right",
    flex: 1,
    marginLeft: 12,
  },
  footer: {
    color: "#6B7280",
    fontSize: 11,
    textAlign: "center",
    marginTop: 4,
  },
  shareBtn: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  shareBtnText: {
    color: "#0A0A0A",
    fontWeight: "800",
    fontSize: 15,
  },
});
