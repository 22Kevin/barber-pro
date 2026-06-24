/**
 * Tela de Planos de Assinatura — Admin
 * Permite criar, editar e gerenciar planos de assinatura para clientes.
 */
import React, { useState, useMemo } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { AdminHeader } from "@/components/admin-header";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";
import { useBarberAuth } from "@/lib/auth-context";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type ServiceItem = { id: number; name: string; price: number; duration?: number };
type ProductItem = { id: number; name: string; price: number | string; salePrice?: number | string };

type PlanForm = {
  name: string;
  description: string;
  recurrences: number;
  maxServices: number;
  maxProducts: number;
  price: string;
  selectedServiceIds: number[];
  selectedProductIds: number[];
};

const EMPTY_FORM: PlanForm = {
  name: "",
  description: "",
  recurrences: 4,
  maxServices: 1,
  maxProducts: 0,
  price: "",
  selectedServiceIds: [],
  selectedProductIds: [],
};

const DISCOUNT_FACTOR = 0.85; // 15% de desconto para sugestão de preço

// ─── Componente principal ─────────────────────────────────────────────────────

import { FeatureGate } from "@/components/feature-gate";

function SubscriptionPlansScreenInner() {
  const colors = useColors();
  const { barber } = useBarberAuth();
  const tenantId = barber?.tenantId ?? 0;
  const router = useRouter();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<PlanForm>(EMPTY_FORM);

  // Queries
  const plansQuery = trpc.subscriptionPlans.listPlans.useQuery(
    { tenantId },
    { enabled: tenantId > 0 }
  );
  const servicesQuery = trpc.services.list.useQuery(
    { activeOnly: false, tenantId },
    { enabled: tenantId > 0 }
  );
  const productsQuery = trpc.products.list.useQuery(
    { activeOnly: false, tenantId },
    { enabled: tenantId > 0 }
  );
  const statsQuery = trpc.subscriptionPlans.stats.useQuery(
    { tenantId },
    { enabled: tenantId > 0 }
  );

  const utils = trpc.useUtils();

  // Mutations
  const createMutation = trpc.subscriptionPlans.createPlan.useMutation({
    onSuccess: () => {
      utils.subscriptionPlans.listPlans.invalidate();
      utils.subscriptionPlans.stats.invalidate();
      setShowForm(false);
      setForm(EMPTY_FORM);
    },
    onError: (e) => Alert.alert("Erro", e.message),
  });

  const updateMutation = trpc.subscriptionPlans.updatePlan.useMutation({
    onSuccess: () => {
      utils.subscriptionPlans.listPlans.invalidate();
      setShowForm(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
    },
    onError: (e) => Alert.alert("Erro", e.message),
  });

  const deleteMutation = trpc.subscriptionPlans.deletePlan.useMutation({
    onSuccess: () => {
      utils.subscriptionPlans.listPlans.invalidate();
      utils.subscriptionPlans.stats.invalidate();
    },
    onError: (e) => Alert.alert("Erro", e.message),
  });

  const toggleMutation = trpc.subscriptionPlans.togglePlanActive.useMutation({
    onSuccess: () => utils.subscriptionPlans.listPlans.invalidate(),
  });

  // ── Cálculo de preço sugerido ────────────────────────────────────────────

  const suggestedPrice = useMemo(() => {
    const services = (servicesQuery.data ?? []) as unknown as ServiceItem[];
    const products = ((productsQuery.data ?? []) as any[]).map((p) => ({
      ...p,
      price: parseFloat(String(p.salePrice ?? p.price ?? 0)),
    })) as ProductItem[];

    const selectedServices = services.filter((s) =>
      form.selectedServiceIds.includes(s.id)
    );
    const selectedProducts = products.filter((p) =>
      form.selectedProductIds.includes(p.id)
    );

    // Considera apenas os itens dentro do limite escolhido
    const svcSlice = selectedServices.slice(0, form.maxServices || selectedServices.length);
    const prdSlice = selectedProducts.slice(0, form.maxProducts || selectedProducts.length);

    const svcTotal = svcSlice.reduce((acc, s) => acc + (Number(s.price) || 0), 0);
    const prdTotal = prdSlice.reduce((acc, p) => acc + (Number(p.price) || 0), 0);

    const perSession = svcTotal + prdTotal;
    const fullPrice = perSession * form.recurrences;
    const suggested = fullPrice * DISCOUNT_FACTOR;

    return { perSession, fullPrice, suggested };
  }, [
    form.selectedServiceIds,
    form.selectedProductIds,
    form.maxServices,
    form.maxProducts,
    form.recurrences,
    servicesQuery.data,
    productsQuery.data,
  ]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  function handleNewPlan() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function handleEditPlan(plan: any) {
    setEditingId(plan.id);
    setForm({
      name: plan.name,
      description: plan.description ?? "",
      recurrences: plan.recurrences,
      maxServices: plan.maxServices,
      maxProducts: plan.maxProducts,
      price: String(plan.price),
      selectedServiceIds: (plan.services ?? []).map((s: any) => s.serviceId),
      selectedProductIds: (plan.products ?? []).map((p: any) => p.productId),
    });
    setShowForm(true);
  }

  function handleDeletePlan(plan: any) {
    Alert.alert(
      "Excluir Plano",
      `Deseja excluir o plano "${plan.name}"? Esta ação não pode ser desfeita.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: () => deleteMutation.mutate({ id: plan.id, tenantId }),
        },
      ]
    );
  }

  function handleToggleActive(plan: any) {
    toggleMutation.mutate({ id: plan.id, tenantId, isActive: !plan.isActive });
  }

  function toggleService(id: number) {
    setForm((f) => ({
      ...f,
      selectedServiceIds: f.selectedServiceIds.includes(id)
        ? f.selectedServiceIds.filter((x) => x !== id)
        : [...f.selectedServiceIds, id],
    }));
  }

  function toggleProduct(id: number) {
    setForm((f) => ({
      ...f,
      selectedProductIds: f.selectedProductIds.includes(id)
        ? f.selectedProductIds.filter((x) => x !== id)
        : [...f.selectedProductIds, id],
    }));
  }

  function handleSave() {
    if (!form.name.trim()) {
      Alert.alert("Atenção", "Informe o nome do plano.");
      return;
    }
    if (form.selectedServiceIds.length === 0) {
      Alert.alert("Atenção", "Selecione ao menos um serviço para o plano. Serviços são obrigatórios para criar um plano de assinatura.");
      return;
    }
    const price = parseFloat(form.price.replace(",", "."));
    if (isNaN(price) || price <= 0) {
      Alert.alert("Atenção", "Informe um preço válido para o plano.");
      return;
    }

    const payload = {
      tenantId,
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      recurrences: form.recurrences,
      maxServices: form.maxServices,
      maxProducts: form.maxProducts,
      price,
      suggestedPrice: suggestedPrice.suggested > 0 ? suggestedPrice.suggested : undefined,
      serviceIds: form.selectedServiceIds,
      productIds: form.selectedProductIds,
    };

    if (editingId) {
      updateMutation.mutate({ ...payload, id: editingId });
    } else {
      createMutation.mutate(payload);
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  // ── Render: Formulário ────────────────────────────────────────────────────

  if (showForm) {
    const services = (servicesQuery.data ?? []) as unknown as ServiceItem[];
    const products = ((productsQuery.data ?? []) as any[]).map((p) => ({
      ...p,
      price: parseFloat(String(p.salePrice ?? p.price ?? 0)),
    })) as ProductItem[];

    return (
      <ScreenContainer>
        <AdminHeader
          title={editingId ? "Editar Plano" : "Novo Plano"}
          rightElement={
            <TouchableOpacity
              style={{ padding: 8 }}
              onPress={() => { setShowForm(false); setEditingId(null); }}
            >
              <IconSymbol name="xmark.circle.fill" size={22} color="#C9A84C" />
            </TouchableOpacity>
          }
        />
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={80}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>

          {/* Nome */}
          <Text style={[styles.label, { color: colors.foreground }]}>Nome do Plano *</Text>
          <TextInput
            style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface }]}
            placeholder="Ex: Plano Ouro, Plano Premium..."
            placeholderTextColor={colors.muted}
            value={form.name}
            onChangeText={(t) => setForm((f) => ({ ...f, name: t }))}
          />

          {/* Descrição */}
          <Text style={[styles.label, { color: colors.foreground }]}>Descrição (opcional)</Text>
          <TextInput
            style={[styles.input, styles.textarea, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface }]}
            placeholder="Descreva os benefícios do plano..."
            placeholderTextColor={colors.muted}
            value={form.description}
            onChangeText={(t) => setForm((f) => ({ ...f, description: t }))}
            multiline
            numberOfLines={3}
          />

          {/* Recorrências */}
          <Text style={[styles.label, { color: colors.foreground }]}>Agendamentos por mês *</Text>
          <View style={styles.row}>
            {[1, 2, 3, 4, 5, 6, 8].map((n) => (
              <TouchableOpacity
                key={n}
                style={[styles.chip, { borderColor: colors.border, backgroundColor: form.recurrences === n ? "#C9A84C" : colors.surface }]}
                onPress={() => setForm((f) => ({ ...f, recurrences: n }))}
              >
                <Text style={{ color: form.recurrences === n ? "#0A0A0A" : colors.foreground, fontWeight: "600", fontSize: 14 }}>{n}x</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Serviços */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 }}>
            <Text style={[styles.label, { color: colors.foreground, marginBottom: 0 }]}>Serviços disponíveis no plano</Text>
            <Text style={{ color: colors.error, fontSize: 13, fontWeight: "700" }}>*</Text>
          </View>
          <Text style={[styles.hint, { color: colors.muted }]}>Obrigatório — selecione ao menos 1 serviço para o plano</Text>
          {services.length === 0 ? (
            <Text style={{ color: colors.muted, fontSize: 13, marginBottom: 12 }}>Nenhum serviço cadastrado.</Text>
          ) : (
            services.map((svc) => (
              <TouchableOpacity
                key={svc.id}
                style={[styles.checkRow, { borderColor: colors.border, backgroundColor: form.selectedServiceIds.includes(svc.id) ? "#C9A84C18" : colors.surface }]}
                onPress={() => toggleService(svc.id)}
              >
                <View style={[styles.checkbox, { borderColor: colors.border, backgroundColor: form.selectedServiceIds.includes(svc.id) ? "#C9A84C" : "transparent" }]}>
                  {form.selectedServiceIds.includes(svc.id) && (
                    <IconSymbol name="checkmark" size={12} color="#0A0A0A" />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "500" }}>{svc.name}</Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>R$ {Number(svc.price ?? 0).toFixed(2)} {svc.duration ? `· ${svc.duration} min` : ""}</Text>
                </View>
              </TouchableOpacity>
            ))
          )}

          {/* Quantos serviços o cliente pode escolher */}
          {form.selectedServiceIds.length > 0 && (
            <>
              <Text style={[styles.label, { color: colors.foreground, marginTop: 8 }]}>
                Quantos serviços o cliente pode escolher?
              </Text>
              <View style={styles.row}>
                {[...Array(form.selectedServiceIds.length)].map((_, i) => i + 1).concat(
                  form.selectedServiceIds.length > 1 ? [] : []
                ).map((n) => (
                  <TouchableOpacity
                    key={n}
                    style={[styles.chip, { borderColor: colors.border, backgroundColor: form.maxServices === n ? "#C9A84C" : colors.surface }]}
                    onPress={() => setForm((f) => ({ ...f, maxServices: n }))}
                  >
                    <Text style={{ color: form.maxServices === n ? "#0A0A0A" : colors.foreground, fontWeight: "600", fontSize: 14 }}>
                      {n === form.selectedServiceIds.length ? "Todos" : String(n)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {/* Produtos */}
          <Text style={[styles.label, { color: colors.foreground }]}>Produtos disponíveis no plano</Text>
          <Text style={[styles.hint, { color: colors.muted }]}>Selecione quais produtos fazem parte deste plano (opcional)</Text>
          {products.length === 0 ? (
            <Text style={{ color: colors.muted, fontSize: 13, marginBottom: 12 }}>Nenhum produto cadastrado.</Text>
          ) : (
            products.map((prd) => (
              <TouchableOpacity
                key={prd.id}
                style={[styles.checkRow, { borderColor: colors.border, backgroundColor: form.selectedProductIds.includes(prd.id) ? "#C9A84C18" : colors.surface }]}
                onPress={() => toggleProduct(prd.id)}
              >
                <View style={[styles.checkbox, { borderColor: colors.border, backgroundColor: form.selectedProductIds.includes(prd.id) ? "#C9A84C" : "transparent" }]}>
                  {form.selectedProductIds.includes(prd.id) && (
                    <IconSymbol name="checkmark" size={12} color="#0A0A0A" />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "500" }}>{prd.name}</Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>R$ {Number(prd.price).toFixed(2)}</Text>
                </View>
              </TouchableOpacity>
            ))
          )}

          {/* Quantos produtos o cliente pode escolher */}
          {form.selectedProductIds.length > 0 && (
            <>
              <Text style={[styles.label, { color: colors.foreground, marginTop: 8 }]}>
                Quantos produtos o cliente pode escolher?
              </Text>
              <View style={styles.row}>
                {[...Array(form.selectedProductIds.length)].map((_, i) => i + 1).map((n) => (
                  <TouchableOpacity
                    key={n}
                    style={[styles.chip, { borderColor: colors.border, backgroundColor: form.maxProducts === n ? "#C9A84C" : colors.surface }]}
                    onPress={() => setForm((f) => ({ ...f, maxProducts: n }))}
                  >
                    <Text style={{ color: form.maxProducts === n ? "#0A0A0A" : colors.foreground, fontWeight: "600", fontSize: 14 }}>
                      {n === form.selectedProductIds.length ? "Todos" : String(n)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {/* Resumo de custo e sugestão de preço */}
          {suggestedPrice.fullPrice > 0 && (
            <View style={[styles.priceBox, { backgroundColor: "#C9A84C18", borderColor: "#C9A84C" }]}>
              <Text style={{ color: "#C9A84C", fontWeight: "700", fontSize: 13, marginBottom: 6 }}>
                💡 Resumo de Custo
              </Text>
              <View style={styles.priceRow}>
                <Text style={{ color: colors.muted, fontSize: 13 }}>Custo por sessão</Text>
                <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600" }}>
                  R$ {suggestedPrice.perSession.toFixed(2)}
                </Text>
              </View>
              <View style={styles.priceRow}>
                <Text style={{ color: colors.muted, fontSize: 13 }}>Preço cheio ({form.recurrences}x)</Text>
                <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600" }}>
                  R$ {suggestedPrice.fullPrice.toFixed(2)}
                </Text>
              </View>
              <View style={[styles.priceRow, { marginTop: 4, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#C9A84C40" }]}>
                <Text style={{ color: "#C9A84C", fontSize: 14, fontWeight: "700" }}>Sugestão (15% desc.)</Text>
                <TouchableOpacity onPress={() => setForm((f) => ({ ...f, price: suggestedPrice.suggested.toFixed(2) }))}>
                  <Text style={{ color: "#C9A84C", fontSize: 14, fontWeight: "700" }}>
                    R$ {suggestedPrice.suggested.toFixed(2)} ↑ usar
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Preço final */}
          <Text style={[styles.label, { color: colors.foreground }]}>Preço do Plano (R$) *</Text>
          <TextInput
            style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface }]}
            placeholder="0,00"
            placeholderTextColor={colors.muted}
            value={form.price}
            onChangeText={(t) => setForm((f) => ({ ...f, price: t }))}
            keyboardType="decimal-pad"
          />

          {/* Botão salvar */}
          <TouchableOpacity
            style={[styles.saveBtn, { opacity: isSaving ? 0.6 : 1 }]}
            onPress={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator color="#0A0A0A" />
            ) : (
              <Text style={styles.saveBtnText}>{editingId ? "Salvar Alterações" : "Criar Plano"}</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
        </KeyboardAvoidingView>
      </ScreenContainer>
    );
  }

  // ── Render: Lista de Planos ───────────────────────────────────────────────

  const plans = plansQuery.data ?? [];
  const stats = statsQuery.data;

  return (
    <ScreenContainer>
      <AdminHeader title="Assinaturas" />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>

        {/* Dashboard de métricas */}
        {stats && (
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={{ color: "#C9A84C", fontSize: 22, fontWeight: "700" }}>{stats.activePlans}</Text>
              <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>Planos ativos</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={{ color: "#C9A84C", fontSize: 22, fontWeight: "700" }}>{stats.activeSubs}</Text>
              <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>Assinantes</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={{ color: "#C9A84C", fontSize: 22, fontWeight: "700" }}>
                R$ {stats.mrr.toFixed(0)}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>MRR</Text>
            </View>
          </View>
        )}

        {/* Botão novo plano */}
        <TouchableOpacity style={styles.newBtn} onPress={handleNewPlan}>
          <IconSymbol name="plus" size={18} color="#0A0A0A" />
          <Text style={styles.newBtnText}>Novo Plano</Text>
        </TouchableOpacity>

        {/* Lista de planos */}
        {plansQuery.isLoading ? (
          <ActivityIndicator color="#C9A84C" style={{ marginTop: 40 }} />
        ) : plans.length === 0 ? (
          <View style={styles.emptyState}>
            <IconSymbol name="star.fill" size={40} color={colors.muted} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Nenhum plano criado</Text>
            <Text style={[styles.emptyText, { color: colors.muted }]}>
              Crie planos de assinatura para oferecer pacotes mensais aos seus clientes.
            </Text>
          </View>
        ) : (
          plans.map((plan: any) => (
            <View
              key={plan.id}
              style={[styles.planCard, { backgroundColor: colors.surface, borderColor: plan.isActive ? "#C9A84C40" : colors.border }]}
            >
              {/* Header do card */}
              <View style={styles.planHeader}>
                <View style={{ flex: 1 }}>
                  <View style={styles.planTitleRow}>
                    <Text style={[styles.planName, { color: colors.foreground }]}>{plan.name}</Text>
                    {!plan.isActive && (
                      <View style={[styles.badge, { backgroundColor: colors.border }]}>
                        <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "600" }}>INATIVO</Text>
                      </View>
                    )}
                  </View>
                  {plan.description ? (
                    <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>{plan.description}</Text>
                  ) : null}
                </View>
                <Text style={styles.planPrice}>R$ {parseFloat(plan.price).toFixed(2)}<Text style={{ fontSize: 12, fontWeight: "400" }}>/mês</Text></Text>
              </View>

              {/* Detalhes */}
              <View style={[styles.planDetails, { borderTopColor: colors.border }]}>
                <View style={styles.planDetailItem}>
                  <IconSymbol name="calendar" size={14} color={colors.muted} />
                  <Text style={{ color: colors.muted, fontSize: 12, marginLeft: 4 }}>
                    {plan.recurrences}x por mês
                  </Text>
                </View>
                <View style={styles.planDetailItem}>
                  <IconSymbol name="scissors" size={14} color={colors.muted} />
                  <Text style={{ color: colors.muted, fontSize: 12, marginLeft: 4 }}>
                    {plan.serviceCount} serviço{plan.serviceCount !== 1 ? "s" : ""} · escolhe {plan.maxServices}
                  </Text>
                </View>
                {plan.productCount > 0 && (
                  <View style={styles.planDetailItem}>
                    <IconSymbol name="tag.fill" size={14} color={colors.muted} />
                    <Text style={{ color: colors.muted, fontSize: 12, marginLeft: 4 }}>
                      {plan.productCount} produto{plan.productCount !== 1 ? "s" : ""} · escolhe {plan.maxProducts}
                    </Text>
                  </View>
                )}
                <View style={styles.planDetailItem}>
                  <IconSymbol name="person.2.fill" size={14} color={colors.muted} />
                  <Text style={{ color: colors.muted, fontSize: 12, marginLeft: 4 }}>
                    {plan.activeSubscribers} assinante{plan.activeSubscribers !== 1 ? "s" : ""}
                  </Text>
                </View>
              </View>

              {/* Ações */}
              <View style={[styles.planActions, { borderTopColor: colors.border }]}>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => handleToggleActive(plan)}
                >
                  <IconSymbol
                    name={plan.isActive ? "eye.slash.fill" : "eye.fill"}
                    size={16}
                    color={colors.muted}
                  />
                  <Text style={{ color: colors.muted, fontSize: 12, marginLeft: 4 }}>
                    {plan.isActive ? "Desativar" : "Ativar"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => handleEditPlan(plan)}
                >
                  <IconSymbol name="pencil" size={16} color="#C9A84C" />
                  <Text style={{ color: "#C9A84C", fontSize: 12, marginLeft: 4 }}>Editar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => handleDeletePlan(plan)}
                >
                  <IconSymbol name="trash.fill" size={16} color={colors.error} />
                  <Text style={{ color: colors.error, fontSize: 12, marginLeft: 4 }}>Excluir</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: "600", marginBottom: 6, marginTop: 16 },
  hint: { fontSize: 12, marginBottom: 8, marginTop: -4 },
  input: {
    borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, marginBottom: 4,
  },
  textarea: { height: 80, textAlignVertical: "top" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1,
    minWidth: 44, alignItems: "center",
  },
  checkRow: {
    flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 10,
    borderWidth: 1, marginBottom: 8, gap: 12,
  },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 1.5,
    alignItems: "center", justifyContent: "center",
  },
  priceBox: {
    borderWidth: 1, borderRadius: 12, padding: 14, marginTop: 16, marginBottom: 4,
  },
  priceRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  saveBtn: {
    backgroundColor: "#C9A84C", borderRadius: 12, paddingVertical: 16,
    alignItems: "center", marginTop: 24,
  },
  saveBtnText: { color: "#0A0A0A", fontSize: 16, fontWeight: "700" },
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  statCard: {
    flex: 1, borderRadius: 12, borderWidth: 1, padding: 12, alignItems: "center",
  },
  newBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: "#C9A84C", borderRadius: 12, paddingVertical: 14, gap: 8, marginBottom: 20,
  },
  newBtnText: { color: "#0A0A0A", fontSize: 15, fontWeight: "700" },
  emptyState: { alignItems: "center", paddingVertical: 48, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  emptyText: { fontSize: 14, textAlign: "center", maxWidth: 280 },
  planCard: { borderRadius: 14, borderWidth: 1, marginBottom: 16, overflow: "hidden" },
  planHeader: { flexDirection: "row", alignItems: "flex-start", padding: 16, gap: 12 },
  planTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  planName: { fontSize: 17, fontWeight: "700" },
  planPrice: { color: "#C9A84C", fontSize: 18, fontWeight: "700" },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  planDetails: { paddingHorizontal: 16, paddingBottom: 12, borderTopWidth: 1, paddingTop: 12, gap: 6 },
  planDetailItem: { flexDirection: "row", alignItems: "center" },
  planActions: {
    flexDirection: "row", borderTopWidth: 1, paddingVertical: 10, paddingHorizontal: 8,
  },
  actionBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingVertical: 6,
  },
});

export default function SubscriptionPlansScreen() {
  return (
    <FeatureGate feature="subscription_plans">
      <SubscriptionPlansScreenInner />
    </FeatureGate>
  );
}
