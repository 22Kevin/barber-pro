import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
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
import { trpc } from "@/lib/trpc";

type PaymentMethod = "cash" | "credit_card" | "debit_card" | "pix" | "asaas" | "other";

interface Appointment {
  id: number;
  barberId: number;
  clientId?: number | null;
  clientName?: string;
  clientPhone?: string;
  serviceId: number;
  serviceName: string;
  servicePrice: string | number;
  date: string;
  startTime: string;
}

interface PaymentStatusModalProps {
  visible: boolean;
  appointment: Appointment | null;
  onClose: () => void;
  onPaymentRegistered?: () => void;
}

const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "💵 Dinheiro",
  credit_card: "💳 Cartão de Crédito",
  debit_card: "💳 Cartão de Débito",
  pix: "📱 Pix",
  asaas: "📱 Online (Asaas)",
  other: "Outro",
};

const METHOD_COLORS: Record<PaymentMethod, string> = {
  cash: "#16A34A",
  credit_card: "#7C3AED",
  debit_card: "#2563EB",
  pix: "#32BCAD",
  asaas: "#009EE3",
  other: "#6B7280",
};

export function PaymentStatusModal({
  visible,
  appointment,
  onClose,
  onPaymentRegistered,
}: PaymentStatusModalProps) {
  const [view, setView] = useState<"status" | "choose_method" | "pix_qr">("status");
  const [pixData, setPixData] = useState<{
    qrCode: string;
    qrCodeBase64: string;
    expiresAt: string | null;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const utils = trpc.useUtils();

  const paymentStatusQuery = trpc.appointments.getPaymentStatus.useQuery(
    { appointmentId: appointment?.id ?? 0 },
    { trpc: {}, enabled: visible && !!appointment?.id, staleTime: 0 } as any
  );

  const registerPaymentMutation = trpc.appointments.registerPayment.useMutation();
  const createPixMutation = trpc.asaasPayments.createPix.useMutation();

  // Reset ao fechar
  useEffect(() => {
    if (!visible) {
      setView("status");
      setPixData(null);
      setCopied(false);
    }
  }, [visible]);

  const handleRegisterPayment = (method: PaymentMethod) => {
    if (!appointment) return;
    registerPaymentMutation.mutate(
      {
        appointmentId: appointment.id,
        barberId: appointment.barberId,
        clientId: appointment.clientId ?? null,
        serviceId: appointment.serviceId,
        serviceName: appointment.serviceName,
        servicePrice: parseFloat(String(appointment.servicePrice)),
        paymentMethod: method,
      },
      {
        onSuccess: () => {
          if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => null);
          paymentStatusQuery.refetch();
          onPaymentRegistered?.();
          onClose();
        },
        onError: (err: any) => Alert.alert("Erro ao registrar pagamento", err.message),
      }
    );
  };

  const handleGeneratePix = () => {
    if (!appointment) return;
    createPixMutation.mutate(
      {
        tenantId: 0, // será resolvido pelo servidor via sessão
        clientId: appointment.clientId ?? 0,
        clientName: appointment.clientName ?? "Cliente",
        appointmentId: appointment.id,
        amount: parseFloat(String(appointment.servicePrice)),
        description: appointment.serviceName,
      },
      {
        onSuccess: (data: any) => {
          if (data.pixQrCode || data.pixCopyCola) {
            setPixData({
              qrCode: data.pixCopyCola ?? "",
              qrCodeBase64: "",
              expiresAt: data.dueDate ?? null,
            });
            setView("pix_qr");
          } else {
            Alert.alert("Erro", "Não foi possível gerar o QR Code Pix.");
          }
        },
        onError: (err: any) => Alert.alert("Erro ao gerar Pix", err.message),
      }
    );
  };

  const handleSendWhatsApp = () => {
    if (!appointment?.clientPhone || !pixData) return;
    const phone = appointment.clientPhone.replace(/\D/g, "");
    const msg = `Olá! Segue o código Pix para pagamento do serviço *${appointment.serviceName}* (R$ ${parseFloat(String(appointment.servicePrice)).toFixed(2).replace(".", ",")}). Copie e cole no seu banco:\n\n\`${pixData.qrCode}\``;
    const url = `https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`;
    Linking.openURL(url).catch(() => Alert.alert("Erro", "Não foi possível abrir o WhatsApp."));
  };

  const handleCopyPix = async () => {
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

  const handleConfirmPixPaid = () => {
    if (!appointment) return;
    registerPaymentMutation.mutate(
      {
        appointmentId: appointment.id,
        barberId: appointment.barberId,
        clientId: appointment.clientId ?? null,
        serviceId: appointment.serviceId,
        serviceName: appointment.serviceName,
        servicePrice: parseFloat(String(appointment.servicePrice)),
        paymentMethod: "pix",
      },
      {
        onSuccess: () => {
          if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => null);
          paymentStatusQuery.refetch();
          onPaymentRegistered?.();
          setView("status");
        },
        onError: (err: any) => Alert.alert("Erro ao confirmar pagamento Pix", err.message),
      }
    );
  };

  if (!appointment) return null;

  const price = parseFloat(String(appointment.servicePrice)).toFixed(2).replace(".", ",");
  const paymentInfo = paymentStatusQuery.data;
  const isLoading = paymentStatusQuery.isLoading;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>Pagamento</Text>
              <Text style={styles.headerSub}>{appointment.serviceName} · R$ {price}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
            {/* ── VIEW: STATUS ── */}
            {view === "status" && (
              <View>
                {isLoading ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator color="#32BCAD" />
                    <Text style={styles.loadingText}>Verificando pagamento...</Text>
                  </View>
                ) : paymentInfo?.paid ? (
                  /* PAGO */
                  <View style={styles.paidCard}>
                    <Text style={styles.paidIcon}>✅</Text>
                    <Text style={styles.paidTitle}>Pagamento confirmado</Text>
                    <Text style={styles.paidMethod}>
                      {METHOD_LABELS[paymentInfo.sale?.paymentMethod as PaymentMethod] ?? paymentInfo.sale?.paymentMethod}
                    </Text>
                    <Text style={styles.paidAmount}>R$ {parseFloat(paymentInfo.sale?.total ?? "0").toFixed(2).replace(".", ",")}</Text>
                    {paymentInfo.sale?.createdAt && (
                      <Text style={styles.paidDate}>
                        {new Date(paymentInfo.sale.createdAt).toLocaleString("pt-BR")}
                      </Text>
                    )}
                    <TouchableOpacity style={styles.closeFullBtn} onPress={onClose}>
                      <Text style={styles.closeFullBtnText}>Fechar</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  /* NÃO PAGO */
                  <View>
                    <View style={styles.unpaidBanner}>
                      <Text style={styles.unpaidIcon}>⏳</Text>
                      <View>
                        <Text style={styles.unpaidTitle}>Pagamento pendente</Text>
                        <Text style={styles.unpaidSub}>
                          {appointment.clientName ? `${appointment.clientName} ainda não pagou.` : "Pagamento não registrado."}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.sectionLabel}>Como deseja cobrar?</Text>

                    {/* Opção 1: Gerar Pix QR Code */}
                    <TouchableOpacity
                      style={[styles.optionBtn, { borderColor: "#32BCAD44" }]}
                      onPress={handleGeneratePix}
                      disabled={createPixMutation.isPending}
                      activeOpacity={0.8}
                    >
                      <View style={[styles.optionIcon, { backgroundColor: "#32BCAD22" }]}>
                        <Text style={{ fontSize: 22 }}>📱</Text>
                      </View>
                      <View style={styles.optionText}>
                        <Text style={styles.optionTitle}>
                          {createPixMutation.isPending ? "Gerando QR Code..." : "Gerar QR Code Pix"}
                        </Text>
                        <Text style={styles.optionSub}>Mostre o QR Code para o cliente escanear</Text>
                      </View>
                      {createPixMutation.isPending ? (
                        <ActivityIndicator color="#32BCAD" size="small" />
                      ) : (
                        <Text style={styles.chevron}>›</Text>
                      )}
                    </TouchableOpacity>

                    {/* Opção 2: Registrar pagamento manual */}
                    <TouchableOpacity
                      style={[styles.optionBtn, { borderColor: "#EAB30844" }]}
                      onPress={() => setView("choose_method")}
                      activeOpacity={0.8}
                    >
                      <View style={[styles.optionIcon, { backgroundColor: "#EAB30822" }]}>
                        <Text style={{ fontSize: 22 }}>✏️</Text>
                      </View>
                      <View style={styles.optionText}>
                        <Text style={styles.optionTitle}>Registrar pagamento</Text>
                        <Text style={styles.optionSub}>Dinheiro, cartão, Pix no local ou outro</Text>
                      </View>
                      <Text style={styles.chevron}>›</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {/* ── VIEW: ESCOLHER MÉTODO ── */}
            {view === "choose_method" && (
              <View>
                <TouchableOpacity onPress={() => setView("status")} style={styles.backRow}>
                  <Text style={styles.backText}>← Voltar</Text>
                </TouchableOpacity>
                <Text style={styles.sectionLabel}>Selecione o método de pagamento</Text>
                {(["cash", "pix", "credit_card", "debit_card", "asaas", "other"] as PaymentMethod[]).map((method) => (
                  <TouchableOpacity
                    key={method}
                    style={[styles.methodBtn, { borderColor: METHOD_COLORS[method] + "44" }]}
                    onPress={() => handleRegisterPayment(method)}
                    disabled={registerPaymentMutation.isPending}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.methodDot, { backgroundColor: METHOD_COLORS[method] }]} />
                    <Text style={styles.methodLabel}>{METHOD_LABELS[method]}</Text>
                    {registerPaymentMutation.isPending && <ActivityIndicator color={METHOD_COLORS[method]} size="small" />}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* ── VIEW: PIX QR CODE ── */}
            {view === "pix_qr" && pixData && (
              <View>
                <TouchableOpacity onPress={() => setView("status")} style={styles.backRow}>
                  <Text style={styles.backText}>← Voltar</Text>
                </TouchableOpacity>

                <View style={styles.qrCard}>
                  <Text style={styles.qrTitle}>QR Code Pix</Text>
                  <Text style={styles.qrSub}>Mostre para o cliente escanear com o app do banco</Text>
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
                  <Text style={styles.qrAmount}>R$ {price}</Text>
                  {pixData.expiresAt && (
                    <Text style={styles.qrExpiry}>
                      Válido até {new Date(pixData.expiresAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </Text>
                  )}
                </View>

                {/* Copiar código */}
                <TouchableOpacity
                  style={[styles.actionBtn, copied && styles.actionBtnSuccess]}
                  onPress={handleCopyPix}
                  activeOpacity={0.8}
                >
                  <Text style={styles.actionBtnText}>
                    {copied ? "✓ Código copiado!" : "📋 Copiar código Pix"}
                  </Text>
                </TouchableOpacity>

                {/* Enviar por WhatsApp */}
                {appointment.clientPhone && (
                  <TouchableOpacity
                    style={[styles.actionBtn, { borderColor: "#25D36644" }]}
                    onPress={handleSendWhatsApp}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.actionBtnText, { color: "#25D366" }]}>
                      📲 Enviar código pelo WhatsApp
                    </Text>
                  </TouchableOpacity>
                )}

                {/* Confirmar que foi pago */}
                <Pressable
                  style={({ pressed }) => [styles.confirmBtn, pressed && { opacity: 0.85 }]}
                  onPress={handleConfirmPixPaid}
                  disabled={registerPaymentMutation.isPending}
                >
                  {registerPaymentMutation.isPending ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.confirmBtnText}>Cliente pagou ✓</Text>
                  )}
                </Pressable>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#111827",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: "90%",
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: "#374151",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "800" },
  headerSub: { color: "#9CA3AF", fontSize: 13, marginTop: 2 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#1F2937",
    justifyContent: "center",
    alignItems: "center",
  },
  closeBtnText: { color: "#9CA3AF", fontSize: 14, fontWeight: "700" },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 24, justifyContent: "center" },
  loadingText: { color: "#9CA3AF", fontSize: 14 },
  paidCard: {
    backgroundColor: "#064E3B",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#32BCAD44",
    marginBottom: 16,
  },
  paidIcon: { fontSize: 40 },
  paidTitle: { color: "#fff", fontSize: 18, fontWeight: "800" },
  paidMethod: { color: "#6EE7B7", fontSize: 14 },
  paidAmount: { color: "#32BCAD", fontSize: 28, fontWeight: "800" },
  paidDate: { color: "#6B7280", fontSize: 12 },
  closeFullBtn: {
    marginTop: 8,
    backgroundColor: "#065F46",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  closeFullBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  unpaidBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#1C1917",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F59E0B44",
    marginBottom: 20,
  },
  unpaidIcon: { fontSize: 28 },
  unpaidTitle: { color: "#FCD34D", fontSize: 15, fontWeight: "700" },
  unpaidSub: { color: "#9CA3AF", fontSize: 13, marginTop: 2 },
  sectionLabel: { color: "#6B7280", fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 12 },
  optionBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1F2937",
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    gap: 12,
  },
  optionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  optionText: { flex: 1 },
  optionTitle: { color: "#fff", fontSize: 15, fontWeight: "700" },
  optionSub: { color: "#6B7280", fontSize: 12, marginTop: 2 },
  chevron: { color: "#6B7280", fontSize: 20, fontWeight: "300" },
  backRow: { marginBottom: 16 },
  backText: { color: "#EAB308", fontSize: 15 },
  methodBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1F2937",
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    gap: 12,
  },
  methodDot: { width: 10, height: 10, borderRadius: 5 },
  methodLabel: { color: "#fff", fontSize: 15, fontWeight: "600", flex: 1 },
  qrCard: {
    backgroundColor: "#1F2937",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#32BCAD33",
  },
  qrTitle: { color: "#fff", fontSize: 16, fontWeight: "800" },
  qrSub: { color: "#9CA3AF", fontSize: 12, textAlign: "center" },
  qrImage: { width: 220, height: 220, borderRadius: 12, backgroundColor: "#fff", marginVertical: 8 },
  qrPlaceholder: { justifyContent: "center", alignItems: "center" },
  qrAmount: { color: "#32BCAD", fontSize: 24, fontWeight: "800" },
  qrExpiry: { color: "#6B7280", fontSize: 11 },
  actionBtn: {
    backgroundColor: "#1F2937",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#32BCAD44",
  },
  actionBtnSuccess: { backgroundColor: "#064E3B", borderColor: "#32BCAD" },
  actionBtnText: { color: "#32BCAD", fontWeight: "700", fontSize: 14 },
  confirmBtn: {
    backgroundColor: "#32BCAD",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 4,
  },
  confirmBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});
