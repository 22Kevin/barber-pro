import React, { useRef } from "react";
import { View, Text, TouchableOpacity, Alert, Platform, StyleSheet } from "react-native";
import * as Sharing from "expo-sharing";
import * as Haptics from "expo-haptics";
import ViewShot from "react-native-view-shot";

interface AppointmentShareCardProps {
  shopName: string;
  serviceName: string;
  barberName: string;
  date: string; // ex: "Segunda, 3 de março"
  time: string; // ex: "14:30"
  primaryColor?: string;
  logoUrl?: string;
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
      if (Platform.OS === "ios" || Platform.OS === "android") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      const uri = await (cardRef.current as any)?.capture?.();
      if (!uri) {
        Alert.alert("Erro", "Não foi possível capturar o card.");
        return;
      }
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert("Compartilhamento não disponível", "Este dispositivo não suporta compartilhamento.");
        return;
      }
      await Sharing.shareAsync(uri, {
        mimeType: "image/png",
        dialogTitle: "Compartilhar nos Stories",
        UTI: "public.png",
      });
      if (Platform.OS === "ios" || Platform.OS === "android") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (e: any) {
      Alert.alert("Erro ao compartilhar", e.message ?? "Tente novamente.");
    }
  };

  // Divide a data para exibição em destaque
  const dateParts = date.split(", ");
  const dayName = dateParts[0] ?? "";
  const dateRest = dateParts.slice(1).join(", ") || date;

  // Extrai apenas o dia numérico para destaque
  const dayNumber = dateRest.match(/\d+/)?.[0] ?? "";
  const monthStr = dateRest.replace(/\d+\s*de\s*/, "").trim();

  return (
    <View style={styles.wrapper}>
      {/* Instrução de uso */}
      <View style={styles.instructionBox}>
        <Text style={styles.instructionTitle}>📲 Compartilhe nos Stories!</Text>
        <Text style={styles.instructionText}>
          Toque em "Compartilhar" → escolha o Instagram → cole nos Stories para mostrar seu visual novo.
        </Text>
      </View>

      {/* Card capturável — proporção 9:16 Stories */}
      <ViewShot ref={cardRef} options={{ format: "png", quality: 1.0 }} style={styles.cardShot}>
        <View style={styles.cardBg}>

          {/* Fundo decorativo — linhas diagonais */}
          <View style={StyleSheet.absoluteFillObject}>
            {[...Array(8)].map((_, i) => (
              <View
                key={i}
                style={[
                  styles.diagLine,
                  {
                    top: i * 60 - 30,
                    backgroundColor: i % 2 === 0 ? primaryColor + "08" : primaryColor + "04",
                  },
                ]}
              />
            ))}
          </View>

          {/* Cabeçalho com badge */}
          <View style={styles.header}>
            <View style={[styles.badge, { backgroundColor: primaryColor }]}>
              <Text style={styles.badgeText}>✅ CONFIRMADO</Text>
            </View>
          </View>

          {/* Círculo central com ícone */}
          <View style={styles.heroSection}>
            <View style={[styles.outerRing, { borderColor: primaryColor + "40" }]}>
              <View style={[styles.innerRing, { borderColor: primaryColor + "80" }]}>
                <View style={[styles.logoCircle, { backgroundColor: primaryColor + "20", borderColor: primaryColor }]}>
                  <Text style={styles.logoEmoji}>💈</Text>
                </View>
              </View>
            </View>
            <Text style={[styles.shopName, { color: primaryColor }]}>{shopName}</Text>
            <Text style={styles.tagline}>Seu visual está garantido!</Text>
          </View>

          {/* Destaque da data */}
          <View style={[styles.dateHighlight, { borderColor: primaryColor + "30" }]}>
            <View style={styles.dateLeft}>
              <Text style={[styles.dayNumber, { color: primaryColor }]}>{dayNumber}</Text>
              <Text style={styles.monthText}>{monthStr.toUpperCase()}</Text>
            </View>
            <View style={styles.dateDivider} />
            <View style={styles.dateRight}>
              <Text style={styles.dayNameText}>{dayName.toUpperCase()}</Text>
              <View style={[styles.timeChip, { backgroundColor: primaryColor }]}>
                <Text style={styles.timeChipText}>🕐 {time}</Text>
              </View>
            </View>
          </View>

          {/* Detalhes do serviço */}
          <View style={styles.detailsCard}>
            <DetailItem
              icon="✂️"
              label="SERVIÇO"
              value={serviceName}
              primaryColor={primaryColor}
            />
            <View style={[styles.detailDivider, { backgroundColor: primaryColor + "20" }]} />
            <DetailItem
              icon="👤"
              label="PROFISSIONAL"
              value={barberName}
              primaryColor={primaryColor}
            />
          </View>

          {/* Rodapé */}
          <View style={[styles.footer, { borderTopColor: primaryColor + "20" }]}>
            <Text style={styles.footerText}>Agendado pelo </Text>
            <Text style={[styles.footerBrand, { color: primaryColor }]}>Barber Pro</Text>
            <Text style={styles.footerText}> 💈</Text>
          </View>

        </View>
      </ViewShot>

      {/* Botão principal de compartilhar */}
      <TouchableOpacity
        onPress={handleShare}
        style={[styles.shareBtn, { backgroundColor: primaryColor }]}
        activeOpacity={0.8}
      >
        <Text style={styles.shareBtnText}>📲  Compartilhar nos Stories</Text>
      </TouchableOpacity>

      {/* Dica secundária */}
      <Text style={styles.hint}>
        Funciona no Instagram, WhatsApp e qualquer outro app de Stories.
      </Text>
    </View>
  );
}

function DetailItem({
  icon,
  label,
  value,
  primaryColor,
}: {
  icon: string;
  label: string;
  value: string;
  primaryColor: string;
}) {
  return (
    <View style={detailStyles.row}>
      <View style={[detailStyles.iconWrap, { backgroundColor: primaryColor + "15" }]}>
        <Text style={detailStyles.icon}>{icon}</Text>
      </View>
      <View style={detailStyles.textGroup}>
        <Text style={[detailStyles.label, { color: primaryColor + "AA" }]}>{label}</Text>
        <Text style={detailStyles.value}>{value}</Text>
      </View>
    </View>
  );
}

const detailStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  icon: {
    fontSize: 16,
  },
  textGroup: {
    flex: 1,
  },
  label: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 2,
  },
  value: {
    color: "#ECEDEE",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 18,
  },
});

const styles = StyleSheet.create({
  wrapper: {
    alignItems: "center",
    gap: 20,
    paddingHorizontal: 8,
  },

  // Caixa de instrução
  instructionBox: {
    backgroundColor: "#111827",
    borderRadius: 14,
    padding: 16,
    width: "100%",
    borderWidth: 1,
    borderColor: "#1F2937",
    gap: 6,
  },
  instructionTitle: {
    color: "#ECEDEE",
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
  },
  instructionText: {
    color: "#9CA3AF",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
  },

  // Card principal (proporção 9:16 → 270:480)
  cardShot: {
    width: 270,
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: "#EAB308",
    shadowOpacity: 0.25,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 16,
  },
  cardBg: {
    width: "100%",
    minHeight: 480,
    backgroundColor: "#0A0A0A",
    overflow: "hidden",
  },

  // Linhas decorativas diagonais
  diagLine: {
    position: "absolute",
    left: -50,
    right: -50,
    height: 40,
    transform: [{ rotate: "-15deg" }],
  },

  // Cabeçalho
  header: {
    alignItems: "center",
    paddingTop: 20,
    paddingBottom: 8,
  },
  badge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  badgeText: {
    color: "#0A0A0A",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
  },

  // Seção do logo
  heroSection: {
    alignItems: "center",
    paddingTop: 16,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  outerRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  innerRing: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  logoEmoji: {
    fontSize: 30,
  },
  shopName: {
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  tagline: {
    color: "#6B7280",
    fontSize: 11,
    textAlign: "center",
    letterSpacing: 0.3,
  },

  // Destaque da data
  dateHighlight: {
    flexDirection: "row",
    marginHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    backgroundColor: "#111827",
    marginBottom: 12,
  },
  dateLeft: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
  },
  dayNumber: {
    fontSize: 36,
    fontWeight: "900",
    lineHeight: 40,
  },
  monthText: {
    color: "#9CA3AF",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
  },
  dateDivider: {
    width: 1,
    backgroundColor: "#1F2937",
    marginVertical: 12,
  },
  dateRight: {
    flex: 1.4,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    gap: 8,
  },
  dayNameText: {
    color: "#9CA3AF",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
  },
  timeChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  timeChipText: {
    color: "#0A0A0A",
    fontSize: 13,
    fontWeight: "900",
  },

  // Card de detalhes
  detailsCard: {
    marginHorizontal: 20,
    borderRadius: 16,
    backgroundColor: "#111827",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#1F2937",
    marginBottom: 16,
  },
  detailDivider: {
    height: 1,
    marginHorizontal: 16,
  },

  // Rodapé
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 14,
    borderTopWidth: 1,
    marginHorizontal: 20,
  },
  footerText: {
    color: "#6B7280",
    fontSize: 11,
  },
  footerBrand: {
    fontSize: 11,
    fontWeight: "900",
  },

  // Botão de compartilhar
  shareBtn: {
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    width: "100%",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  shareBtnText: {
    color: "#0A0A0A",
    fontWeight: "900",
    fontSize: 16,
    letterSpacing: 0.2,
  },

  // Dica
  hint: {
    color: "#6B7280",
    fontSize: 11,
    textAlign: "center",
    lineHeight: 16,
  },
});
