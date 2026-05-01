import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  StyleSheet,
  Linking,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { trpc } from "@/lib/trpc";

function maskCardNumber(v: string) {
  return v.replace(/\D/g, "").substring(0, 16).replace(/(.{4})/g, "$1 ").trim();
}
function maskExpiry(v: string) {
  const d = v.replace(/\D/g, "").substring(0, 6);
  if (d.length <= 2) return d;
  return d.substring(0, 2) + "/" + d.substring(2);
}
function maskCpf(v: string) {
  const d = v.replace(/\D/g, "").substring(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return d.substring(0, 3) + "." + d.substring(3);
  if (d.length <= 9) return d.substring(0, 3) + "." + d.substring(3, 6) + "." + d.substring(6);
  return d.substring(0, 3) + "." + d.substring(3, 6) + "." + d.substring(6, 9) + "-" + d.substring(9);
}
function maskCep(v: string) {
  const d = v.replace(/\D/g, "").substring(0, 8);
  if (d.length <= 5) return d;
  return d.substring(0, 5) + "-" + d.substring(5);
}

export default function AsaasCardPaymentScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    appointmentId: string;
    serviceId: string;
    serviceName: string;
    servicePrice: string;
    clientName: string;
    clientEmail: string;
    clientPhone: string;
    clientId: string;
    tenantId: string;
    barberId: string;
    date: string;
    startTime: string;
  }>();

  const amount = parseFloat(params.servicePrice || "0");

  const [holderName, setHolderName] = useState(params.clientName || "");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [cpf, setCpf] = useState("");
  const [cep, setCep] = useState("");
  const [addressNumber, setAddressNumber] = useState("");

  const createCard = trpc.asaasPayments.createCard.useMutation({
    onSuccess: (data) => {
      if (data.status === "CONFIRMED" || data.status === "RECEIVED") {
        Alert.alert(
          "✅ Pagamento aprovado!",
          `Seu agendamento de ${params.serviceName} em ${params.date} às ${params.startTime} foi confirmado.`,
          [{ text: "Ver meus agendamentos", onPress: () => router.replace("/client/(tabs)/history" as any) }]
        );
      } else if (data.invoiceUrl) {
        Alert.alert(
          "Pagamento em processamento",
          "Seu pagamento está sendo processado. Você pode acompanhar pelo link da fatura.",
          [
            { text: "Ver fatura", onPress: () => Linking.openURL(data.invoiceUrl!) },
            { text: "Ver agendamentos", onPress: () => router.replace("/client/(tabs)/history" as any) },
          ]
        );
      } else {
        Alert.alert(
          "Pagamento enviado",
          "Seu pagamento foi enviado e está sendo processado.",
          [{ text: "Ver agendamentos", onPress: () => router.replace("/client/(tabs)/history" as any) }]
        );
      }
    },
    onError: (err) => {
      Alert.alert("Erro no pagamento", err.message ?? "Verifique os dados do cartão e tente novamente.");
    },
  });

  const handleSubmit = () => {
    const rawCard = cardNumber.replace(/\s/g, "");
    const rawCpf = cpf.replace(/\D/g, "");
    const rawCep = cep.replace(/\D/g, "");
    const [expMonth, expYear] = expiry.split("/");

    if (!holderName.trim()) { Alert.alert("Atenção", "Informe o nome do titular do cartão."); return; }
    if (rawCard.length < 13) { Alert.alert("Atenção", "Número do cartão inválido."); return; }
    if (!expMonth || !expYear || expMonth.length !== 2 || expYear.length !== 4) { Alert.alert("Atenção", "Data de validade inválida. Use MM/AAAA."); return; }
    if (cvv.length < 3) { Alert.alert("Atenção", "CVV inválido."); return; }
    if (rawCpf.length !== 11) { Alert.alert("Atenção", "CPF inválido."); return; }
    if (rawCep.length !== 8) { Alert.alert("Atenção", "CEP inválido."); return; }
    if (!addressNumber.trim()) { Alert.alert("Atenção", "Informe o número do endereço."); return; }

    createCard.mutate({
      tenantId: parseInt(params.tenantId || "0"),
      clientId: parseInt(params.clientId || "0"),
      clientName: params.clientName || "",
      clientEmail: params.clientEmail || null,
      clientPhone: params.clientPhone || null,
      clientCpf: rawCpf,
      clientAddressNumber: addressNumber,
      clientPostalCode: rawCep,
      appointmentId: params.appointmentId ? parseInt(params.appointmentId) : null,
      amount,
      description: `Agendamento: ${params.serviceName}`,
      cardHolderName: holderName,
      cardNumber: rawCard,
      cardExpMonth: expMonth,
      cardExpYear: expYear,
      cardCvv: cvv,
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.title}>💳 Pagar com cartão</Text>
      </View>

      {/* Resumo */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryService}>{params.serviceName}</Text>
        <Text style={styles.summaryDate}>{params.date} às {params.startTime}</Text>
        <Text style={styles.summaryAmount}>R$ {amount.toFixed(2).replace(".", ",")}</Text>
      </View>

      {/* Formulário */}
      <View style={styles.form}>
        <Text style={styles.sectionTitle}>Dados do cartão</Text>

        <Text style={styles.label}>Nome impresso no cartão</Text>
        <TextInput
          style={styles.input}
          value={holderName}
          onChangeText={setHolderName}
          placeholder="NOME SOBRENOME"
          placeholderTextColor="#6B7280"
          autoCapitalize="characters"
          returnKeyType="next"
        />

        <Text style={styles.label}>Número do cartão</Text>
        <TextInput
          style={styles.input}
          value={cardNumber}
          onChangeText={(v) => setCardNumber(maskCardNumber(v))}
          placeholder="0000 0000 0000 0000"
          placeholderTextColor="#6B7280"
          keyboardType="numeric"
          maxLength={19}
          returnKeyType="next"
        />

        <View style={styles.row}>
          <View style={styles.half}>
            <Text style={styles.label}>Validade</Text>
            <TextInput
              style={styles.input}
              value={expiry}
              onChangeText={(v) => setExpiry(maskExpiry(v))}
              placeholder="MM/AAAA"
              placeholderTextColor="#6B7280"
              keyboardType="numeric"
              maxLength={7}
              returnKeyType="next"
            />
          </View>
          <View style={styles.half}>
            <Text style={styles.label}>CVV</Text>
            <TextInput
              style={styles.input}
              value={cvv}
              onChangeText={(v) => setCvv(v.replace(/\D/g, "").substring(0, 4))}
              placeholder="123"
              placeholderTextColor="#6B7280"
              keyboardType="numeric"
              maxLength={4}
              secureTextEntry
              returnKeyType="next"
            />
          </View>
        </View>

        <Text style={styles.sectionTitle}>Dados do titular</Text>

        <Text style={styles.label}>CPF do titular</Text>
        <TextInput
          style={styles.input}
          value={cpf}
          onChangeText={(v) => setCpf(maskCpf(v))}
          placeholder="000.000.000-00"
          placeholderTextColor="#6B7280"
          keyboardType="numeric"
          maxLength={14}
          returnKeyType="next"
        />

        <View style={styles.row}>
          <View style={[styles.half, { flex: 2, marginRight: 8 }]}>
            <Text style={styles.label}>CEP</Text>
            <TextInput
              style={styles.input}
              value={cep}
              onChangeText={(v) => setCep(maskCep(v))}
              placeholder="00000-000"
              placeholderTextColor="#6B7280"
              keyboardType="numeric"
              maxLength={9}
              returnKeyType="next"
            />
          </View>
          <View style={[styles.half, { flex: 1 }]}>
            <Text style={styles.label}>Número</Text>
            <TextInput
              style={styles.input}
              value={addressNumber}
              onChangeText={setAddressNumber}
              placeholder="123"
              placeholderTextColor="#6B7280"
              keyboardType="numeric"
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, createCard.isPending && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={createCard.isPending}
        >
          {createCard.isPending ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.submitText}>Pagar R$ {amount.toFixed(2).replace(".", ",")}</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.secureNote}>🔒 Pagamento seguro via Asaas</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0A0A0A" },
  content: { padding: 20, paddingBottom: 40 },
  header: { marginBottom: 20 },
  backBtn: { marginBottom: 12 },
  backText: { color: "#9CA3AF", fontSize: 14 },
  title: { color: "#FFFFFF", fontSize: 22, fontWeight: "800" },
  summaryCard: {
    backgroundColor: "#1A1A1A",
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  summaryService: { color: "#FFFFFF", fontSize: 16, fontWeight: "700", marginBottom: 4 },
  summaryDate: { color: "#9CA3AF", fontSize: 13, marginBottom: 8 },
  summaryAmount: { color: "#EAB308", fontSize: 24, fontWeight: "800" },
  form: {},
  sectionTitle: { color: "#EAB308", fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12, marginTop: 8 },
  label: { color: "#9CA3AF", fontSize: 12, marginBottom: 4, marginTop: 8 },
  input: {
    backgroundColor: "#1A1A1A",
    borderWidth: 1,
    borderColor: "#2A2A2A",
    borderRadius: 10,
    padding: 14,
    color: "#FFFFFF",
    fontSize: 16,
  },
  row: { flexDirection: "row", gap: 12 },
  half: { flex: 1 },
  submitBtn: {
    backgroundColor: "#EAB308",
    borderRadius: 14,
    padding: 18,
    alignItems: "center",
    marginTop: 24,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitText: { color: "#000000", fontWeight: "800", fontSize: 17 },
  secureNote: { color: "#4B5563", fontSize: 12, textAlign: "center", marginTop: 12 },
});
