import { useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Linking,
  Pressable,,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";
import { AdminHeader } from "@/components/admin-header";
import { useBarberAuth } from "@/lib/auth-context";
import { applyDocumentMask, applyPhoneMask, stripMask } from "@/hooks/use-mask";

type Supplier = {
  id: number;
  tenantId: number;
  name: string;
  phone: string | null;
  email: string | null;
  cnpj: string | null;
  address: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type Product = {
  id: number;
  name: string;
  description: string | null;
  price: string;
  stock: number;
  stockQuantity?: number;
  minStockAlert?: number;
  productType?: string;
  isActive: boolean;
};

type StockEntry = {
  id: number;
  productId: number;
  productName: string;
  quantity: number;
  date: string;
  reason: string | null;
  barberName: string | null;
};

type FormData = {
  name: string;
  phone: string;
  email: string;
  cnpj: string;
  address: string;
  notes: string;
};

const EMPTY_FORM: FormData = { name: "", phone: "", email: "", cnpj: "", address: "", notes: "" };

import { FeatureGate } from "@/components/feature-gate";

function SuppliersScreenInner() {
  const colors = useColors();
  const { barber } = useBarberAuth();
  const tenantId = barber?.tenantId ?? 0;

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);

  // Detalhes do fornecedor
  const [detailSupplier, setDetailSupplier] = useState<Supplier | null>(null);
  const [detailTab, setDetailTab] = useState<"products" | "history">("products");

  const { data: suppliers = [], refetch, isLoading } = trpc.suppliers.list.useQuery(
    { tenantId },
    { enabled: tenantId > 0 }
  );

  // Queries de detalhes — só ativas quando um fornecedor está selecionado
  const supplierProductsQuery = trpc.suppliers.products.useQuery(
    { supplierId: detailSupplier?.id ?? 0, tenantId },
    { enabled: !!detailSupplier }
  );
  const supplierHistoryQuery = trpc.suppliers.history.useQuery(
    { supplierId: detailSupplier?.id ?? 0, tenantId, limit: 50 },
    { enabled: !!detailSupplier }
  );

  const supplierProducts = (supplierProductsQuery.data ?? []) as Product[];
  const supplierHistory = (supplierHistoryQuery.data ?? []) as StockEntry[];

  const totalEntradas = supplierHistory.reduce((s, m) => s + (m.quantity > 0 ? m.quantity : 0), 0);
  const lowStockCount = supplierProducts.filter(p => {
    const stock = p.stockQuantity ?? p.stock ?? 0;
    return p.isActive && stock <= (p.minStockAlert ?? 5);
  }).length;

  const createMutation = trpc.suppliers.create.useMutation({
    onSuccess: () => { refetch(); closeModal(); },
    onError: (e) => Alert.alert("Erro", e.message),
  });

  const updateMutation = trpc.suppliers.update.useMutation({
    onSuccess: () => { refetch(); closeModal(); },
    onError: (e) => Alert.alert("Erro", e.message),
  });

  const deleteMutation = trpc.suppliers.delete.useMutation({
    onSuccess: () => refetch(),
    onError: (e) => Alert.alert("Erro", e.message),
  });

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  }

  function openEdit(s: Supplier) {
    setEditingId(s.id);
    setForm({
      name: s.name,
      phone: s.phone ? applyPhoneMask(s.phone) : "",
      email: s.email ?? "",
      cnpj: s.cnpj ? applyDocumentMask(s.cnpj) : "",
      address: s.address ?? "",
      notes: s.notes ?? "",
    });
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  function openDetail(s: Supplier) {
    setDetailSupplier(s);
    setDetailTab("products");
  }

  function handleSave() {
    if (!form.name.trim()) {
      Alert.alert("Atenção", "O nome do fornecedor é obrigatório.");
      return;
    }
    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim() ? stripMask(form.phone) : undefined,
      email: form.email.trim() || undefined,
      cnpj: form.cnpj.trim() ? stripMask(form.cnpj) : undefined,
      address: form.address.trim() || undefined,
      notes: form.notes.trim() || undefined,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, ...payload });
    } else {
      createMutation.mutate({ tenantId, ...payload });
    }
  }

  function handleDelete(s: Supplier) {
    Alert.alert(
      "Excluir Fornecedor",
      `Deseja excluir "${s.name}"? Esta ação não pode ser desfeita.`,
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Excluir", style: "destructive", onPress: () => deleteMutation.mutate({ id: s.id }) },
      ]
    );
  }

  function openWhatsApp(phone: string, name: string) {
    const cleaned = phone.replace(/\D/g, "");
    const withCountry = cleaned.startsWith("55") ? cleaned : `55${cleaned}`;
    const msg = encodeURIComponent(`Olá ${name}! Gostaria de fazer um pedido de reposição de estoque.`);
    Linking.openURL(`https://wa.me/${withCountry}?text=${msg}`);
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const getStockColor = (stock: number, minAlert = 5) => {
    if (stock === 0) return "#F44336";
    if (stock <= minAlert) return "#FF9800";
    return "#4CAF50";
  };

  return (
    <ScreenContainer>
      <AdminHeader
        title="Fornecedores"
        rightElement={
          <TouchableOpacity
            style={[styles.headerBtn, { backgroundColor: "#C9A84C" }]}
            onPress={openCreate}
          >
            <Text style={styles.headerBtnText}>+ Novo</Text>
          </TouchableOpacity>
        }
      />
      <View style={styles.container}>
        {isLoading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
        ) : suppliers.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🏪</Text>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Nenhum fornecedor cadastrado</Text>
            <Text style={[styles.emptyText, { color: colors.muted }]}>
              Cadastre fornecedores para vincular aos produtos e facilitar o controle de estoque.
            </Text>
          </View>
        ) : (
          <FlatList
            data={suppliers as unknown as Supplier[]}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={{ paddingBottom: 24 }}
            renderItem={({ item }) => (
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardTitleRow}>
                    <Text style={[styles.cardName, { color: colors.foreground }]}>{item.name}</Text>
                    {item.cnpj ? (
                      <Text style={[styles.cardCnpj, { color: colors.muted }]}>CNPJ: {item.cnpj}</Text>
                    ) : null}
                  </View>
                </View>
                {item.phone ? (
                  <Text style={[styles.cardInfo, { color: colors.muted }]}>📞 {item.phone}</Text>
                ) : null}
                {item.email ? (
                  <Text style={[styles.cardInfo, { color: colors.muted }]}>✉️ {item.email}</Text>
                ) : null}
                {item.address ? (
                  <Text style={[styles.cardInfo, { color: colors.muted }]}>📍 {item.address}</Text>
                ) : null}
                {item.notes ? (
                  <Text style={[styles.cardNotes, { color: colors.muted }]}>{item.notes}</Text>
                ) : null}
                <View style={styles.cardActions}>
                  <Pressable
                    style={({ pressed }) => [styles.actionBtn, { backgroundColor: "#C9A84C", opacity: pressed ? 0.8 : 1, flex: 1 }]}
                    onPress={() => openDetail(item)}
                  >
                    <Text style={[styles.actionBtnText, { color: "#0A0A0A" }]}>Ver detalhes</Text>
                  </Pressable>
                  {item.phone ? (
                    <Pressable
                      style={({ pressed }) => [styles.actionBtn, { backgroundColor: "#25D36622", borderWidth: 1, borderColor: "#25D36644", opacity: pressed ? 0.7 : 1 }]}
                      onPress={() => openWhatsApp(item.phone!, item.name)}
                    >
                      <Text style={[styles.actionBtnText, { color: "#25D366" }]}>📱 WA</Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    style={({ pressed }) => [styles.actionBtn, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
                    onPress={() => openEdit(item)}
                  >
                    <Text style={[styles.actionBtnText, { color: colors.foreground }]}>Editar</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [styles.actionBtn, { backgroundColor: colors.error + "20", opacity: pressed ? 0.7 : 1 }]}
                    onPress={() => handleDelete(item)}
                  >
                    <Text style={[styles.actionBtnText, { color: colors.error }]}>Excluir</Text>
                  </Pressable>
                </View>
              </View>
            )}
          />
        )}
      </View>

      {/* Modal de detalhes do fornecedor */}
      <Modal visible={!!detailSupplier} animationType="slide" transparent onRequestClose={() => setDetailSupplier(null)}>
        <View style={styles.overlay}>
          <View style={[styles.detailModal, { backgroundColor: colors.surface }]}>
            {/* Header */}
            <View style={styles.detailHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.detailTitle, { color: colors.foreground }]} numberOfLines={1}>
                  {detailSupplier?.name}
                </Text>
                {detailSupplier?.cnpj ? (
                  <Text style={[styles.detailSubtitle, { color: colors.muted }]}>CNPJ: {detailSupplier.cnpj}</Text>
                ) : null}
              </View>
              <Pressable onPress={() => setDetailSupplier(null)} style={{ padding: 4 }}>
                <IconSymbol name="xmark" size={22} color={colors.muted} />
              </Pressable>
            </View>

            {/* Info rápida */}
            <View style={[styles.infoRow, { borderColor: colors.border }]}>
              {detailSupplier?.phone ? (
                <Pressable
                  style={({ pressed }) => [styles.infoChip, { backgroundColor: "#25D36622", borderColor: "#25D36644", opacity: pressed ? 0.7 : 1 }]}
                  onPress={() => openWhatsApp(detailSupplier.phone!, detailSupplier.name)}
                >
                  <Text style={{ color: "#25D366", fontSize: 12, fontWeight: "700" }}>📱 {detailSupplier.phone}</Text>
                </Pressable>
              ) : null}
              {detailSupplier?.email ? (
                <View style={[styles.infoChip, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>✉ {detailSupplier.email}</Text>
                </View>
              ) : null}
            </View>

            {/* KPIs */}
            <View style={styles.kpiRow}>
              <View style={[styles.kpiCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Text style={[styles.kpiValue, { color: "#C9A84C" }]}>{supplierProducts.length}</Text>
                <Text style={[styles.kpiLabel, { color: colors.muted }]}>Produtos</Text>
              </View>
              <View style={[styles.kpiCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Text style={[styles.kpiValue, { color: "#4CAF50" }]}>{totalEntradas}</Text>
                <Text style={[styles.kpiLabel, { color: colors.muted }]}>Unid. recebidas</Text>
              </View>
              <View style={[styles.kpiCard, { backgroundColor: lowStockCount > 0 ? "#FF980012" : colors.background, borderColor: lowStockCount > 0 ? "#FF980044" : colors.border }]}>
                <Text style={[styles.kpiValue, { color: lowStockCount > 0 ? "#FF9800" : "#4CAF50" }]}>⚠ {lowStockCount}</Text>
                <Text style={[styles.kpiLabel, { color: colors.muted }]}>Estoque baixo</Text>
              </View>
            </View>

            {/* Tabs */}
            <View style={[styles.tabRow, { borderColor: colors.border }]}>
              <Pressable
                style={[styles.tab, detailTab === "products" && { borderBottomColor: "#C9A84C", borderBottomWidth: 2 }]}
                onPress={() => setDetailTab("products")}
              >
                <Text style={[styles.tabText, { color: detailTab === "products" ? "#C9A84C" : colors.muted }]}>
                  Produtos ({supplierProducts.length})
                </Text>
              </Pressable>
              <Pressable
                style={[styles.tab, detailTab === "history" && { borderBottomColor: "#C9A84C", borderBottomWidth: 2 }]}
                onPress={() => setDetailTab("history")}
              >
                <Text style={[styles.tabText, { color: detailTab === "history" ? "#C9A84C" : colors.muted }]}>
                  Histórico ({supplierHistory.length})
                </Text>
              </Pressable>
            </View>

            {/* Conteúdo da tab */}
            {detailTab === "products" ? (
              supplierProductsQuery.isLoading ? (
                <ActivityIndicator color="#C9A84C" style={{ marginTop: 32 }} />
              ) : supplierProducts.length === 0 ? (
                <View style={styles.tabEmpty}>
                  <Text style={{ fontSize: 32 }}>📦</Text>
                  <Text style={[styles.tabEmptyText, { color: colors.muted }]}>Nenhum produto vinculado</Text>
                </View>
              ) : (
                <FlatList
                  data={supplierProducts}
                  keyExtractor={(p) => String(p.id)}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: 16 }}
                  renderItem={({ item: p }) => {
                    const stock = p.stockQuantity ?? p.stock ?? 0;
                    const minAlert = p.minStockAlert ?? 5;
                    const isLow = p.isActive && stock <= minAlert;
                    const stockColor = getStockColor(stock, minAlert);
                    return (
                      <View style={[styles.productRow, { borderColor: colors.border }]}>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                            <Text style={[styles.productName, { color: colors.foreground }]} numberOfLines={1}>{p.name}</Text>
                            {!p.isActive && (
                              <View style={{ backgroundColor: "#F4433622", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                                <Text style={{ fontSize: 10, color: "#F44336", fontWeight: "600" }}>Inativo</Text>
                              </View>
                            )}
                          </View>
                          <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
                            <Text style={{ fontSize: 13, color: "#C9A84C", fontWeight: "700" }}>
                              R$ {parseFloat(p.price).toFixed(2).replace(".", ",")}
                            </Text>
                            <Text style={{ fontSize: 13, color: stockColor, fontWeight: "600" }}>
                              Estoque: {stock}{isLow ? " ⚠" : ""}
                            </Text>
                            {p.productType ? (
                              <Text style={{ fontSize: 12, color: colors.muted }}>
                                {p.productType === "sale" ? "Venda" : "Uso interno"}
                              </Text>
                            ) : null}
                          </View>
                        </View>
                      </View>
                    );
                  }}
                />
              )
            ) : (
              supplierHistoryQuery.isLoading ? (
                <ActivityIndicator color="#C9A84C" style={{ marginTop: 32 }} />
              ) : supplierHistory.length === 0 ? (
                <View style={styles.tabEmpty}>
                  <Text style={{ fontSize: 32 }}>📋</Text>
                  <Text style={[styles.tabEmptyText, { color: colors.muted }]}>Nenhuma entrada registrada</Text>
                  <Text style={[styles.tabEmptySubText, { color: colors.muted }]}>
                    As entradas de estoque vinculadas a este fornecedor aparecerão aqui.
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={supplierHistory}
                  keyExtractor={(m) => String(m.id)}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: 16 }}
                  renderItem={({ item: m }) => (
                    <View style={[styles.historyRow, { borderColor: colors.border }]}>
                      <View style={[styles.historyIcon, { backgroundColor: "#4CAF5022" }]}>
                        <Text style={{ fontSize: 14, color: "#4CAF50" }}>↑</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                          <Text style={[styles.historyProduct, { color: colors.foreground }]} numberOfLines={1}>{m.productName}</Text>
                          <Text style={{ fontSize: 15, fontWeight: "800", color: "#4CAF50" }}>+{m.quantity}</Text>
                        </View>
                        {m.reason ? (
                          <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>{m.reason}</Text>
                        ) : null}
                        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 2 }}>
                          {m.barberName ? (
                            <Text style={{ fontSize: 11, color: colors.muted }}>Por: {m.barberName}</Text>
                          ) : <View />}
                          <Text style={{ fontSize: 11, color: colors.muted }}>
                            {m.date ? new Date(m.date + "T00:00:00").toLocaleDateString("pt-BR") : ""}
                          </Text>
                        </View>
                      </View>
                    </View>
                  )}
                />
              )
            )}
          </View>
        </View>
      </Modal>

      {/* Modal de criação/edição */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={[styles.modal, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              {editingId ? "Editar Fornecedor" : "Novo Fornecedor"}
            </Text>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={[styles.label, { color: colors.muted }]}>Nome *</Text>
              <TextInput
                style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                value={form.name}
                onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
                placeholder="Nome do fornecedor"
                placeholderTextColor={colors.muted}
              />

              <Text style={[styles.label, { color: colors.muted }]}>CNPJ</Text>
              <TextInput
                style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                value={form.cnpj}
                onChangeText={(v) => setForm((f) => ({ ...f, cnpj: applyDocumentMask(v) }))}
                placeholder="00.000.000/0000-00"
                placeholderTextColor={colors.muted}
                keyboardType="numeric"
                maxLength={18}
              />

              <Text style={[styles.label, { color: colors.muted }]}>Telefone / WhatsApp</Text>
              <TextInput
                style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                value={form.phone}
                onChangeText={(v) => setForm((f) => ({ ...f, phone: applyPhoneMask(v) }))}
                placeholder="(00) 00000-0000"
                placeholderTextColor={colors.muted}
                keyboardType="phone-pad"
                maxLength={15}
              />

              <Text style={[styles.label, { color: colors.muted }]}>E-mail</Text>
              <TextInput
                style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                value={form.email}
                onChangeText={(v) => setForm((f) => ({ ...f, email: v }))}
                placeholder="email@fornecedor.com"
                placeholderTextColor={colors.muted}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={[styles.label, { color: colors.muted }]}>Endereço</Text>
              <TextInput
                style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                value={form.address}
                onChangeText={(v) => setForm((f) => ({ ...f, address: v }))}
                placeholder="Rua, número, cidade"
                placeholderTextColor={colors.muted}
              />

              <Text style={[styles.label, { color: colors.muted }]}>Observações</Text>
              <TextInput
                style={[styles.input, styles.textarea, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                value={form.notes}
                onChangeText={(v) => setForm((f) => ({ ...f, notes: v }))}
                placeholder="Produtos fornecidos, condições, etc."
                placeholderTextColor={colors.muted}
                multiline
                numberOfLines={3}
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: colors.border }]}
                  onPress={closeModal}
                >
                  <Text style={[styles.modalBtnText, { color: colors.foreground }]}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: "#C9A84C", opacity: isSaving ? 0.6 : 1 }]}
                  onPress={handleSave}
                  disabled={isSaving}
                >
                  <Text style={[styles.modalBtnText, { color: "#0A0A0A" }]}>
                    {isSaving ? "Salvando..." : "Salvar"}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  headerBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8 },
  headerBtnText: { color: "#0A0A0A", fontWeight: "700", fontSize: 14 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "700", marginBottom: 8, textAlign: "center" },
  emptyText: { fontSize: 14, textAlign: "center", lineHeight: 22 },
  card: { borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 },
  cardTitleRow: { flex: 1 },
  cardName: { fontSize: 16, fontWeight: "700" },
  cardCnpj: { fontSize: 12, marginTop: 2 },
  cardActions: { flexDirection: "row", gap: 8, marginTop: 12, flexWrap: "wrap" },
  actionBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  actionBtnText: { fontSize: 13, fontWeight: "600" },
  cardInfo: { fontSize: 13, marginTop: 2 },
  cardNotes: { fontSize: 12, marginTop: 6, fontStyle: "italic" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  // Modal de detalhes
  detailModal: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 20, paddingHorizontal: 16, maxHeight: "88%", flex: 0 },
  detailHeader: { flexDirection: "row", alignItems: "flex-start", marginBottom: 12 },
  detailTitle: { fontSize: 20, fontWeight: "800" },
  detailSubtitle: { fontSize: 12, marginTop: 2 },
  infoRow: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 14, paddingBottom: 14, borderBottomWidth: 1 },
  infoChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  kpiRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  kpiCard: { flex: 1, borderRadius: 12, padding: 12, alignItems: "center", borderWidth: 1 },
  kpiValue: { fontSize: 22, fontWeight: "800" },
  kpiLabel: { fontSize: 11, marginTop: 2, textAlign: "center" },
  tabRow: { flexDirection: "row", borderBottomWidth: 1, marginBottom: 8 },
  tab: { flex: 1, paddingVertical: 10, alignItems: "center" },
  tabText: { fontSize: 14, fontWeight: "600" },
  tabEmpty: { alignItems: "center", paddingVertical: 40, gap: 8 },
  tabEmptyText: { fontSize: 14, fontWeight: "600" },
  tabEmptySubText: { fontSize: 12, textAlign: "center", lineHeight: 18 },
  productRow: { paddingVertical: 12, borderBottomWidth: 1 },
  productName: { fontSize: 14, fontWeight: "700" },
  historyRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 12, borderBottomWidth: 1 },
  historyIcon: { width: 34, height: 34, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  historyProduct: { fontSize: 13, fontWeight: "700", flex: 1 },
  // Modal de formulário
  modal: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40, maxHeight: "90%" },
  modalTitle: { fontSize: 18, fontWeight: "700", marginBottom: 16 },
  label: { fontSize: 12, fontWeight: "600", marginBottom: 4, marginTop: 10 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  textarea: { height: 80, textAlignVertical: "top" },
  modalButtons: { flexDirection: "row", gap: 12, marginTop: 20 },
  modalBtn: { flex: 1, paddingVertical: 13, borderRadius: 10, alignItems: "center" },
  modalBtnText: { fontWeight: "700", fontSize: 15 },
});

export default function SuppliersScreen() {
  return (
    <FeatureGate feature="suppliers">
      <SuppliersScreenInner />
    </FeatureGate>
  );
}
