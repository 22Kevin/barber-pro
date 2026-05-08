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
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";
import { AdminHeader } from "@/components/admin-header";
import { useBarberAuth } from "@/lib/auth-context";

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

type FormData = {
  name: string;
  phone: string;
  email: string;
  cnpj: string;
  address: string;
  notes: string;
};

const EMPTY_FORM: FormData = { name: "", phone: "", email: "", cnpj: "", address: "", notes: "" };

export default function SuppliersScreen() {
  const colors = useColors();
  const { barber } = useBarberAuth();
  const tenantId = barber?.tenantId ?? 0;

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);

  const { data: suppliers = [], refetch, isLoading } = trpc.suppliers.list.useQuery(
    { tenantId },
    { enabled: tenantId > 0 }
  );

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
      phone: s.phone ?? "",
      email: s.email ?? "",
      cnpj: s.cnpj ?? "",
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

  function handleSave() {
    if (!form.name.trim()) {
      Alert.alert("Atenção", "O nome do fornecedor é obrigatório.");
      return;
    }
    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim() || undefined,
      email: form.email.trim() || undefined,
      cnpj: form.cnpj.trim() || undefined,
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

  const isSaving = createMutation.isPending || updateMutation.isPending;

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
                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: "#C9A84C20" }]}
                      onPress={() => openEdit(item)}
                    >
                      <Text style={[styles.actionBtnText, { color: "#C9A84C" }]}>Editar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: colors.error + "20" }]}
                      onPress={() => handleDelete(item)}
                    >
                      <Text style={[styles.actionBtnText, { color: colors.error }]}>Excluir</Text>
                    </TouchableOpacity>
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
              </View>
            )}
          />
        )}
      </View>

      {/* Modal de criação/edição */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={[styles.modal, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              {editingId ? "Editar Fornecedor" : "Novo Fornecedor"}
            </Text>

            <ScrollView showsVerticalScrollIndicator={false}>
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
                onChangeText={(v) => setForm((f) => ({ ...f, cnpj: v }))}
                placeholder="00.000.000/0000-00"
                placeholderTextColor={colors.muted}
                keyboardType="numeric"
              />

              <Text style={[styles.label, { color: colors.muted }]}>Telefone / WhatsApp</Text>
              <TextInput
                style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                value={form.phone}
                onChangeText={(v) => setForm((f) => ({ ...f, phone: v }))}
                placeholder="(00) 00000-0000"
                placeholderTextColor={colors.muted}
                keyboardType="phone-pad"
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
  cardActions: { flexDirection: "row", gap: 8 },
  actionBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  actionBtnText: { fontSize: 13, fontWeight: "600" },
  cardInfo: { fontSize: 13, marginTop: 2 },
  cardNotes: { fontSize: 12, marginTop: 6, fontStyle: "italic" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modal: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40, maxHeight: "90%" },
  modalTitle: { fontSize: 18, fontWeight: "700", marginBottom: 16 },
  label: { fontSize: 12, fontWeight: "600", marginBottom: 4, marginTop: 10 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  textarea: { height: 80, textAlignVertical: "top" },
  modalButtons: { flexDirection: "row", gap: 12, marginTop: 20 },
  modalBtn: { flex: 1, paddingVertical: 13, borderRadius: 10, alignItems: "center" },
  modalBtnText: { fontWeight: "700", fontSize: 15 },
});
