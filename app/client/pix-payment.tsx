import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";

const PIX_EXPIRY_SECONDS = 30 * 60; // 30 minutos

function formatTimer(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function PixPaymentScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    serviceId: string;
    serviceName: string;
    servicePrice: string;
    clientName: string;
    clientEmail: string;
    clientId: string;
    barberId: string;
    appointmentId: string;
    tenantId: string;
    date: string;
    startTime: string;
  }>();

  const [pixData, setPixData] = useState<{
    paymentId: string;
    qrCode: string;
    qrCodeBase64: string;
    expiresAt: string | null;
    isFallback: boolean;
  } | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(PIX_EXPIRY_SECONDS);
  const [copied, setCopied] = useState(false);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const createPixMutation = trpc.asaasPayments.createDirectPix.useMutation({
    onSuccess: (data: any) => {
      const qrCode = data.pixCopyCola ?? "";
      if (qrCode) {
        setPixData({
          paymentId: String(data.paymentId ?? ""),
          qrCode,
          qrCodeBase64: data.pixQrCode ?? "",
          expiresAt: null,
          isFallback: false,
        });
      } else {
        Alert.alert("Erro", "Não foi possível gerar o código Pix. Tente outro método de pagamento.");
        router.back();
      }
    },
    onError: (err: any) => {
      Alert.alert("Erro ao gerar Pix", err.message ?? "Tente novamente.");
      router.back();
    },
  });

  // Gera o Pix ao montar a tela
  useEffect(() => {
    createPixMutation.mutate({
      tenantId: Number(params.tenantId) || 0,
      clientId: Number(params.clientId),
      appointmentId: params.appointmentId ? Number(params.appointmentId) : null,
      amount: Number(params.servicePrice),
      description: params.serviceName,
    });
  }, []);

  // Timer de contagem regressiva
  useEffect(() => {
    if (!pixData) return;
    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(timerRef.current!);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [pixData]);

  const handleCopy = async () => {
    if (!pixData?.qrCode) return;
    try {
      await Clipboard.setStringAsync(pixData.qrCode);
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => null);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      Alert.alert("Erro", "Não foi possível copiar o código.");
    }
  };

  const handleConfirmPayment = () => {
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => null);
    setPaymentConfirmed(true);
    Alert.alert(
      "Pagamento sinalizado!",
      "Avisamos a barbearia. Assim que o barbeiro confirmar o recebimento, seu agendamento será confirmado.",
      [
        { text: "Ver agendamentos", onPress: () => router.replace("/client/(tabs)/history" as any) },
        { text: "Início", onPress: () => router.replace("/client/(tabs)/home" as any) },
      ]
    );
  };

  const isExpired = secondsLeft === 0;
  const timerColor = secondsLeft < 120 ? "#EF4444" : secondsLeft < 300 ? "#F59E0B" : "#32BCAD";

  if (createPixMutation.isPending) {
    return (
      <ScreenContainer containerClassName="bg-black">
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#32BCAD" size="large" />
          <Text style={styles.loadingText}>Gerando QR Code Pix...</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer containerClassName="bg-black">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 8 }}>
            <Text style={styles.backText}>← Voltar</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Pagar via Pix</Text>
          <View style={{ width: 60 }} />
        </View>

        <View style={styles.content}>
          {/* Valor */}
          <View style={styles.amountCard}>
            <Text style={styles.amountLabel}>Valor a pagar</Text>
            <Text style={styles.amountValue}>
              R$ {Number(params.servicePrice).toFixed(2).replace(".", ",")}
            </Text>
            <Text style={styles.amountService}>{params.serviceName}</Text>
          </View>

          {pixData && !isExpired ? (
            <>
              {/* QR Code */}
              <View style={styles.qrContainer}>
                {pixData.qrCodeBase64 ? (
                  <Image
                    source={{ uri: `data:image/png;base64,${pixData.qrCodeBase64}` }}
                    style={styles.qrImage}
                    resizeMode="contain"
                  />
                ) : (
                  <View style={[styles.qrImage, styles.qrPlaceholder]}>
                    <Text style={{ color: "#6B7280" }}>QR Code indisponível</Text>
                  </View>
                )}

                {/* Timer */}
                <View style={styles.timerRow}>
                  <Text style={styles.timerLabel}>Expira em</Text>
                  <Text style={[styles.timerValue, { color: timerColor }]}>
                    {formatTimer(secondsLeft)}
                  </Text>
                </View>
              </View>

              {/* Instruções */}
              <View style={styles.instructionsCard}>
                <Text style={styles.instructionsTitle}>Como pagar</Text>
                {[
                  "Abra o app do seu banco",
                  "Escolha a opção Pix",
                  "Escaneie o QR Code acima",
                  "Confirme o pagamento",
                ].map((step, i) => (
                  <View key={i} style={styles.stepRow}>
                    <View style={styles.stepBadge}>
                      <Text style={styles.stepNumber}>{i + 1}</Text>
                    </View>
                    <Text style={styles.stepText}>{step}</Text>
                  </View>
                ))}
              </View>

              {/* Copiar código */}
              <TouchableOpacity
                style={[styles.copyBtn, copied && styles.copyBtnSuccess]}
                onPress={handleCopy}
                activeOpacity={0.8}
              >
                <Text style={styles.copyBtnText}>
                  {copied ? "✓ Código copiado!" : "📋 Copiar código Pix (copia e cola)"}
                </Text>
              </TouchableOpacity>

              {/* Aviso de fallback */}
              {pixData.isFallback && (
                <View style={styles.fallbackBanner}>
                  <Text style={styles.fallbackText}>
                    ⚠️ QR Code gerado localmente. Configure as credenciais do Asaas nas configurações para ativar a confirmação automática.
                  </Text>
                </View>
              )}

              {/* Botão "Já paguei" */}
              <Pressable
                style={({ pressed }) => [styles.confirmBtn, pressed && { opacity: 0.85 }, paymentConfirmed && styles.confirmBtnDone]}
                onPress={handleConfirmPayment}
                disabled={paymentConfirmed}
              >
                <Text style={styles.confirmBtnText}>
                  {paymentConfirmed ? "✓ Pagamento confirmado" : "Já paguei ✓"}
                </Text>
              </Pressable>
            </>
          ) : pixData && isExpired ? (
            <View style={styles.expiredContainer}>
              <Text style={styles.expiredIcon}>⏱</Text>
              <Text style={styles.expiredTitle}>QR Code expirado</Text>
              <Text style={styles.expiredText}>O código Pix expirou. Gere um novo para continuar.</Text>
              <TouchableOpacity
                style={styles.retryBtn}
                onPress={() => {
                  setPixData(null);
                  setSecondsLeft(PIX_EXPIRY_SECONDS);
                  createPixMutation.mutate({
                    tenantId: Number(params.tenantId) || 0,
                    clientId: Number(params.clientId),
                    appointmentId: params.appointmentId ? Number(params.appointmentId) : null,
                    amount: Number(params.servicePrice),
                    description: params.serviceName,
                  });
                }}
              >
                <Text style={styles.retryBtnText}>Gerar novo QR Code</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", gap: 16 },
  loadingText: { color: "#9CA3AF", fontSize: 15 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  backText: { color: "#EAB308", fontSize: 16 },
  headerTitle: { color: "#fff", fontSize: 17, fontWeight: "700" },
  content: { paddingHorizontal: 20, paddingBottom: 40, gap: 20 },
  amountCard: {
    backgroundColor: "#111827",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#32BCAD33",
  },
  amountLabel: { color: "#9CA3AF", fontSize: 13, marginBottom: 4 },
  amountValue: { color: "#32BCAD", fontSize: 36, fontWeight: "800" },
  amountService: { color: "#6B7280", fontSize: 13, marginTop: 4 },
  qrContainer: {
    backgroundColor: "#111827",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#1F2937",
    gap: 16,
  },
  qrImage: { width: 240, height: 240, borderRadius: 12, backgroundColor: "#fff" },
  qrPlaceholder: { justifyContent: "center", alignItems: "center" },
  timerRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  timerLabel: { color: "#6B7280", fontSize: 13 },
  timerValue: { fontSize: 22, fontWeight: "800", fontVariant: ["tabular-nums"] },
  instructionsCard: {
    backgroundColor: "#111827",
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: "#1F2937",
  },
  instructionsTitle: { color: "#fff", fontSize: 14, fontWeight: "700", marginBottom: 4 },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  stepBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#32BCAD22",
    justifyContent: "center",
    alignItems: "center",
  },
  stepNumber: { color: "#32BCAD", fontSize: 12, fontWeight: "700" },
  stepText: { color: "#D1D5DB", fontSize: 14, flex: 1 },
  copyBtn: {
    backgroundColor: "#1F2937",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#32BCAD44",
  },
  copyBtnSuccess: { backgroundColor: "#064E3B", borderColor: "#32BCAD" },
  copyBtnText: { color: "#32BCAD", fontWeight: "700", fontSize: 14 },
  fallbackBanner: {
    backgroundColor: "#1C1917",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#F59E0B44",
  },
  fallbackText: { color: "#F59E0B", fontSize: 12, lineHeight: 18 },
  confirmBtn: {
    backgroundColor: "#32BCAD",
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: "center",
  },
  confirmBtnDone: { backgroundColor: "#065F46" },
  confirmBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  expiredContainer: { alignItems: "center", paddingVertical: 40, gap: 12 },
  expiredIcon: { fontSize: 48 },
  expiredTitle: { color: "#fff", fontSize: 20, fontWeight: "700" },
  expiredText: { color: "#9CA3AF", fontSize: 14, textAlign: "center" },
  retryBtn: {
    backgroundColor: "#32BCAD",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginTop: 8,
  },
  retryBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
