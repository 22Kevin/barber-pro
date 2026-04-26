import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { trpc } from "@/lib/trpc";
import { MediaUploader } from "@/components/media-uploader";
import { AdminHeader } from "@/components/admin-header";
import {} from "react-native-safe-area-context";
import { useTabBarHeight } from "@/hooks/use-tab-bar-height";
import { useBarberAuth } from "@/lib/auth-context";

type Product = {
  id: number;
  name: string;
  description: string | null;
  price: string;
  stock: number;
  isActive: boolean;
  categoryId: number | null;
};

export default function ProductsScreen() {
  const tabBarHeight = useTabBarHeight();
  const { barber } = useBarberAuth();
  const tenantId = barber?.tenantId ?? undefined;
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [search, setSearch] = useState("");
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyProduct, setHistoryProduct] = useState<Product | null>(null);
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [restockProduct, setRestockProduct] = useState<Product | null>(null);
  const [restockQty, setRestockQty] = useState("1");
  const [restockCost, setRestockCost] = useState("");
  const [restockPayment, setRestockPayment] = useState("cash");
  const [restockNote, setRestockNote] = useState("");

  const movementsQuery = trpc.stock.movements.useQuery(
    { productId: historyProduct?.id ?? 0 },
    { enabled: !!historyProduct }
  );
  const movements = movementsQuery.data ?? [];

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("0");
  const [isActive, setIsActive] = useState(true);
  const [savedProductId, setSavedProductId] = useState<number | null>(null);

  const utils = trpc.useUtils();
  const productsQuery = trpc.products.list.useQuery({ activeOnly: false, tenantId });
  const createMutation = trpc.products.create.useMutation({
    onSuccess: (newId) => {
      utils.products.list.invalidate();
      // Não fecha o modal: atualiza o ID para mostrar o MediaUploader imediatamente
      setSavedProductId(newId as any);
    },
    onError: (e) => Alert.alert("Erro", e.message),
  });
  const updateMutation = trpc.products.update.useMutation({
    onSuccess: () => { utils.products.list.invalidate(); closeModal(); },
    onError: (e) => Alert.alert("Erro", e.message),
  });

  const restockMutation = trpc.stock.restock.useMutation({
    onSuccess: () => {
      utils.products.list.invalidate();
      utils.stock.movements.invalidate();
      setShowRestockModal(false);
      setRestockProduct(null);
      Alert.alert("Estoque Reposto", "Estoque atualizado com sucesso!");
    },
    onError: (e) => Alert.alert("Erro", e.message),
  });

  function openRestock(p: Product) {
    setRestockProduct(p);
    setRestockQty("1");
    setRestockCost("");
    setRestockPayment("cash");
    setRestockNote("");
    setShowRestockModal(true);
  }

  function confirmRestock() {
    if (!restockProduct) return;
    const qty = parseInt(restockQty);
    if (isNaN(qty) || qty < 1) { Alert.alert("Atenção", "Informe uma quantidade válida."); return; }
    const cost = restockCost ? parseFloat(restockCost.replace(",", ".")) : undefined;
    restockMutation.mutate({
      productId: restockProduct.id,
      quantity: qty,
      unitCost: cost,
      paymentMethod: restockPayment || undefined,
      note: restockNote.trim() || undefined,
      barberId: barber?.id ?? undefined,
      tenantId: tenantId ?? undefined,
    });
  }

  function openCreate() {
    setEditing(null);
    setSavedProductId(null);
    setName(""); setDescription(""); setPrice(""); setStock("0"); setIsActive(true);
    setShowModal(true);
  }

  function openEdit(p: Product) {
    setEditing(p);
    setSavedProductId(p.id);
    setName(p.name); setDescription(p.description ?? ""); setPrice(p.price); setStock(String(p.stock)); setIsActive(p.isActive);
    setShowModal(true);
  }

  function closeModal() { setShowModal(false); setEditing(null); setSavedProductId(null); }

  function handleSave() {
    if (!name.trim()) { Alert.alert("Atenção", "Informe o nome do produto."); return; }
    const priceNum = parseFloat(price.replace(",", "."));
    if (isNaN(priceNum) || priceNum <= 0) { Alert.alert("Atenção", "Informe um preço válido."); return; }
    const stockNum = parseInt(stock) || 0;
    const data = { name: name.trim(), description: description.trim() || null, price: priceNum.toFixed(2), stock: stockNum, isActive };
    if (editing) {
      updateMutation.mutate({ id: editing.id, ...data });
    } else {
      createMutation.mutate({ ...data, tenantId } as any);
    }
  }

  const products = (productsQuery.data ?? []).filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const getStockColor = (stock: number) => {
    if (stock === 0) return "#F44336";
    if (stock <= 5) return "#FF9800";
    return "#4CAF50";
  };

  return (
    <ScreenContainer containerClassName="bg-background">
      <AdminHeader
        title="Produtos"
        rightElement={
          <Pressable style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.8 }]} onPress={openCreate}>
            <IconSymbol name="plus" size={20} color="#0A0A0A" />
            <Text style={styles.addBtnText}>Novo</Text>
          </Pressable>
        }
      />

      <View style={styles.searchRow}>
        <IconSymbol name="magnifyingglass" size={18} color="#888880" />
        <TextInput style={styles.searchInput} value={search} onChangeText={setSearch} placeholder="Buscar produto..." placeholderTextColor="#555" />
      </View>

      {productsQuery.isLoading ? (
        <ActivityIndicator color="#C9A84C" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: 16, paddingTop: 8, paddingBottom: tabBarHeight }}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <IconSymbol name="cube.box.fill" size={40} color="#2A2A2A" />
              <Text style={styles.emptyText}>Nenhum produto cadastrado</Text>
              <Text style={styles.emptySubText}>Toque em "Novo" para adicionar</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={[styles.card, !item.isActive && styles.cardInactive]}>
              <View style={styles.cardLeft}>
                <View style={styles.cardIconBox}>
                  <IconSymbol name="cube.box.fill" size={20} color="#C9A84C" />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.cardTitleRow}>
                    <Text style={styles.cardName}>{item.name}</Text>
                    {!item.isActive && <View style={styles.inactiveBadge}><Text style={styles.inactiveText}>Inativo</Text></View>}
                  </View>
                  {item.description ? <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text> : null}
                  <View style={styles.cardMeta}>
                    <View style={[styles.metaChip, styles.priceChip]}>
                      <Text style={styles.priceText}>R$ {parseFloat(item.price).toFixed(2).replace(".", ",")}</Text>
                    </View>
                    <View style={[styles.metaChip, { backgroundColor: getStockColor(item.stock) + "22" }]}>
                      <Text style={[styles.stockText, { color: getStockColor(item.stock) }]}>
                        Estoque: {item.stock}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
              <View style={styles.cardActions}>
                <Pressable onPress={() => { setHistoryProduct(item); setShowHistoryModal(true); }} style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.6 }]}>
                  <IconSymbol name="chart.bar.fill" size={18} color="#3B82F6" />
                </Pressable>
                <Pressable onPress={() => openRestock(item)} style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.6 }]}>
                  <IconSymbol name="plus.circle.fill" size={18} color="#22C55E" />
                </Pressable>
                <Pressable onPress={() => openEdit(item)} style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.6 }]}>
                  <IconSymbol name="pencil" size={18} color="#C9A84C" />
                </Pressable>
              </View>
            </View>
          )}
        />
      )}

      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ width: "100%" }}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{editing ? "Editar Produto" : "Novo Produto"}</Text>
                <Pressable onPress={closeModal}><IconSymbol name="xmark" size={22} color="#888880" /></Pressable>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <Field label="Nome do Produto *">
                  <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Ex: Pomada Modeladora" placeholderTextColor="#555" />
                </Field>
                <Field label="Descrição">
                  <TextInput style={[styles.input, styles.textarea]} value={description} onChangeText={setDescription} placeholder="Descreva o produto..." placeholderTextColor="#555" multiline numberOfLines={3} />
                </Field>
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Field label="Preço (R$) *">
                      <TextInput style={styles.input} value={price} onChangeText={setPrice} placeholder="0,00" placeholderTextColor="#555" keyboardType="decimal-pad" />
                    </Field>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field label="Estoque">
                      <TextInput style={styles.input} value={stock} onChangeText={setStock} placeholder="0" placeholderTextColor="#555" keyboardType="number-pad" />
                    </Field>
                  </View>
                </View>
                {/* Upload de Fotos e Vídeos */}
                {(savedProductId || editing) ? (
                  <Field label="Fotos e Vídeos">
                    {savedProductId && !editing && (
                      <View style={styles.createdBanner}>
                        <IconSymbol name="checkmark.circle.fill" size={16} color="#22C55E" />
                        <Text style={styles.createdBannerText}>Produto criado! Adicione fotos e vídeos abaixo.</Text>
                      </View>
                    )}
                    <MediaUploader
                      entityType="product"
                      entityId={(savedProductId ?? editing!.id)}
                      maxItems={8}
                    />
                  </Field>
                ) : (
                  <View style={styles.mediaHint}>
                    <IconSymbol name="photo.on.rectangle" size={16} color="#888880" />
                    <Text style={styles.mediaHintText}>Salve o produto para adicionar fotos e vídeos</Text>
                  </View>
                )}

                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Produto ativo</Text>
                  <Switch value={isActive} onValueChange={setIsActive} trackColor={{ false: "#2A2A2A", true: "#C9A84C44" }} thumbColor={isActive ? "#C9A84C" : "#555"} />
                </View>
                <Pressable
                  style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.8 }]}
                  onPress={handleSave}
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {(createMutation.isPending || updateMutation.isPending) ? (
                    <ActivityIndicator color="#0A0A0A" />
                  ) : (
                    <Text style={styles.saveBtnText}>{editing ? "SALVAR ALTERAÇÕES" : "CRIAR PRODUTO"}</Text>
                  )}
                </Pressable>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Modal de Histórico de Movimentações */}
      <Modal visible={showHistoryModal} animationType="slide" transparent onRequestClose={() => setShowHistoryModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: "80%" }]}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Movimentações</Text>
                {historyProduct && <Text style={{ fontSize: 12, color: "#888880", marginTop: 2 }}>{historyProduct.name}</Text>}
              </View>
              <Pressable onPress={() => { setShowHistoryModal(false); setHistoryProduct(null); }}>
                <IconSymbol name="xmark" size={22} color="#888880" />
              </Pressable>
            </View>

            {movementsQuery.isLoading ? (
              <ActivityIndicator color="#C9A84C" style={{ marginVertical: 32 }} />
            ) : movements.length === 0 ? (
              <View style={{ alignItems: "center", paddingVertical: 40, gap: 8 }}>
                <Text style={{ fontSize: 32 }}>📦</Text>
                <Text style={{ color: "#888880", fontSize: 14 }}>Nenhuma movimentação registrada</Text>
              </View>
            ) : (
              <FlatList
                data={movements}
                keyExtractor={(m: any) => String(m.id)}
                showsVerticalScrollIndicator={false}
                renderItem={({ item: m }: { item: any }) => {
                  const isIn = m.type === "in" || (m.type === "adjustment" && m.quantity > 0);
                  const color = isIn ? "#22C55E" : m.type === "adjustment" ? "#F59E0B" : "#EF4444";
                  const icon = isIn ? "↑" : m.type === "adjustment" ? "⇅" : "↓";
                  const typeLabel = m.type === "in" ? "Entrada" : m.type === "out" ? "Saída" : "Ajuste";
                  return (
                    <View style={styles.movRow}>
                      <View style={[styles.movIcon, { backgroundColor: color + "22" }]}>
                        <Text style={{ fontSize: 16, color }}>{icon}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                          <Text style={{ fontSize: 13, fontWeight: "700", color: "#F5F5F0" }}>{typeLabel}</Text>
                          <Text style={{ fontSize: 14, fontWeight: "800", color }}>
                            {m.quantity > 0 ? "+" : ""}{m.quantity}
                          </Text>
                        </View>
                        {m.reason ? <Text style={{ fontSize: 12, color: "#888880", marginTop: 2 }}>{m.reason}</Text> : null}
                        {m.barberName ? <Text style={{ fontSize: 11, color: "#555", marginTop: 1 }}>Por: {m.barberName}</Text> : null}
                        <Text style={{ fontSize: 11, color: "#444", marginTop: 2 }}>
                          {m.date ? new Date(m.date).toLocaleDateString("pt-BR") : ""}
                        </Text>
                      </View>
                    </View>
                  );
                }}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Modal de Reposição de Estoque */}
      <Modal visible={showRestockModal} transparent animationType="slide" onRequestClose={() => setShowRestockModal(false)}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ width: "100%" }}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Repor Estoque</Text>
                <Pressable onPress={() => setShowRestockModal(false)}><IconSymbol name="xmark" size={22} color="#888880" /></Pressable>
              </View>
              {restockProduct && (
                <View style={{ backgroundColor: "#1E1E1E", borderRadius: 10, padding: 12, marginBottom: 16 }}>
                  <Text style={{ color: "#C9A84C", fontWeight: "700", fontSize: 15 }}>{restockProduct.name}</Text>
                  <Text style={{ color: "#888880", fontSize: 13, marginTop: 2 }}>Estoque atual: {restockProduct.stock} unidades</Text>
                </View>
              )}
              <Field label="Quantidade a Repor *">
                <TextInput style={styles.input} value={restockQty} onChangeText={setRestockQty} placeholder="1" placeholderTextColor="#555" keyboardType="number-pad" />
              </Field>
              <Field label="Custo Unitário (R$) — opcional">
                <TextInput style={styles.input} value={restockCost} onChangeText={setRestockCost} placeholder="0,00" placeholderTextColor="#555" keyboardType="decimal-pad" />
              </Field>
              <Field label="Forma de Pagamento">
                <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                  {[{v:"cash",l:"Dinheiro"},{v:"card",l:"Cartão"},{v:"pix",l:"Pix"},{v:"other",l:"Outro"}].map((pm) => (
                    <Pressable key={pm.v} onPress={() => setRestockPayment(pm.v)}
                      style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: restockPayment === pm.v ? "#C9A84C22" : "#1E1E1E", borderWidth: 1, borderColor: restockPayment === pm.v ? "#C9A84C" : "#2A2A2A" }}>
                      <Text style={{ color: restockPayment === pm.v ? "#C9A84C" : "#888880", fontSize: 13, fontWeight: restockPayment === pm.v ? "700" : "400" }}>{pm.l}</Text>
                    </Pressable>
                  ))}
                </View>
              </Field>
              <Field label="Observação">
                <TextInput style={styles.input} value={restockNote} onChangeText={setRestockNote} placeholder="Ex: Compra no fornecedor X" placeholderTextColor="#555" />
              </Field>
              <Pressable style={[styles.saveBtn, restockMutation.isPending && { opacity: 0.6 }]} onPress={confirmRestock} disabled={restockMutation.isPending}>
                <Text style={styles.saveBtnText}>{restockMutation.isPending ? "Salvando..." : `Repor +${restockQty || 0} unidades`}</Text>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, paddingBottom: 12 },
  title: { fontSize: 24, fontWeight: "800", color: "#F5F5F0" },
  addBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "#C9A84C", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, gap: 6 },
  addBtnText: { color: "#0A0A0A", fontWeight: "700", fontSize: 14 },
  searchRow: { flexDirection: "row", alignItems: "center", marginHorizontal: 16, backgroundColor: "#141414", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: "#2A2A2A", gap: 8, marginBottom: 4 },
  searchInput: { flex: 1, color: "#F5F5F0", fontSize: 14 },
  emptyCard: { alignItems: "center", paddingVertical: 60, gap: 10 },
  emptyText: { color: "#888880", fontSize: 16, fontWeight: "600" },
  emptySubText: { color: "#555", fontSize: 13 },
  card: { backgroundColor: "#141414", borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "#2A2A2A", flexDirection: "row", alignItems: "flex-start" },
  cardInactive: { opacity: 0.5 },
  cardLeft: { flex: 1, flexDirection: "row", gap: 12 },
  cardIconBox: { width: 44, height: 44, borderRadius: 12, backgroundColor: "#C9A84C22", justifyContent: "center", alignItems: "center" },
  cardTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  cardName: { fontSize: 16, fontWeight: "700", color: "#F5F5F0", flex: 1 },
  cardDesc: { fontSize: 13, color: "#888880", marginBottom: 8, lineHeight: 18 },
  cardMeta: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  metaChip: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#1E1E1E", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  priceChip: { backgroundColor: "#C9A84C22" },
  priceText: { fontSize: 13, color: "#C9A84C", fontWeight: "700" },
  stockText: { fontSize: 12, fontWeight: "600" },
  inactiveBadge: { backgroundColor: "#F4433622", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  inactiveText: { fontSize: 10, color: "#F44336", fontWeight: "600" },
  cardActions: { flexDirection: "column", gap: 8, marginLeft: 8 },
  actionBtn: { padding: 6 },
  modalOverlay: { flex: 1, backgroundColor: "#000000AA", justifyContent: "flex-end", alignItems: "center" },
  modalCard: { backgroundColor: "#141414", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, width: "100%", maxHeight: "90%", borderWidth: 1, borderColor: "#2A2A2A" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: "700", color: "#F5F5F0" },
  fieldLabel: { fontSize: 13, color: "#888880", marginBottom: 6, fontWeight: "500" },
  input: { backgroundColor: "#1E1E1E", borderWidth: 1, borderColor: "#2A2A2A", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: "#F5F5F0" },
  textarea: { height: 80, textAlignVertical: "top" },
  switchRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20, paddingVertical: 4 },
  switchLabel: { fontSize: 15, color: "#F5F5F0" },
  saveBtn: { backgroundColor: "#C9A84C", borderRadius: 12, paddingVertical: 15, alignItems: "center", marginBottom: 8 },
  saveBtnText: { color: "#0A0A0A", fontSize: 15, fontWeight: "800", letterSpacing: 1 },
  mediaHint: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#1A1A1A", borderRadius: 10, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: "#2A2A2A", borderStyle: "dashed" },
  mediaHintText: { flex: 1, fontSize: 12, color: "#888880", lineHeight: 17 },
  createdBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#22C55E18", borderRadius: 8, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: "#22C55E44" },
  createdBannerText: { flex: 1, fontSize: 12, color: "#22C55E", fontWeight: "600", lineHeight: 17 },
  movRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#1E1E1E" },
  movIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center" },
});
