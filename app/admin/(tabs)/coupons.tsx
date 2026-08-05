import { useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, Switch, Text, TextInput, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { AdminHeader } from "@/components/admin-header";
import { trpc } from "@/lib/trpc";
import { KeyboardAwareForm } from "@/components/keyboard-aware-form";
import { useBarberAuth } from "@/lib/auth-context";
import { useColors } from "@/hooks/use-colors";
import { useTabBarHeight } from "@/hooks/use-tab-bar-height";

import { FeatureGate } from "@/components/feature-gate";

function CouponsScreenInner() {
  const { barber } = useBarberAuth();
  const colors = useColors();
  const tabBarHeight = useTabBarHeight();
  const tenantId = barber?.tenantId ?? 0;
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [code, setCode] = useState("");
  const [discount, setDiscount] = useState("");
  const [type, setType] = useState<"percent" | "fixed">("percent");
  const [maxUses, setMaxUses] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  const utils = trpc.useUtils();
  const couponsQuery = trpc.coupons.list.useQuery({ tenantId }, { enabled: tenantId > 0 });

  const createMutation = trpc.coupons.create.useMutation({
    onSuccess: () => {
      utils.coupons.list.invalidate();
      setShowForm(false);
      setCode(""); setDiscount(""); setMaxUses(""); setExpiresAt("");
      Alert.alert("✅ Cupom criado!");
    },
    onError: (e) => Alert.alert("Erro", e.message),
  });

  const toggleMutation = trpc.coupons.toggle.useMutation({
    onSuccess: () => utils.coupons.list.invalidate(),
    onError: (e) => Alert.alert("Erro", e.message),
  });

  const deleteMutation = trpc.coupons.delete.useMutation({
    onSuccess: () => utils.coupons.list.invalidate(),
    onError: (e) => Alert.alert("Erro", e.message),
  });

  async function onRefresh() {
    setRefreshing(true);
    await couponsQuery.refetch();
    setRefreshing(false);
  }

  function handleCreate() {
    if (!code.trim()) { Alert.alert("Informe o código do cupom"); return; }
    if (!discount.trim() || isNaN(Number(discount))) { Alert.alert("Informe o desconto"); return; }
    createMutation.mutate({
      tenantId,
      code: code.trim().toUpperCase(),
      discountType: type,
      discountValue: discount.trim(),
      maxUses: maxUses ? Number(maxUses) : undefined,
      validUntil: expiresAt || undefined,
    });
  }

  const dyn = {
    card: { backgroundColor: colors.surface, borderRadius: 14, marginHorizontal: 16, marginBottom: 10, borderWidth: 1, borderColor: colors.border, padding: 14 },
    code: { fontSize: 16, fontWeight: "800" as const, color: colors.primary, fontFamily: "monospace", letterSpacing: 1 },
    sub: { fontSize: 12, color: colors.muted, marginTop: 3 },
    input: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: colors.text, marginBottom: 12 },
    label: { fontSize: 12, fontWeight: "700" as const, color: colors.muted, textTransform: "uppercase" as const, letterSpacing: 0.5, marginBottom: 6 },
  };

  const coupons = (couponsQuery.data ?? []) as any[];

  return (
    <ScreenContainer containerClassName="bg-background" edges={["left", "right"]}>
      <AdminHeader title="Cupons" rightElement={
        <Pressable onPress={() => setShowForm(!showForm)} style={{ backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 }}>
          <Text style={{ fontSize: 13, fontWeight: "700", color: "#0A0A0A" }}>{showForm ? "Cancelar" : "+ Novo"}</Text>
        </Pressable>
      } />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={0}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >

        {/* Formulário */}
        {showForm && (
          <View style={{ backgroundColor: colors.surface, borderRadius: 14, margin: 16, borderWidth: 1, borderColor: colors.border, padding: 16 }}>
            <Text style={{ fontSize: 15, fontWeight: "800", color: colors.text, marginBottom: 16 }}>Novo Cupom</Text>

            <Text style={dyn.label}>Código</Text>
            <TextInput style={dyn.input} value={code} onChangeText={(t) => setCode(t.toUpperCase())} placeholder="EX: DESCONTO10" placeholderTextColor={colors.muted} autoCapitalize="characters" />

            <Text style={dyn.label}>Tipo de desconto</Text>
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
              {(["percent", "fixed"] as const).map((t) => (
                <Pressable key={t} onPress={() => setType(t)} style={{ flex: 1, padding: 10, borderRadius: 10, borderWidth: 1.5, borderColor: type === t ? colors.primary : colors.border, backgroundColor: type === t ? colors.primary + "22" : colors.background, alignItems: "center" }}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: type === t ? colors.primary : colors.muted }}>{t === "percent" ? "% Percentual" : "R$ Fixo"}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={dyn.label}>Valor ({type === "percent" ? "%" : "R$"})</Text>
            <TextInput style={dyn.input} value={discount} onChangeText={setDiscount} keyboardType="numeric" placeholder={type === "percent" ? "10" : "15.00"} placeholderTextColor={colors.muted} />

            <Text style={dyn.label}>Máximo de usos (opcional)</Text>
            <TextInput style={dyn.input} value={maxUses} onChangeText={setMaxUses} keyboardType="numeric" placeholder="Ilimitado" placeholderTextColor={colors.muted} />

            <Text style={dyn.label}>Validade (opcional, AAAA-MM-DD)</Text>
            <TextInput style={dyn.input} value={expiresAt} onChangeText={setExpiresAt} placeholder="2026-12-31" placeholderTextColor={colors.muted} />

            <Pressable onPress={handleCreate} style={{ backgroundColor: colors.primary, borderRadius: 12, padding: 14, alignItems: "center", marginTop: 4 }}>
              {createMutation.isPending ? <ActivityIndicator color="#0A0A0A" /> : <Text style={{ fontSize: 15, fontWeight: "800", color: "#0A0A0A" }}>Criar Cupom</Text>}
            </Pressable>
          </View>
        )}

        {/* Lista */}
        {couponsQuery.isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : coupons.length === 0 && !showForm ? (
          <View style={{ padding: 40, alignItems: "center" }}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>🎟️</Text>
            <Text style={{ fontSize: 15, color: colors.muted }}>Nenhum cupom criado</Text>
          </View>
        ) : (
          coupons.map((c: any) => (
            <View key={c.id} style={dyn.card}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <View style={{ flex: 1 }}>
                  <Text style={dyn.code}>{c.code}</Text>
                  <Text style={[dyn.sub, { marginTop: 6 }]}>
                    {c.discountType === "percent" ? `${c.discountValue}% de desconto` : `R$ ${Number(c.discountValue).toFixed(2)} de desconto`}
                  </Text>
                  <Text style={dyn.sub}>
                    {c.usedCount ?? 0} uso{(c.usedCount ?? 0) !== 1 ? "s" : ""}{c.maxUses ? ` / ${c.maxUses} máx.` : ""}
                    {c.expiresAt ? ` · Válido até ${c.expiresAt.split("T")[0].split("-").reverse().join("/")}` : ""}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 8 }}>
                  <Switch
                    value={c.isActive !== false}
                    onValueChange={() => toggleMutation.mutate({ id: c.id })}
                    trackColor={{ true: colors.primary, false: colors.border }}
                    thumbColor="#fff"
                  />
                  <Pressable onPress={() => Alert.alert("Excluir cupom?", c.code, [
                    { text: "Cancelar", style: "cancel" },
                    { text: "Excluir", style: "destructive", onPress: () => deleteMutation.mutate({ id: c.id }) }
                  ])}>
                    <Text style={{ fontSize: 12, color: "#F87171" }}>Excluir</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          ))
        )}

        <View style={{ height: tabBarHeight + 16 }} />
      </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

export default function CouponsScreen() {
  return (
    <FeatureGate feature="coupons">
      <CouponsScreenInner />
    </FeatureGate>
  );
}
