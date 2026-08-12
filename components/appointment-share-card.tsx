import React, { useRef, useState } from "react";
import {
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as Sharing from "expo-sharing";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
// TEMPORARIAMENTE DESATIVADO: import ViewShot from "react-native-view-shot";
// O pacote react-native-view-shot está causando um erro de build no Android
// ("More than one plugin attempted to override parsing", conflito entre o
// Babel e o react-native-css-interop/NativeWind) que não conseguimos
// resolver ainda, mesmo com múltiplas tentativas (stub preciso, limpeza
// completa de cache). Pra não travar o lançamento, o botão "Compartilhar
// nos Stories" fica temporariamente desativado (mostra um aviso), sem
// afetar nenhuma outra parte do app. Assim que a causa raiz for resolvida,
// reverter: restaurar o import acima e o restante deste arquivo pra usar
// <ViewShot ref={cardRef} ...> em vez de <View ref={cardRef} ...>.
import { useColors } from "@/hooks/use-colors";

// ─── Definição de temas ───────────────────────────────────────────────────────

export type CardTheme = "dark-gold" | "midnight-blue" | "forest-green" | "royal-purple" | "crimson-red";

interface ThemeConfig {
  label: string;
  emoji: string;
  bg: string;
  surface: string;
  accent: string;
  accentText: string;
  muted: string;
  divider: string;
  diagColor1: string;
  diagColor2: string;
}

const THEMES: Record<CardTheme, ThemeConfig> = {
  "dark-gold": {
    label: "Dourado",
    emoji: "✨",
    bg: "#0A0A0A",
    surface: "#111827",
    accent: "#EAB308",
    accentText: "#0A0A0A",
    muted: "#6B7280",
    divider: "#1F2937",
    diagColor1: "#EAB30808",
    diagColor2: "#EAB30804",
  },
  "midnight-blue": {
    label: "Azul",
    emoji: "🌊",
    bg: "#050D1A",
    surface: "#0D1F35",
    accent: "#3B82F6",
    accentText: "#fff",
    muted: "#64748B",
    divider: "#1E3A5F",
    diagColor1: "#3B82F608",
    diagColor2: "#3B82F604",
  },
  "forest-green": {
    label: "Verde",
    emoji: "🌿",
    bg: "#050F0A",
    surface: "#0D1F14",
    accent: "#22C55E",
    accentText: "#050F0A",
    muted: "#4B7A5E",
    divider: "#1A3D26",
    diagColor1: "#22C55E08",
    diagColor2: "#22C55E04",
  },
  "royal-purple": {
    label: "Roxo",
    emoji: "👑",
    bg: "#0A050F",
    surface: "#1A0D2E",
    accent: "#A855F7",
    accentText: "#fff",
    muted: "#6B4E8A",
    divider: "#2D1B4E",
    diagColor1: "#A855F708",
    diagColor2: "#A855F704",
  },
  "crimson-red": {
    label: "Vermelho",
    emoji: "🔥",
    bg: "#0F0505",
    surface: "#1F0D0D",
    accent: "#EF4444",
    accentText: "#fff",
    muted: "#7A3535",
    divider: "#3D1A1A",
    diagColor1: "#EF444408",
    diagColor2: "#EF444404",
  },
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface AppointmentShareCardProps {
  shopName: string;
  serviceName: string;
  /** Lista de nomes de serviços quando há múltiplos selecionados */
  serviceNames?: string[];
  barberName: string;
  date: string;
  time: string;
  /** URL da foto de perfil do cliente (opcional) */
  clientPhotoUrl?: string;
  /** Nome do cliente para exibir iniciais quando não há foto */
  clientName?: string;
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function AppointmentShareCard({
  shopName,
  serviceName,
  serviceNames,
  barberName,
  date,
  time,
  clientPhotoUrl,
  clientName,
}: AppointmentShareCardProps) {
  const colors = useColors();
  const styles = createStyles(colors);
  // Resolve o nome do serviço: lista ou nome único
  const resolvedServiceName = serviceNames && serviceNames.length > 1
    ? serviceNames.join(" + ")
    : serviceName;
  const cardRef = useRef<View>(null);
  const [selectedTheme, setSelectedTheme] = useState<CardTheme>("dark-gold");
  const [localPhotoUri, setLocalPhotoUri] = useState<string | null>(clientPhotoUrl ?? null);

  const theme = THEMES[selectedTheme];

  // ── Compartilhar ────────────────────────────────────────────────────────────
  const handleShare = async () => {
    // TEMPORARIAMENTE DESATIVADO — ver nota no import de react-native-view-shot
    // no topo do arquivo. Assim que a causa raiz do erro de build for
    // resolvida, restaurar a lógica original de captura + compartilhamento
    // abaixo (comentada).
    Alert.alert(
      "Indisponível no momento",
      "O compartilhamento em imagem está temporariamente indisponível nesta versão do app. Estamos trabalhando para trazer de volta em breve."
    );
    return;
    /* LÓGICA ORIGINAL (restaurar junto com o import de ViewShot):
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
    */
  };

  // ── Selecionar foto de perfil ───────────────────────────────────────────────
  const handlePickPhoto = async () => {
    Alert.alert(
      "Foto de perfil",
      "Escolha de onde deseja selecionar a foto",
      [
        {
          text: "Câmera",
          onPress: async () => {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== "granted") {
              Alert.alert("Permissão necessária", "Precisamos de acesso à câmera.");
              return;
            }
            const result = await ImagePicker.launchCameraAsync({
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.8,
            });
            if (!result.canceled) {
              setLocalPhotoUri(result.assets[0].uri);
            }
          },
        },
        {
          text: "Galeria",
          onPress: async () => {
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.8,
            });
            if (!result.canceled) {
              setLocalPhotoUri(result.assets[0].uri);
            }
          },
        },
        { text: "Cancelar", style: "cancel" },
      ]
    );
  };

  // ── Processar data ──────────────────────────────────────────────────────────
  const dateParts = date.split(", ");
  const dayName = dateParts[0] ?? "";
  const dateRest = dateParts.slice(1).join(", ") || date;
  const dayNumber = dateRest.match(/\d+/)?.[0] ?? "";
  const monthStr = dateRest.replace(/\d+\s*de\s*/, "").trim();

  // Iniciais do cliente
  const initials = clientName
    ? clientName.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()
    : "?";

  return (
    <View style={styles.wrapper}>

      {/* ── Instrução de uso ──────────────────────────────────────────────── */}
      <View style={styles.instructionBox}>
        <Text style={styles.instructionTitle}>📲 Compartilhe nos Stories!</Text>
        <Text style={styles.instructionText}>
          Personalize o card abaixo e toque em "Compartilhar" → escolha o Instagram → cole nos Stories.
        </Text>
      </View>

      {/* ── Seletor de foto de perfil ─────────────────────────────────────── */}
      <View style={styles.photoSection}>
        <TouchableOpacity onPress={handlePickPhoto} style={styles.photoPickerBtn} activeOpacity={0.8}>
          {localPhotoUri ? (
            <Image source={{ uri: localPhotoUri }} style={styles.photoPreview} />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Text style={styles.photoPlaceholderInitials}>{initials}</Text>
            </View>
          )}
          <View style={styles.photoEditBadge}>
            <Text style={{ fontSize: 12 }}>📷</Text>
          </View>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.photoLabel}>Sua foto no card</Text>
          <Text style={styles.photoHint}>
            {localPhotoUri ? "Toque para trocar a foto" : "Toque para adicionar sua foto"}
          </Text>
        </View>
      </View>

      {/* ── Seletor de tema ───────────────────────────────────────────────── */}
      <View style={styles.themeSection}>
        <Text style={styles.themeSectionLabel}>Tema do card</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.themeScroll}>
          {(Object.entries(THEMES) as [CardTheme, ThemeConfig][]).map(([key, t]) => (
            <TouchableOpacity
              key={key}
              onPress={() => {
                setSelectedTheme(key);
                if (Platform.OS === "ios" || Platform.OS === "android") {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
              }}
              style={[
                styles.themeChip,
                { borderColor: t.accent },
                selectedTheme === key && { backgroundColor: t.accent },
              ]}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 14 }}>{t.emoji}</Text>
              <Text style={[
                styles.themeChipLabel,
                { color: selectedTheme === key ? t.accentText : t.accent },
              ]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* ── Card capturável (proporção 9:16 → 270:480) ───────────────────── */}
      {/* TEMPORARIAMENTE: era <ViewShot ref={cardRef} options={{ format: "png", quality: 1.0 }} style={styles.cardShot}> — ver nota no import de react-native-view-shot no topo do arquivo. */}
      <View ref={cardRef} style={styles.cardShot}>
        <View style={[styles.cardBg, { backgroundColor: theme.bg }]}>

          {/* Fundo decorativo — linhas diagonais */}
          <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
            {[...Array(8)].map((_, i) => (
              <View
                key={i}
                style={[
                  styles.diagLine,
                  { top: i * 60 - 30, backgroundColor: i % 2 === 0 ? theme.diagColor1 : theme.diagColor2 },
                ]}
              />
            ))}
          </View>

          {/* Cabeçalho com badge */}
          <View style={styles.header}>
            <View style={[styles.badge, { backgroundColor: theme.accent }]}>
              <Text style={[styles.badgeText, { color: theme.accentText }]}>✅ CONFIRMADO</Text>
            </View>
          </View>

          {/* Seção do logo / foto de perfil */}
          <View style={styles.heroSection}>
            <View style={[styles.outerRing, { borderColor: theme.accent + "40" }]}>
              <View style={[styles.innerRing, { borderColor: theme.accent + "80" }]}>
                {localPhotoUri ? (
                  <Image
                    source={{ uri: localPhotoUri }}
                    style={[styles.heroPhoto, { borderColor: theme.accent }]}
                  />
                ) : (
                  <View style={[styles.logoCircle, { backgroundColor: theme.accent + "20", borderColor: theme.accent }]}>
                    <Text style={styles.logoEmoji}>💈</Text>
                  </View>
                )}
              </View>
            </View>
            <Text style={[styles.shopName, { color: theme.accent }]}>{shopName}</Text>
            <Text style={[styles.tagline, { color: theme.muted }]}>Seu visual está garantido!</Text>
          </View>

          {/* Destaque da data */}
          <View style={[styles.dateHighlight, { borderColor: theme.accent + "30", backgroundColor: theme.surface }]}>
            <View style={styles.dateLeft}>
              <Text style={[styles.dayNumber, { color: theme.accent }]}>{dayNumber}</Text>
              <Text style={[styles.monthText, { color: theme.muted }]}>{monthStr.toUpperCase()}</Text>
            </View>
            <View style={[styles.dateDivider, { backgroundColor: theme.divider }]} />
            <View style={styles.dateRight}>
              <Text style={[styles.dayNameText, { color: theme.muted }]}>{dayName.toUpperCase()}</Text>
              <View style={[styles.timeChip, { backgroundColor: theme.accent }]}>
                <Text style={[styles.timeChipText, { color: theme.accentText }]}>🕐 {time}</Text>
              </View>
            </View>
          </View>

          {/* Detalhes do serviço */}
          <View style={[styles.detailsCard, { backgroundColor: theme.surface, borderColor: theme.divider }]}>
            <DetailItem icon="✂️" label="SERVIÇO" value={resolvedServiceName} theme={theme} />
            <View style={[styles.detailDivider, { backgroundColor: theme.accent + "20" }]} />
            <DetailItem icon="👤" label="PROFISSIONAL" value={barberName} theme={theme} />
          </View>

          {/* Rodapé */}
          <View style={[styles.footer, { borderTopColor: theme.accent + "20" }]}>
            <Text style={[styles.footerText, { color: theme.muted }]}>Agendado pelo </Text>
            <Text style={[styles.footerBrand, { color: theme.accent }]}>Barber Pro</Text>
            <Text style={[styles.footerText, { color: theme.muted }]}> 💈</Text>
          </View>

        </View>
      </View>

      {/* ── Botão de compartilhar ─────────────────────────────────────────── */}
      <TouchableOpacity
        onPress={handleShare}
        style={[styles.shareBtn, { backgroundColor: theme.accent }]}
        activeOpacity={0.8}
      >
        <Text style={[styles.shareBtnText, { color: theme.accentText }]}>📲  Compartilhar nos Stories</Text>
      </TouchableOpacity>

      <Text style={styles.hint}>
        Funciona no Instagram, WhatsApp e qualquer outro app de Stories.
      </Text>
    </View>
  );
}

// ─── Subcomponente: linha de detalhe ─────────────────────────────────────────

function DetailItem({
  icon,
  label,
  value,
  theme,
}: {
  icon: string;
  label: string;
  value: string;
  theme: ThemeConfig;
}) {
  return (
    <View style={detailStyles.row}>
      <View style={[detailStyles.iconWrap, { backgroundColor: theme.accent + "15" }]}>
        <Text style={detailStyles.icon}>{icon}</Text>
      </View>
      <View style={detailStyles.textGroup}>
        <Text style={[detailStyles.label, { color: theme.accent + "AA" }]}>{label}</Text>
        <Text style={[detailStyles.value, { color: "#ECEDEE" }]}>{value}</Text>
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
  icon: { fontSize: 16 },
  textGroup: { flex: 1 },
  label: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 2,
  },
  value: {
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 18,
  },
});

// ─── Estilos ──────────────────────────────────────────────────────────────────

function createStyles(c: ReturnType<typeof import("@/hooks/use-colors").useColors>) {
  return StyleSheet.create({
  wrapper: {
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 8,
  },

  // Instrução
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
    color: c.foreground,
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

  // Foto de perfil
  photoSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    width: "100%",
    backgroundColor: "#111827",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#1F2937",
  },
  photoPickerBtn: {
    position: "relative",
  },
  photoPreview: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: "#EAB308",
  },
  photoPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#1F2937",
    borderWidth: 2,
    borderColor: "#374151",
    alignItems: "center",
    justifyContent: "center",
  },
  photoPlaceholderInitials: {
    color: "#6B7280",
    fontSize: 20,
    fontWeight: "800",
  },
  photoEditBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    backgroundColor: "#1F2937",
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#374151",
  },
  photoLabel: {
    color: c.foreground,
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 2,
  },
  photoHint: {
    color: "#6B7280",
    fontSize: 12,
  },

  // Seletor de tema
  themeSection: {
    width: "100%",
    gap: 10,
  },
  themeSectionLabel: {
    color: "#9CA3AF",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  themeScroll: {
    gap: 8,
    paddingRight: 8,
  },
  themeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    backgroundColor: "transparent",
  },
  themeChipLabel: {
    fontSize: 13,
    fontWeight: "700",
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
    overflow: "hidden",
  },

  // Linhas decorativas
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
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
  },

  // Seção do logo/foto
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
  heroPhoto: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  logoEmoji: { fontSize: 30 },
  shopName: {
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  tagline: {
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
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
  },
  dateDivider: {
    width: 1,
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
    fontSize: 13,
    fontWeight: "900",
  },

  // Card de detalhes
  detailsCard: {
    marginHorizontal: 20,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    marginBottom: 16,
  },
  detailDivider: { height: 1, marginHorizontal: 16 },

  // Rodapé
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 14,
    borderTopWidth: 1,
    marginHorizontal: 20,
  },
  footerText: { fontSize: 11 },
  footerBrand: { fontSize: 11, fontWeight: "900" },

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
}
