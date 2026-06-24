import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useBarberAuth } from "@/lib/auth-context";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";
import { ScreenContainer } from "@/components/screen-container";
import { AdminHeader } from "@/components/admin-header";
import { AppAlert } from "@/components/app-alert";
import { IconSymbol } from "@/components/ui/icon-symbol";

function maskPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").replace(/-$/, "");
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3").replace(/-$/, "");
}

function maskCpfCnpj(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, "$1.$2.$3-$4").replace(/-$/, "");
  return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/, "$1.$2.$3/$4-$5").replace(/-$/, "");
}

function maskCep(v: string) {
  return v.replace(/\D/g, "").slice(0, 8).replace(/(\d{5})(\d{0,3})/, "$1-$2").replace(/-$/, "");
}

const STATUS_INFO: Record<string, { label: string; color: string; icon: string }> = {
  not_configured: { label: "Não configurado", color: "#888", icon: "xmark.circle" },
  pending: { label: "Aguardando aprovação", color: "#F59E0B", icon: "clock" },
  active: { label: "Conta ativa ✓", color: "#22C55E", icon: "checkmark.circle.fill" },
  rejected: { label: "Rejeitado", color: "#EF4444", icon: "xmark.circle.fill" },
};

export default function AsaasSetupScreen() {
  const { barber } = useBarberAuth();
  const colors = useColors();
  const tenantId = barber?.tenantId ?? 0;
  const utils = trpc.useUtils();

  const statusQuery = trpc.asaasPayments.getSubAccountStatus.useQuery(
    { tenantId },
    { enabled: !!tenantId }
  );

  const syncMutation = trpc.asaasPayments.syncSubAccountStatus.useMutation({
    onSuccess: () => { utils.asaasPayments.getSubAccountStatus.invalidate({ tenantId }); },
  });

  const setupMutation = trpc.asaasPayments.setupSubAccount.useMutation({
    onSuccess: (data) => {
      utils.asaasPayments.getSubAccountStatus.invalidate({ tenantId });
      AppAlert.alert(
        "Conta criada!",
        data.alreadyExists
          ? "Sua conta já estava configurada."
          : "Conta de recebimentos criada com sucesso! Aguarde a aprovação do Asaas (pode levar até 24h).",
        [{ text: "OK" }]
      );
    },
    onError: (e) => {
      AppAlert.alert("Erro", e.message ?? "Não foi possível criar a conta. Verifique os dados e tente novamente.");
    },
  });

  const status = statusQuery.data?.status ?? "not_configured";
  const statusInfo = STATUS_INFO[status] ?? STATUS_INFO.not_configured;

  const [form, setForm] = useState({
    name: "",
    email: "",
    mobilePhone: "",
    cpfCnpj: "",
    companyType: "" as "" | "MEI" | "LIMITED" | "INDIVIDUAL" | "ASSOCIATION",
    birthDate: "",
    incomeValue: "",
    address: "",
    addressNumber: "",
    province: "",
    postalCode: "",
  });

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = () => {
    if (!form.name.trim() || !form.email.trim() || !form.mobilePhone || !form.cpfCnpj) {
      AppAlert.alert("Campos obrigatórios", "Preencha nome, e-mail, celular e CPF/CNPJ.");
      return;
    }
    const digits = form.cpfCnpj.replace(/\D/g, "");
    if (digits.length !== 11 && digits.length !== 14) {
      AppAlert.alert("CPF/CNPJ inválido", "Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.");
      return;
    }
    setupMutation.mutate({
      tenantId,
      name: form.name.trim(),
      email: form.email.trim(),
      cpfCnpj: digits,
      companyType: form.companyType || undefined,
      mobilePhone: form.mobilePhone.replace(/\D/g, ""),
      birthDate: form.birthDate || undefined,
      address: form.address || undefined,
      addressNumber: form.addressNumber || undefined,
      province: form.province || undefined,
      postalCode: form.postalCode || undefined,
    });
  };

  return (
    <ScreenContainer>
      <AdminHeader title="Pagamentos Online" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={80}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>

          {/* Status card */}
          <View style={[s.statusCard, { borderColor: statusInfo.color + "44", backgroundColor: statusInfo.color + "11" }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={[s.statusDot, { backgroundColor: statusInfo.color }]} />
              <Text style={[s.statusLabel, { color: statusInfo.color }]}>{statusInfo.label}</Text>
            </View>
            {status === "pending" && (
              <Pressable
                style={[s.syncBtn, { borderColor: colors.border }]}
                onPress={() => syncMutation.mutate({ tenantId })}
                disabled={syncMutation.isPending}
              >
                {syncMutation.isPending
                  ? <ActivityIndicator size="small" color="#C9A84C" />
                  : <Text style={{ color: "#C9A84C", fontSize: 13 }}>↻ Verificar aprovação</Text>
                }
              </Pressable>
            )}
          </View>

          {/* Info banner */}
          <View style={[s.infoBanner, { borderColor: "#C9A84C44" }]}>
            <Text style={{ color: "#C9A84C", fontSize: 13, fontWeight: "700", marginBottom: 4 }}>
              💳 Como funciona
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>
              Ao criar sua conta de recebimentos, seus clientes poderão pagar via Pix ou cartão de crédito diretamente pelo link de pagamento. O dinheiro cai na sua conta bancária, sem passar pelo Barber Pro.{"\n\n"}
              Os dados são enviados diretamente ao Asaas, empresa regulamentada pelo Banco Central. O Barber Pro não armazena dados bancários.
            </Text>
          </View>

          {status === "active" ? (
            <View style={[s.activeCard, { backgroundColor: "#22C55E11", borderColor: "#22C55E33" }]}>
              <Text style={{ color: "#22C55E", fontSize: 15, fontWeight: "700", marginBottom: 4 }}>
                ✓ Pagamentos online ativos
              </Text>
              <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 18 }}>
                Sua conta está ativa. Os clientes já podem pagar via Pix ou cartão de crédito. O dinheiro é depositado direto na sua conta bancária.
              </Text>
            </View>
          ) : status !== "pending" ? (
            <>
              {/* Form */}
              <Text style={[s.sectionTitle, { color: colors.foreground }]}>Dados para cadastro</Text>

              <Text style={[s.label, { color: colors.muted }]}>Nome completo / Razão social *</Text>
              <TextInput style={[s.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface }]}
                value={form.name} onChangeText={set("name")} placeholder="Ex: João Silva ou Barbearia Silva Ltda" placeholderTextColor={colors.muted} />

              <Text style={[s.label, { color: colors.muted }]}>E-mail *</Text>
              <TextInput style={[s.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface }]}
                value={form.email} onChangeText={set("email")} keyboardType="email-address" autoCapitalize="none"
                placeholder="contato@barbearia.com" placeholderTextColor={colors.muted} />

              <Text style={[s.label, { color: colors.muted }]}>Celular *</Text>
              <TextInput style={[s.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface }]}
                value={form.mobilePhone} onChangeText={(v) => set("mobilePhone")(maskPhone(v))}
                keyboardType="phone-pad" placeholder="(11) 99999-9999" placeholderTextColor={colors.muted} />

              <Text style={[s.label, { color: colors.muted }]}>CPF ou CNPJ *</Text>
              <TextInput style={[s.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface }]}
                value={form.cpfCnpj} onChangeText={(v) => set("cpfCnpj")(maskCpfCnpj(v))}
                keyboardType="numeric" placeholder="000.000.000-00 ou 00.000.000/0001-00" placeholderTextColor={colors.muted} />

              <Text style={[s.label, { color: colors.muted }]}>Tipo de empresa</Text>
              <View style={[s.pickerRow]}>
                {(["", "MEI", "LIMITED", "INDIVIDUAL"] as const).map((opt) => (
                  <Pressable key={opt} style={[s.chip, { borderColor: form.companyType === opt ? "#C9A84C" : colors.border, backgroundColor: form.companyType === opt ? "#C9A84C22" : colors.surface }]}
                    onPress={() => setForm((f) => ({ ...f, companyType: opt }))}>
                    <Text style={{ fontSize: 12, color: form.companyType === opt ? "#C9A84C" : colors.muted }}>
                      {opt === "" ? "Pessoa Física" : opt === "LIMITED" ? "Ltda/S.A." : opt}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {!form.companyType && (
                <>
                  <Text style={[s.label, { color: colors.muted }]}>Data de nascimento *</Text>
                  <TextInput style={[s.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface }]}
                    value={form.birthDate} onChangeText={set("birthDate")}
                    placeholder="AAAA-MM-DD" placeholderTextColor={colors.muted} />
                </>
              )}

              <Text style={[s.label, { color: colors.muted }]}>Renda / Faturamento mensal (R$) *</Text>
              <TextInput style={[s.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface }]}
                value={form.incomeValue} onChangeText={set("incomeValue")}
                keyboardType="numeric" placeholder="Ex: 5000" placeholderTextColor={colors.muted} />
              <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 12, marginTop: -8 }}>
                Exigido pelo Asaas para compliance financeiro (Banco Central).
              </Text>

              <Text style={[s.sectionDivider, { color: colors.muted, borderTopColor: colors.border }]}>ENDEREÇO (OPCIONAL)</Text>

              <Text style={[s.label, { color: colors.muted }]}>Endereço</Text>
              <TextInput style={[s.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface }]}
                value={form.address} onChangeText={set("address")} placeholder="Rua, Avenida..." placeholderTextColor={colors.muted} />

              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.label, { color: colors.muted }]}>Número</Text>
                  <TextInput style={[s.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface }]}
                    value={form.addressNumber} onChangeText={set("addressNumber")} keyboardType="numeric" placeholder="123" placeholderTextColor={colors.muted} />
                </View>
                <View style={{ flex: 2 }}>
                  <Text style={[s.label, { color: colors.muted }]}>Bairro</Text>
                  <TextInput style={[s.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface }]}
                    value={form.province} onChangeText={set("province")} placeholder="Bairro" placeholderTextColor={colors.muted} />
                </View>
              </View>

              <Text style={[s.label, { color: colors.muted }]}>CEP</Text>
              <TextInput style={[s.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface }]}
                value={form.postalCode} onChangeText={(v) => set("postalCode")(maskCep(v))}
                keyboardType="numeric" placeholder="00000-000" placeholderTextColor={colors.muted} />

              <Pressable
                style={[s.btn, { opacity: setupMutation.isPending ? 0.6 : 1 }]}
                onPress={handleSubmit}
                disabled={setupMutation.isPending}
              >
                {setupMutation.isPending
                  ? <ActivityIndicator color="#0A0A0A" />
                  : <Text style={s.btnText}>Criar conta de recebimentos</Text>
                }
              </Pressable>
            </>
          ) : (
            <View style={[s.pendingCard, { backgroundColor: "#F59E0B11", borderColor: "#F59E0B33" }]}>
              <Text style={{ color: "#F59E0B", fontSize: 15, fontWeight: "700", marginBottom: 4 }}>
                ⏳ Aguardando aprovação
              </Text>
              <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 18 }}>
                Sua conta foi criada e está em análise pelo Asaas. O processo pode levar até 24 horas. Toque em "Verificar aprovação" para checar o status.
              </Text>
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  statusCard: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusLabel: { fontSize: 14, fontWeight: "700" },
  syncBtn: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  infoBanner: { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 20, backgroundColor: "#C9A84C08" },
  activeCard: { borderRadius: 12, borderWidth: 1, padding: 16, marginBottom: 20 },
  pendingCard: { borderRadius: 12, borderWidth: 1, padding: 16, marginBottom: 20 },
  sectionTitle: { fontSize: 15, fontWeight: "700", marginBottom: 14 },
  sectionDivider: { fontSize: 11, fontWeight: "700", letterSpacing: 1, paddingTop: 16, marginBottom: 14, borderTopWidth: 1 },
  label: { fontSize: 13, marginBottom: 6, marginTop: 4 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 15, marginBottom: 12 },
  pickerRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  chip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  btn: { backgroundColor: "#C9A84C", borderRadius: 14, padding: 16, alignItems: "center", marginTop: 8 },
  btnText: { color: "#0A0A0A", fontSize: 16, fontWeight: "700" },
});
