import React, { useState } from "react";
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
  contact: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type FormData = {
  name: string;
  contact: string;
  phone: string;
  email: string;
  notes: string;
};

const EMPTY_FORM: FormData = { name: "", contact: "", phone: "", email: "", notes: "" };

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
      contact: s.contact ?? "",
      phone: s.phone ?? "",
      email: s.email ?? "",
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
      contact: form.contact.trim() || undefined,
      phone: form.phone.trim() || undefined,
      email: form.email.trim() || undefined,
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
      <AdminHeader title="Fornecedores" />
      <View style={styles.container}>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
          onPress={openCreate}
        >
          <Text style={[styles.addBtnText, { color: colors.background }]}>+ Novo Fornecedor</Text>
        </TouchableOpacity>

        {isLoading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
        ) : suppliers.length === 0 ? (
          <View style={styles.empty}>
            <Text style={[styles.emptyIcon]}>🏪</Text>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Nenhum fornecedor cadastrado</Text>
            <Text style={[styles.emptyText, { color: colors.muted }]}>
              Cadastre fornecedores para vincular às reposições de estoque e rastrear suas compras.
            </Text>
          </View>
        ) : (
          <FlatList
            data={suppliers as Supplier[]}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={{ paddingBottom: 24 }}
            renderItem={({ item }) => (
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardTitleRow}>
                    <Text style={[styles.cardName, { color: colors.foreground }]}>{item.name}</Text>
                  </View>
                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: colors.primary + "20" }]}
                      onPress={() => openEdit(item)}
                    >
                      <Text style={[styles.actionBtnText, { color: colors.primary }]}>Editar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: colors.error + "20" }]}
                      onPress={() => handleDelete(item)}
                    >
                      <Text style={[styles.actionBtnText, { color: colors.error }]}>Excluir</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                {item.contact ? (
                  <Text style={[styles.cardInfo, { color: colors.muted }]}>👤 {item.contact}</Text>
                ) : null}
                {item.phone ? (
                  <Text style={[styles.cardInfo, { color: colors.muted }]}>📞 {item.phone}</Text>
                ) : null}
                {item.email ? (
                  <Text style={[styles.cardInfo, { color: colors.muted }]}>✉️ {item.email}</Text>
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

            <Text style={[styles.label, { color: colors.muted }]}>Nome *</Text>
            <TextInput
              style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
              value={form.name}
              onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
              placeholder="Nome do fornecedor"
              placeholderTextColor={colors.muted}
            />

            <Text style={[styles.label, { color: colors.muted }]}>Contato (pessoa responsável)</Text>
            <TextInput
              style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
              value={form.contact}
              onChangeText={(v) => setForm((f) => ({ ...f, contact: v }))}
              placeholder="Nome do responsável"
              placeholderTextColor={colors.muted}
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
                style={[styles.modalBtn, { backgroundColor: colors.primary, opacity: isSaving ? 0.6 : 1 }]}
                onPress={handleSave}
                disabled={isSaving}
              >
                <Text style={[styles.modalBtnText, { color: colors.background }]}>
                  {isSaving ? "Salvando..." : "Salvar"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  addBtn: { borderRadius: 10, paddingVertical: 12, alignItems: "center", marginBottom: 16 },
  addBtnText: { fontWeight: "700", fontSize: 15 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "700", marginBottom: 8, textAlign: "center" },
  emptyText: { fontSize: 14, textAlign: "center", lineHeight: 22 },
  card: { borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 },
  cardTitleRow: { flex: 1 },
  cardName: { fontSize: 16, fontWeight: "700" },
  cardActions: { flexDirection: "row", gap: 8 },
  actionBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  actionBtnText: { fontSize: 13, fontWeight: "600" },
  cardInfo: { fontSize: 13, marginTop: 2 },
  cardNotes: { fontSize: 12, marginTop: 6, fontStyle: "italic" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modal: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40 },
  modalTitle: { fontSize: 18, fontWeight: "700", marginBottom: 16 },
  label: { fontSize: 12, fontWeight: "600", marginBottom: 4, marginTop: 10 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  textarea: { height: 80, textAlignVertical: "top" },
  modalButtons: { flexDirection: "row", gap: 12, marginTop: 20 },
  modalBtn: { flex: 1, paddingVertical: 13, borderRadius: 10, alignItems: "center" },
  modalBtnText: { fontWeight: "700", fontSize: 15 },
});
