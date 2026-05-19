import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Linking,
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
import { useTabBarHeight } from "@/hooks/use-tab-bar-height";
import { useBarberAuth } from "@/lib/auth-context";
import { useColors } from "@/hooks/use-colors";
import { applyPriceMask, parsePriceMask } from "@/hooks/use-mask";

type Supplier = {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  cnpj: string | null;
  address: string | null;
  notes: string | null;
};

type Product = {
  id: number;
  name: string;
  description: string | null;
  price: string;
  stock: number;
  isActive: boolean;
  categoryId: number | null;
  supplierId: number | null;
  minStockAlert?: number | null;
};

export default function ProductsScreen() {
  const colors = useColors();
  const styles = createStyles(colors);
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
  const [restockSupplierId, setRestockSupplierId] = useState<number | null>(null);
  const [filterSupplierId, setFilterSupplierId] = useState<number | null>(null);

  // Formulário de produto
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const handlePriceChange = (t: string) => setPrice(applyPriceMask(t));
  const [stock, setStock] = useState("0");
  const [isActive, setIsActive] = useState(true);
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(null);
  const [savedProductId, setSavedProductId] = useState<number | null>(null);

  const utils = trpc.useUtils();

  const movementsQuery = trpc.stock.movements.useQuery(
    { productId: historyProduct?.id ?? 0 },
    { enabled: !!historyProduct }
  );
  const movements = movementsQuery.data ?? [];

  const productsQuery = trpc.products.list.useQuery({ activeOnly: false, tenantId });
  const suppliersQuery = trpc.suppliers.list.useQuery(
    { tenantId: tenantId ?? 0 },
    { enabled: (tenantId ?? 0) > 0 }
  );
  const suppliersList = (suppliersQuery.data ?? []) as Supplier[];

  const createMutation = trpc.products.create.useMutation({
    onSuccess: (newId) => {
      utils.products.list.invalidate();
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
    // Pré-selecionar o fornecedor do produto
    setRestockSupplierId(p.supplierId ?? null);
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
      supplierId: restockSupplierId ?? undefined,
    });
  }

  function openCreate() {
    setEditing(null);
    setSavedProductId(null);
    setName(""); setDescription(""); setPrice(""); setStock("0"); setIsActive(true);
    setSelectedSupplierId(null);
    setShowModal(true);
  }

  function openEdit(p: Product) {
    setEditing(p);
    setSavedProductId(p.id);
    setName(p.name); setDescription(p.description ?? ""); setPrice(applyPriceMask(p.price)); setStock(String(p.stock)); setIsActive(p.isActive);
    setSelectedSupplierId(p.supplierId ?? null);
    setShowModal(true);
  }

  function closeModal() { setShowModal(false); setEditing(null); setSavedProductId(null); }

  function handleSave() {
    if (!name.trim()) { Alert.alert("Atenção", "Informe o nome do produto."); return; }
    const priceNum = parsePriceMask(price);
    if (isNaN(priceNum) || priceNum <= 0) { Alert.alert("Atenção", "Informe um preço válido."); return; }
    const stockNum = parseInt(stock) || 0;
    const data = { name: name.trim(), description: description.trim() || null, price: priceNum.toFixed(2), stock: stockNum, isActive, supplierId: selectedSupplierId ?? null };
    if (editing) {
      updateMutation.mutate({ id: editing.id, ...data } as any);
    } else {
      createMutation.mutate({ ...data, tenantId } as any);
    }
  }

  function handleWhatsAppAlert(product: Product) {
    const supplier = suppliersList.find(s => s.id === product.supplierId);
    if (!supplier) {
      Alert.alert("Sem fornecedor", "Este produto não tem fornecedor vinculado.");
      return;
    }
    if (!supplier.phone) {
      Alert.alert("Sem telefone", `O fornecedor "${supplier.name}" não tem telefone cadastrado. Acesse o painel web para adicionar.`);
      return;
    }
    const phone = supplier.phone.replace(/\D/g, "");
    const phoneWithCountry = phone.startsWith("55") ? phone : `55${phone}`;
    const msg = encodeURIComponent(
      `Olá ${supplier.name}! 👋\n\nEstamos com o estoque baixo do produto *${product.name}* (${product.stock} unidade${product.stock !== 1 ? "s" : ""} restante${product.stock !== 1 ? "s" : ""}).\n\nPoderia nos enviar uma cotação para reposição?\n\nObrigado!`
    );
    Linking.openURL(`https://wa.me/${phoneWithCountry}?text=${msg}`);
  }

  const products = (productsQuery.data ?? []).filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) &&
    (filterSupplierId === null || p.supplierId === filterSupplierId)
  ) as Product[];

  const lowStockProducts = products.filter(p => {
    const minAlert = (p as any).minStockAlert ?? 5;
    return p.isActive && p.stock <= minAlert && p.stock >= 0;
  });

  const getStockColor = (stock: number, minAlert?: number | null) => {
    const threshold = minAlert ?? 5;
    if (stock === 0) return "#F44336";
    if (stock <= threshold) return "#FF9800";
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

      {/* Banner de alertas de estoque baixo */}
      {lowStockProducts.length > 0 && (
        <View style={styles.alertBanner}>
          <View style={styles.alertBannerHeader}>
            <IconSymbol name="exclamationmark.triangle.fill" size={16} color="#FF9800" />
            <Text style={styles.alertBannerTitle}>
              {lowStockProducts.length} produto{lowStockProducts.length > 1 ? "s" : ""} com estoque baixo
            </Text>
          </View>
          {lowStockProducts.map(p => {
            const supplier = suppliersList.find(s => s.id === p.supplierId);
            return (
              <View key={p.id} style={styles.alertItem}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.alertProductName}>{p.name}</Text>
                  <Text style={styles.alertStockText}>
                    {p.stock === 0 ? "Sem estoque" : `${p.stock} unidade${p.stock !== 1 ? "s" : ""}`}
                    {supplier ? ` · ${supplier.name}` : ""}
                  </Text>
                </View>
                {supplier?.phone ? (
                  <Pressable
                    style={({ pressed }) => [styles.whatsappBtn, pressed && { opacity: 0.7 }]}
                    onPress={() => handleWhatsAppAlert(p)}
                  >
                    <Text style={styles.whatsappBtnText}>📱 WhatsApp</Text>
                  </Pressable>
                ) : (
                  <View style={styles.whatsappBtnDisabled}>
                    <Text style={styles.whatsappBtnDisabledText}>Sem telefone</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      <View style={styles.searchRow}>
        <IconSymbol name="magnifyingglass" size={18} color="#888880" />
        <TextInput style={styles.searchInput} value={search} onChangeText={setSearch} placeholder="Buscar produto..." placeholderTextColor="#555" />
      </View>

      {/* Filtro por fornecedor */}
      {suppliersList.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ maxHeight: 44 }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8, gap: 8, flexDirection: "row" }}
        >
          <Pressable
            style={({ pressed }) => ({
              paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
              backgroundColor: filterSupplierId === null ? "#C9A84C22" : "#1E1E1E",
              borderWidth: 1, borderColor: filterSupplierId === null ? "#C9A84C" : "#2A2A2A",
              opacity: pressed ? 0.7 : 1,
            })}
            onPress={() => setFilterSupplierId(null)}
          >
            <Text style={{ color: filterSupplierId === null ? "#C9A84C" : "#888880", fontSize: 13, fontWeight: filterSupplierId === null ? "700" : "400" }}>Todos</Text>
          </Pressable>
          {suppliersList.map((s) => (
            <Pressable
              key={s.id}
              style={({ pressed }) => ({
                paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
                backgroundColor: filterSupplierId === s.id ? "#C9A84C22" : "#1E1E1E",
                borderWidth: 1, borderColor: filterSupplierId === s.id ? "#C9A84C" : "#2A2A2A",
                opacity: pressed ? 0.7 : 1,
              })}
              onPress={() => setFilterSupplierId(s.id)}
            >
              <Text style={{ color: filterSupplierId === s.id ? "#C9A84C" : "#888880", fontSize: 13, fontWeight: filterSupplierId === s.id ? "700" : "400" }}>{s.name}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

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
          renderItem={({ item }) => {
            const supplier = suppliersList.find(s => s.id === item.supplierId);
            const minAlert = (item as any).minStockAlert ?? 5;
            const isLowStock = item.isActive && item.stock <= minAlert;
            return (
              <View style={[styles.card, !item.isActive && styles.cardInactive]}>
                <View style={styles.cardLeft}>
                  <View style={styles.cardIconBox}>
                    <IconSymbol name="cube.box.fill" size={20} color="#C9A84C" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.cardTitleRow}>
                      <Text style={styles.cardName}>{item.name}</Text>
                      {!item.isActive && <View style={styles.inactiveBadge}><Text style={styles.inactiveText}>Inativo</Text></View>}
                      {isLowStock && item.isActive && (
                        <View style={styles.lowStockBadge}>
                          <Text style={styles.lowStockBadgeText}>⚠ Baixo</Text>
                        </View>
                      )}
                    </View>
                    {item.description ? <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text> : null}
                    {supplier && (
                      <Text style={styles.supplierLabel} numberOfLines={1}>🏭 {supplier.name}</Text>
                    )}
                    <View style={styles.cardMeta}>
                      <View style={[styles.metaChip, styles.priceChip]}>
                        <Text style={styles.priceText}>R$ {parseFloat(item.price).toFixed(2).replace(".", ",")}</Text>
                      </View>
                      <View style={[styles.metaChip, { backgroundColor: getStockColor(item.stock, minAlert) + "22" }]}>
                        <Text style={[styles.stockText, { color: getStockColor(item.stock, minAlert) }]}>
                          Estoque: {item.stock}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
                <View style={styles.cardActions}>
                  {isLowStock && item.isActive && supplier?.phone && (
                    <Pressable onPress={() => handleWhatsAppAlert(item)} style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.6 }]}>
                      <Text style={{ fontSize: 16 }}>📱</Text>
                    </Pressable>
                  )}
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
            );
          }}
        />
      )}

      {/* Modal de Criação/Edição de Produto */}
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
                      <TextInput style={styles.input} value={price} onChangeText={handlePriceChange} placeholder="0,00" placeholderTextColor="#555" keyboardType="decimal-pad" />
                    </Field>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field label="Estoque">
                      <TextInput style={styles.input} value={stock} onChangeText={setStock} placeholder="0" placeholderTextColor="#555" keyboardType="number-pad" />
                    </Field>
                  </View>
                </View>

                {/* Seletor de Fornecedor — obrigatório */}
                <Field label="Fornecedor *">
                  {suppliersQuery.isLoading ? (
                    <ActivityIndicator color="#C9A84C" style={{ marginVertical: 8 }} />
                  ) : suppliersList.length === 0 ? (
                    <View style={styles.noSupplierBox}>
                      <Text style={styles.noSupplierText}>
                        Nenhum fornecedor cadastrado. Acesse o painel web para cadastrar fornecedores antes de criar produtos.
                      </Text>
                    </View>
                  ) : (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        {suppliersList.map((s) => (
                          <Pressable
                            key={s.id}
                            onPress={() => setSelectedSupplierId(s.id)}
                            style={{
                              paddingHorizontal: 14,
                              paddingVertical: 9,
                              borderRadius: 20,
                              backgroundColor: selectedSupplierId === s.id ? "#C9A84C22" : "#1E1E1E",
                              borderWidth: 1,
                              borderColor: selectedSupplierId === s.id ? "#C9A84C" : "#2A2A2A",
                            }}
                          >
                            <Text style={{
                              color: selectedSupplierId === s.id ? "#C9A84C" : "#888880",
                              fontSize: 13,
                              fontWeight: selectedSupplierId === s.id ? "700" : "400",
                            }}>
                              {s.name}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </ScrollView>
                  )}
                </Field>

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
                  {restockProduct.supplierId && (() => {
                    const s = suppliersList.find(x => x.id === restockProduct.supplierId);
                    return s ? <Text style={{ color: "#888880", fontSize: 12, marginTop: 2 }}>Fornecedor: {s.name}</Text> : null;
                  })()}
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
              <Field label="Fornecedor">
                <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                  <Pressable
                    onPress={() => setRestockSupplierId(null)}
                    style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: restockSupplierId === null ? "#C9A84C22" : "#1E1E1E", borderWidth: 1, borderColor: restockSupplierId === null ? "#C9A84C" : "#2A2A2A" }}
                  >
                    <Text style={{ color: restockSupplierId === null ? "#C9A84C" : "#888880", fontSize: 12, fontWeight: restockSupplierId === null ? "700" : "400" }}>Nenhum</Text>
                  </Pressable>
                  {suppliersList.map((s) => (
                    <Pressable
                      key={s.id}
                      onPress={() => setRestockSupplierId(s.id)}
                      style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: restockSupplierId === s.id ? "#C9A84C22" : "#1E1E1E", borderWidth: 1, borderColor: restockSupplierId === s.id ? "#C9A84C" : "#2A2A2A" }}
                    >
                      <Text style={{ color: restockSupplierId === s.id ? "#C9A84C" : "#888880", fontSize: 12, fontWeight: restockSupplierId === s.id ? "700" : "400" }}>{s.name}</Text>
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
  const colors = useColors();
  const styles = createStyles(colors);
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function createStyles(c: ReturnType<typeof import("@/hooks/use-colors").useColors>) {
  return StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, paddingBottom: 12 },
  title: { fontSize: 24, fontWeight: "800", color: c.foreground },
  addBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "#C9A84C", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, gap: 6 },
  addBtnText: { color: "#0A0A0A", fontWeight: "700", fontSize: 14 },
  searchRow: { flexDirection: "row", alignItems: "center", marginHorizontal: 16, backgroundColor: c.surface, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: c.border, gap: 8, marginBottom: 4 },
  searchInput: { flex: 1, color: c.foreground, fontSize: 14 },
  emptyCard: { alignItems: "center", paddingVertical: 60, gap: 10 },
  emptyText: { color: c.muted, fontSize: 16, fontWeight: "600" },
  emptySubText: { color: c.muted, fontSize: 13 },
  card: { backgroundColor: c.surface, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: c.border, flexDirection: "row", alignItems: "flex-start" },
  cardInactive: { opacity: 0.5 },
  cardLeft: { flex: 1, flexDirection: "row", gap: 12 },
  cardIconBox: { width: 44, height: 44, borderRadius: 12, backgroundColor: "#C9A84C22", justifyContent: "center", alignItems: "center" },
  cardTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" },
  cardName: { fontSize: 16, fontWeight: "700", color: c.foreground, flex: 1 },
  cardDesc: { fontSize: 13, color: c.muted, marginBottom: 6, lineHeight: 18 },
  supplierLabel: { fontSize: 12, color: c.muted, marginBottom: 6 },
  cardMeta: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  metaChip: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: c.background, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  priceChip: { backgroundColor: "#C9A84C22" },
  priceText: { fontSize: 13, color: "#C9A84C", fontWeight: "700" },
  stockText: { fontSize: 12, fontWeight: "600" },
  inactiveBadge: { backgroundColor: "#F4433622", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  inactiveText: { fontSize: 10, color: "#F44336", fontWeight: "600" },
  lowStockBadge: { backgroundColor: "#FF980022", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  lowStockBadgeText: { fontSize: 10, color: "#FF9800", fontWeight: "700" },
  cardActions: { flexDirection: "column", gap: 8, marginLeft: 8 },
  actionBtn: { padding: 6 },
  // Alerta de estoque baixo
  alertBanner: { marginHorizontal: 16, marginBottom: 8, backgroundColor: "#FF980012", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#FF980044" },
  alertBannerHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  alertBannerTitle: { fontSize: 14, fontWeight: "700", color: "#FF9800" },
  alertItem: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderTopWidth: 1, borderTopColor: "#FF980022", gap: 10 },
  alertProductName: { fontSize: 13, fontWeight: "700", color: c.foreground },
  alertStockText: { fontSize: 12, color: c.muted, marginTop: 2 },
  whatsappBtn: { backgroundColor: "#25D36622", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: "#25D36644" },
  whatsappBtnText: { fontSize: 12, fontWeight: "700", color: "#25D366" },
  whatsappBtnDisabled: { backgroundColor: "#2A2A2A", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 },
  whatsappBtnDisabledText: { fontSize: 11, color: "#555" },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: "#000000AA", justifyContent: "flex-end", alignItems: "center" },
  modalCard: { backgroundColor: c.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, width: "100%", maxHeight: "90%", borderWidth: 1, borderColor: c.border },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: "700", color: c.foreground },
  fieldLabel: { fontSize: 13, color: c.muted, marginBottom: 6, fontWeight: "500" },
  input: { backgroundColor: c.background, borderWidth: 1, borderColor: c.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: c.foreground },
  textarea: { height: 80, textAlignVertical: "top" },
  switchRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20, paddingVertical: 4 },
  switchLabel: { fontSize: 15, color: c.foreground },
  saveBtn: { backgroundColor: "#C9A84C", borderRadius: 12, paddingVertical: 15, alignItems: "center", marginBottom: 8 },
  saveBtnText: { color: "#0A0A0A", fontSize: 15, fontWeight: "800", letterSpacing: 1 },
  mediaHint: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: c.surface, borderRadius: 10, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: c.border, borderStyle: "dashed" },
  mediaHintText: { flex: 1, fontSize: 12, color: c.muted, lineHeight: 17 },
  createdBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#22C55E18", borderRadius: 8, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: "#22C55E44" },
  createdBannerText: { flex: 1, fontSize: 12, color: "#22C55E", fontWeight: "600", lineHeight: 17 },
  noSupplierBox: { backgroundColor: "#FF980012", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#FF980044" },
  noSupplierText: { fontSize: 13, color: "#FF9800", lineHeight: 18 },
  movRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.background },
  movIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center" },
});
}
