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

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("0");
  const [isActive, setIsActive] = useState(true);
  const [savedProductId, setSavedProductId] = useState<number | null>(null);

  const utils = trpc.useUtils();
  const productsQuery = trpc.products.list.useQuery({ activeOnly: false, tenantId });
  const createMutation = trpc.products.create.useMutation({
    onSuccess: () => { utils.products.list.invalidate(); closeModal(); },
    onError: (e) => Alert.alert("Erro", e.message),
  });
  const updateMutation = trpc.products.update.useMutation({
    onSuccess: () => { utils.products.list.invalidate(); closeModal(); },
    onError: (e) => Alert.alert("Erro", e.message),
  });

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
      createMutation.mutate(data, {
        onSuccess: (newId) => { setSavedProductId(newId as any); }
      });
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
                {savedProductId ? (
                  <Field label="Fotos e Vídeos">
                    <MediaUploader
                      entityType="product"
                      entityId={savedProductId}
                      maxItems={8}
                    />
                  </Field>
                ) : (
                  <View style={styles.mediaHint}>
                    <IconSymbol name="photo.on.rectangle" size={16} color="#888880" />
                    <Text style={styles.mediaHintText}>Salve o produto primeiro para adicionar fotos e vídeos</Text>
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
});
