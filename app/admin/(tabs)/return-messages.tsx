import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { AdminHeader } from "@/components/admin-header";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";

const PLACEHOLDERS = [
  "{nome}" ,
  "{servico}",
  "{dias}",
];

export default function ReturnMessagesScreen() {
  const colors = useColors();
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<{
    serviceId: number;
    serviceName: string;
    delayDays: number;
    messageTemplate: string;
    isActive: boolean;
  } | null>(null);

  const servicesQuery = trpc.services.list.useQuery({ activeOnly: false });
  const configsQuery = trpc.returnMessages.list.useQuery();
  const upsertMutation = trpc.returnMessages.upsert.useMutation({
    onSuccess: () => {
      configsQuery.refetch();
      setModalVisible(false);
    },
  });
  const deleteMutation = trpc.returnMessages.delete.useMutation({
    onSuccess: () => configsQuery.refetch(),
  });

  const utils = trpc.useUtils();

  const services = servicesQuery.data ?? [];
  const configs = configsQuery.data ?? [];

  const getConfig = (serviceId: number) =>
    configs.find((c) => c.serviceId === serviceId);

  function openEdit(serviceId: number, serviceName: string) {
    const existing = getConfig(serviceId);
    setEditing({
      serviceId,
      serviceName,
      delayDays: existing?.delayDays ?? 21,
      messageTemplate:
        existing?.messageTemplate ??
        `Olá {nome}! Faz {dias} dias desde o seu último {servico}. Que tal agendar um horário? 😊`,
      isActive: existing?.isActive ?? true,
    });
    setModalVisible(true);
  }

  function handleSave() {
    if (!editing) return;
    if (!editing.messageTemplate.trim()) {
      Alert.alert("Atenção", "A mensagem não pode estar vazia.");
      return;
    }
    upsertMutation.mutate({
      serviceId: editing.serviceId,
      delayDays: editing.delayDays,
      messageTemplate: editing.messageTemplate,
      isActive: editing.isActive,
    });
  }

  function handleDelete(serviceId: number, serviceName: string) {
    Alert.alert(
      "Remover configuração",
      `Deseja remover a mensagem de retorno para "${serviceName}"?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Remover",
          style: "destructive",
          onPress: () => deleteMutation.mutate({ serviceId }),
        },
      ]
    );
  }

  const dyn = StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      marginHorizontal: 16,
      marginBottom: 10,
      padding: 14,
    },
    serviceName: { fontSize: 15, fontWeight: "700", color: colors.foreground },
    configText: { fontSize: 13, color: colors.muted, marginTop: 4 },
    badge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
      alignSelf: "flex-start",
      marginTop: 6,
    },
    badgeText: { fontSize: 11, fontWeight: "700" },
    input: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      padding: 12,
      color: colors.foreground,
      fontSize: 14,
      marginBottom: 14,
    },
    label: { fontSize: 13, fontWeight: "600", color: colors.muted, marginBottom: 6 },
    modalTitle: { fontSize: 18, fontWeight: "700", color: colors.foreground, marginBottom: 4 },
    modalSubtitle: { fontSize: 13, color: colors.muted, marginBottom: 20 },
    saveBtn: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      padding: 14,
      alignItems: "center",
      marginTop: 8,
    },
    saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
    placeholder: {
      backgroundColor: colors.primary + "22",
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 4,
      marginRight: 6,
    },
    placeholderText: { fontSize: 12, color: colors.primary, fontWeight: "600" },
  });

  return (
    <ScreenContainer containerClassName="bg-background" edges={["left", "right"]}>
      <AdminHeader title="Mensagens de Retorno" />

      {/* Info banner */}
      <View style={[styles.infoBanner, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "40" }]}>
        <IconSymbol name="bell.badge.fill" size={18} color={colors.primary} />
        <Text style={[styles.infoText, { color: colors.foreground }]}>
          Configure uma mensagem automática para cada serviço. O cliente recebe uma notificação push após o número de dias configurado.
        </Text>
      </View>

      {servicesQuery.isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={services}
          keyExtractor={(s) => String(s.id)}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: 40 }}
          renderItem={({ item: service }) => {
            const config = getConfig(service.id);
            return (
              <View style={dyn.card}>
                <View style={styles.cardRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={dyn.serviceName}>{service.name}</Text>
                    {config ? (
                      <>
                        <Text style={dyn.configText} numberOfLines={2}>
                          "{config.messageTemplate}"
                        </Text>
                        <View style={styles.cardMeta}>
                          <View style={[dyn.badge, { backgroundColor: config.isActive ? "#4CAF5022" : "#88888822" }]}>
                            <Text style={[dyn.badgeText, { color: config.isActive ? "#4CAF50" : "#888" }]}>
                              {config.isActive ? `✓ Ativo — ${config.delayDays} dias` : "Inativo"}
                            </Text>
                          </View>
                        </View>
                      </>
                    ) : (
                      <Text style={[dyn.configText, { fontStyle: "italic" }]}>
                        Sem mensagem configurada
                      </Text>
                    )}
                  </View>
                  <View style={styles.cardActions}>
                    <Pressable
                      style={({ pressed }) => [styles.actionBtn, { backgroundColor: colors.primary + "22", opacity: pressed ? 0.7 : 1 }]}
                      onPress={() => openEdit(service.id, service.name)}
                    >
                      <IconSymbol name={config ? "pencil" : "plus"} size={18} color={colors.primary} />
                    </Pressable>
                    {config && (
                      <Pressable
                        style={({ pressed }) => [styles.actionBtn, { backgroundColor: "#F4433622", opacity: pressed ? 0.7 : 1, marginTop: 6 }]}
                        onPress={() => handleDelete(service.id, service.name)}
                      >
                        <IconSymbol name="trash" size={18} color="#F44336" />
                      </Pressable>
                    )}
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Modal de edição */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModalVisible(false)}>
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={dyn.modalTitle}>Mensagem de Retorno</Text>
              <Text style={dyn.modalSubtitle}>{editing?.serviceName}</Text>
            </View>
            <Pressable onPress={() => setModalVisible(false)} style={({ pressed }) => [styles.closeBtn, { opacity: pressed ? 0.7 : 1 }]}>
              <IconSymbol name="xmark" size={20} color={colors.muted} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
            {/* Dias de delay */}
            <Text style={dyn.label}>Enviar após quantos dias?</Text>
            <View style={styles.daysRow}>
              {[7, 14, 21, 30, 45, 60].map((d) => (
                <Pressable
                  key={d}
                  style={({ pressed }) => [
                    styles.dayBtn,
                    {
                      backgroundColor: editing?.delayDays === d ? colors.primary : colors.surface,
                      borderColor: editing?.delayDays === d ? colors.primary : colors.border,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                  onPress={() => setEditing((e) => e ? { ...e, delayDays: d } : e)}
                >
                  <Text style={{ color: editing?.delayDays === d ? "#fff" : colors.foreground, fontWeight: "700", fontSize: 13 }}>
                    {d}d
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Mensagem */}
            <Text style={[dyn.label, { marginTop: 16 }]}>Mensagem</Text>
            <Text style={[dyn.label, { fontWeight: "400", marginBottom: 8 }]}>
              Use os atalhos abaixo para personalizar:
            </Text>
            <View style={styles.placeholderRow}>
              {PLACEHOLDERS.map((p) => (
                <Pressable
                  key={p}
                  style={({ pressed }) => [dyn.placeholder, { opacity: pressed ? 0.7 : 1 }]}
                  onPress={() => setEditing((e) => e ? { ...e, messageTemplate: e.messageTemplate + p } : e)}
                >
                  <Text style={dyn.placeholderText}>{p}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              style={[dyn.input, { minHeight: 100, textAlignVertical: "top" }]}
              value={editing?.messageTemplate ?? ""}
              onChangeText={(t) => setEditing((e) => e ? { ...e, messageTemplate: t } : e)}
              multiline
              placeholder="Ex: Olá {nome}! Faz {dias} dias desde seu último {servico}..."
              placeholderTextColor={colors.muted}
            />

            {/* Toggle ativo */}
            <View style={styles.switchRow}>
              <Text style={[dyn.label, { marginBottom: 0 }]}>Mensagem ativa</Text>
              <Switch
                value={editing?.isActive ?? true}
                onValueChange={(v) => setEditing((e) => e ? { ...e, isActive: v } : e)}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#fff"
              />
            </View>

            <Pressable
              style={({ pressed }) => [dyn.saveBtn, { opacity: pressed || upsertMutation.isPending ? 0.7 : 1 }]}
              onPress={handleSave}
              disabled={upsertMutation.isPending}
            >
              {upsertMutation.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={dyn.saveBtnText}>Salvar Configuração</Text>
              )}
            </Pressable>
          </ScrollView>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  infoBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  infoText: { flex: 1, fontSize: 13, lineHeight: 18 },
  cardRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  cardMeta: { flexDirection: "row", marginTop: 4 },
  cardActions: { alignItems: "center" },
  actionBtn: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  modalContainer: { flex: 1, padding: 20 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 },
  closeBtn: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  daysRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  dayBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5 },
  placeholderRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 },
  switchRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
});
