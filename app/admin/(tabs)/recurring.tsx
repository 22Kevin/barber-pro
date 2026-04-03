import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { AdminHeader } from "@/components/admin-header";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";
import { useBarberAuth } from "@/lib/auth-context";

const INTERVAL_LABELS: Record<number, string> = {
  1: "Toda semana",
  2: "A cada 2 semanas",
  3: "A cada 3 semanas",
  4: "Mensal",
};

type NewRecurring = {
  clientId: number | null;
  barberId: number | null;
  serviceId: number | null;
  startDate: string;
  startTime: string;
  endTime: string;
  intervalWeeks: number;
  occurrences: number;
  notes: string;
};

const EMPTY_FORM: NewRecurring = {
  clientId: null,
  barberId: null,
  serviceId: null,
  startDate: new Date().toISOString().slice(0, 10),
  startTime: "09:00",
  endTime: "10:00",
  intervalWeeks: 2,
  occurrences: 4,
  notes: "",
};

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/** Combobox de busca com dropdown customizado — funciona em iOS, Android e Web */
function SearchCombobox({
  label,
  placeholder,
  items,
  selectedId,
  onSelect,
  colors,
}: {
  label: string;
  placeholder: string;
  items: { id: number; label: string }[];
  selectedId: number | null;
  onSelect: (id: number, item: { id: number; label: string }) => void;
  colors: ReturnType<typeof useColors>;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const selectedItem = items.find((i) => i.id === selectedId);
  const filtered = useMemo(
    () =>
      query.trim() === ""
        ? items.slice(0, 40)
        : items.filter((i) => i.label.toLowerCase().includes(query.toLowerCase())).slice(0, 20),
    [items, query]
  );

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [open]);

  function handleSelect(item: { id: number; label: string }) {
    onSelect(item.id, item);
    setQuery("");
    setOpen(false);
  }

  function handleClear(e: any) {
    if (e?.stopPropagation) e.stopPropagation();
    onSelect(0, { id: 0, label: "" });
    setQuery("");
    setOpen(false);
  }

  const isSelected = !!selectedId && selectedId > 0;

  return (
    <View style={{ marginBottom: 16 }}>
      {/* Label */}
      <Text style={[comboStyles.label, { color: colors.muted }]}>{label}</Text>

      {/* Trigger */}
      <Pressable
        style={[
          comboStyles.trigger,
          {
            backgroundColor: colors.surface,
            borderColor: isSelected ? "#C9A84C" : open ? "#C9A84C55" : colors.border,
            borderWidth: isSelected || open ? 1.5 : 1,
          },
        ]}
        onPress={() => setOpen((v) => !v)}
      >
        <View style={[comboStyles.triggerIconBox, { backgroundColor: isSelected ? "#C9A84C22" : colors.border + "44" }]}>
          <IconSymbol name="magnifyingglass" size={15} color={isSelected ? "#C9A84C" : colors.muted} />
        </View>
        <Text
          style={[
            comboStyles.triggerText,
            { color: isSelected ? colors.foreground : colors.muted },
          ]}
          numberOfLines={1}
        >
          {selectedItem ? selectedItem.label : placeholder}
        </Text>
        {isSelected ? (
          <TouchableOpacity onPress={handleClear} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <View style={[comboStyles.clearBtn, { backgroundColor: colors.border }]}>
              <IconSymbol name="xmark" size={10} color={colors.muted} />
            </View>
          </TouchableOpacity>
        ) : null}
        <IconSymbol
          name={open ? "chevron.up" : "chevron.down"}
          size={14}
          color={colors.muted}
        />
      </Pressable>

      {/* Dropdown inline (funciona em web e nativo) */}
      {open && (
        <View
          style={[
            comboStyles.dropdown,
            {
              backgroundColor: colors.background,
              borderColor: "#C9A84C33",
              shadowColor: "#000",
            },
          ]}
        >
          {/* Busca */}
          <View style={[comboStyles.searchRow, { borderBottomColor: colors.border }]}>
            <IconSymbol name="magnifyingglass" size={15} color={colors.muted} />
            <TextInput
              ref={inputRef}
              style={[comboStyles.searchInput, { color: colors.foreground }]}
              placeholder={`Buscar ${label.replace(" *", "").toLowerCase()}...`}
              placeholderTextColor={colors.muted}
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
              autoCapitalize="none"
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery("")}>
                <IconSymbol name="xmark.circle.fill" size={16} color={colors.muted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Lista */}
          <ScrollView
            style={{ maxHeight: 220 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {filtered.length === 0 ? (
              <View style={comboStyles.emptyRow}>
                <Text style={{ color: colors.muted, fontSize: 13 }}>Nenhum resultado encontrado</Text>
              </View>
            ) : (
              filtered.map((item) => {
                const active = item.id === selectedId;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      comboStyles.option,
                      { borderBottomColor: colors.border + "55" },
                      active && { backgroundColor: "#C9A84C15" },
                    ]}
                    onPress={() => handleSelect(item)}
                    activeOpacity={0.7}
                  >
                    {active && (
                      <View style={comboStyles.activeIndicator} />
                    )}
                    <Text
                      style={[
                        comboStyles.optionText,
                        { color: active ? "#C9A84C" : colors.foreground },
                        active && { fontWeight: "700" },
                      ]}
                      numberOfLines={1}
                    >
                      {item.label}
                    </Text>
                    {active && (
                      <IconSymbol name="checkmark" size={14} color="#C9A84C" />
                    )}
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>

          {/* Fechar */}
          <TouchableOpacity
            style={[comboStyles.closeRow, { borderTopColor: colors.border }]}
            onPress={() => { setOpen(false); setQuery(""); }}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 13, color: colors.muted, fontWeight: "600" }}>Fechar</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const comboStyles = StyleSheet.create({
  label: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 13,
    gap: 10,
  },
  triggerIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  triggerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
  },
  clearBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  dropdown: {
    marginTop: 4,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    ...(Platform.OS === "web"
      ? { boxShadow: "0 8px 32px rgba(0,0,0,0.4)" } as any
      : {
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.3,
          shadowRadius: 16,
          elevation: 12,
        }),
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
    borderBottomWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
    ...(Platform.OS === "web" ? { outlineStyle: "none" } as any : {}),
  },
  emptyRow: {
    paddingVertical: 24,
    alignItems: "center",
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    gap: 10,
  },
  activeIndicator: {
    width: 3,
    height: 20,
    borderRadius: 2,
    backgroundColor: "#C9A84C",
  },
  optionText: {
    flex: 1,
    fontSize: 14,
  },
  closeRow: {
    alignItems: "center",
    paddingVertical: 12,
    borderTopWidth: 1,
  },
});

export default function RecurringScreen() {
  const colors = useColors();
  const { barber } = useBarberAuth();
  const tenantId = barber?.tenantId ?? undefined;
  const utils = trpc.useUtils();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<NewRecurring>(EMPTY_FORM);

  const listQuery = trpc.recurring.listAll.useQuery();
  const clientsQuery = trpc.clients.list.useQuery();
  const barbersQuery = trpc.barbers.list.useQuery();
  const servicesQuery = trpc.services.list.useQuery({ activeOnly: true, tenantId });

  const cancelMutation = trpc.recurring.cancel.useMutation({
    onSuccess: () => utils.recurring.listAll.invalidate(),
  });
  const createMutation = trpc.recurring.create.useMutation({
    onSuccess: () => {
      utils.recurring.listAll.invalidate();
      setShowForm(false);
      setForm(EMPTY_FORM);
    },
    onError: (err) => Alert.alert("Erro", err.message),
  });

  const clients = useMemo(
    () => (clientsQuery.data ?? []).map((c) => ({ id: c.id, label: c.name + (c.phone ? ` · ${c.phone}` : "") })),
    [clientsQuery.data]
  );
  const barbers = useMemo(
    () => (barbersQuery.data ?? []).map((b) => ({ id: b.id, label: b.name })),
    [barbersQuery.data]
  );
  const services = useMemo(
    () => (servicesQuery.data ?? []).map((s) => ({ id: s.id, label: s.name, duration: s.durationMinutes })),
    [servicesQuery.data]
  );

  function handleSelectService(id: number) {
    if (id === 0) { setForm((f) => ({ ...f, serviceId: null })); return; }
    const svc = (servicesQuery.data ?? []).find((s) => s.id === id);
    const duration = svc?.durationMinutes ?? 60;
    setForm((f) => ({ ...f, serviceId: id, endTime: addMinutes(f.startTime, duration) }));
  }

  function handleStartTimeChange(t: string) {
    setForm((f) => {
      const svc = (servicesQuery.data ?? []).find((s) => s.id === f.serviceId);
      const duration = svc?.durationMinutes ?? 60;
      return { ...f, startTime: t, endTime: f.serviceId ? addMinutes(t, duration) : f.endTime };
    });
  }

  function handleCancel(id: number, clientName: string) {
    Alert.alert(
      "Cancelar Recorrência",
      `Cancelar a série de agendamentos recorrentes de ${clientName}? Os agendamentos já criados não serão removidos.`,
      [
        { text: "Não", style: "cancel" },
        { text: "Cancelar Série", style: "destructive", onPress: () => cancelMutation.mutate({ id }) },
      ]
    );
  }

  function handleCreate() {
    if (!form.clientId) { Alert.alert("Atenção", "Selecione um cliente."); return; }
    if (!form.barberId) { Alert.alert("Atenção", "Selecione um barbeiro."); return; }
    if (!form.serviceId) { Alert.alert("Atenção", "Selecione um serviço."); return; }
    if (!form.startDate) { Alert.alert("Atenção", "Informe a data de início."); return; }
    createMutation.mutate({
      clientId: form.clientId,
      barberId: form.barberId,
      serviceId: form.serviceId,
      startDate: form.startDate,
      startTime: form.startTime,
      endTime: form.endTime,
      intervalWeeks: form.intervalWeeks,
      occurrences: form.occurrences,
      notes: form.notes || undefined,
    });
  }

  const data = listQuery.data ?? [];

  const dyn = {
    label: {
      fontSize: 11,
      fontWeight: "700" as const,
      color: colors.muted,
      marginBottom: 8,
      marginTop: 16,
      textTransform: "uppercase" as const,
      letterSpacing: 0.8,
    },
    input: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 13,
      color: colors.foreground,
      fontSize: 14,
      fontWeight: "500" as const,
    },
    chip: (selected: boolean) => ({
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 10,
      borderWidth: 1.5,
      backgroundColor: selected ? "#C9A84C" : colors.surface,
      borderColor: selected ? "#C9A84C" : colors.border,
    }),
    chipText: (selected: boolean) => ({
      fontSize: 13,
      fontWeight: "600" as const,
      color: selected ? "#0A0A0A" : colors.foreground,
    }),
  };

  return (
    <ScreenContainer containerClassName="bg-background" edges={["left", "right"]}>
      <AdminHeader
        title="Agendamentos Recorrentes"
        rightElement={
          <Pressable
            style={({ pressed }) => [styles.newBtn, { backgroundColor: "#C9A84C", opacity: pressed ? 0.8 : 1 }]}
            onPress={() => { setForm(EMPTY_FORM); setShowForm(true); }}
          >
            <IconSymbol name="plus" size={16} color="#0A0A0A" />
            <Text style={styles.newBtnText}>Nova</Text>
          </Pressable>
        }
      />

      {/* ── Lista de recorrências ── */}
      {listQuery.isLoading ? (
        <ActivityIndicator color="#C9A84C" style={{ marginTop: 60 }} />
      ) : !showForm && data.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={[styles.emptyIcon, { backgroundColor: "#C9A84C15" }]}>
            <IconSymbol name="calendar.badge.clock" size={40} color="#C9A84C" />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Nenhuma recorrência ativa</Text>
          <Text style={[styles.emptySubtitle, { color: colors.muted }]}>
            Toque em "Nova" para criar uma série de agendamentos recorrentes.
          </Text>
          <Pressable
            style={({ pressed }) => [styles.emptyBtn, { opacity: pressed ? 0.8 : 1 }]}
            onPress={() => { setForm(EMPTY_FORM); setShowForm(true); }}
          >
            <Text style={styles.emptyBtnText}>+ Nova Recorrência</Text>
          </Pressable>
        </View>
      ) : !showForm ? (
        <FlatList
          data={data}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          renderItem={({ item }) => {
            const intervalLabel = INTERVAL_LABELS[item.intervalWeeks] ?? `A cada ${item.intervalWeeks} semanas`;
            const startFormatted = item.startDate
              ? new Date(item.startDate + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
              : "—";
            return (
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.cardHeader}>
                  <View style={[styles.iconBox, { backgroundColor: "#C9A84C22" }]}>
                    <IconSymbol name="arrow.clockwise" size={20} color="#C9A84C" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.clientName, { color: colors.foreground }]} numberOfLines={1}>
                      {(item as any).clientName ?? "Cliente"}
                    </Text>
                    <Text style={[styles.serviceName, { color: colors.muted }]} numberOfLines={1}>
                      {(item as any).serviceName ?? "Serviço"} · {(item as any).barberName ?? "Barbeiro"}
                    </Text>
                  </View>
                  <Pressable
                    style={({ pressed }) => [styles.cancelBtn, { opacity: pressed ? 0.6 : 1 }]}
                    onPress={() => handleCancel(item.id, (item as any).clientName ?? "cliente")}
                  >
                    <IconSymbol name="xmark.circle.fill" size={22} color={colors.error} />
                  </Pressable>
                </View>
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <View style={styles.infoRow}>
                  <View style={styles.infoItem}>
                    <Text style={[styles.infoLabel, { color: colors.muted }]}>Frequência</Text>
                    <Text style={[styles.infoValue, { color: colors.foreground }]}>{intervalLabel}</Text>
                  </View>
                  <View style={styles.infoItem}>
                    <Text style={[styles.infoLabel, { color: colors.muted }]}>Início</Text>
                    <Text style={[styles.infoValue, { color: colors.foreground }]}>{startFormatted}</Text>
                  </View>
                  <View style={styles.infoItem}>
                    <Text style={[styles.infoLabel, { color: colors.muted }]}>Ocorrências</Text>
                    <Text style={[styles.infoValue, { color: colors.foreground }]}>{item.occurrences}x</Text>
                  </View>
                  <View style={styles.infoItem}>
                    <Text style={[styles.infoLabel, { color: colors.muted }]}>Horário</Text>
                    <Text style={[styles.infoValue, { color: colors.foreground }]}>{item.startTime?.slice(0, 5) ?? "—"}</Text>
                  </View>
                </View>
              </View>
            );
          }}
        />
      ) : null}

      {/* ── Formulário inline (substitui modal — funciona em web e nativo) ── */}
      {showForm && (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Cabeçalho do formulário */}
          <View style={styles.formHeader}>
            <View>
              <Text style={[styles.formTitle, { color: colors.foreground }]}>Nova Recorrência</Text>
              <Text style={{ fontSize: 13, color: colors.muted, marginTop: 2 }}>Preencha os campos abaixo</Text>
            </View>
            <TouchableOpacity
              style={[styles.formCloseBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => { setShowForm(false); setForm(EMPTY_FORM); }}
              activeOpacity={0.7}
            >
              <IconSymbol name="xmark" size={16} color={colors.muted} />
            </TouchableOpacity>
          </View>

          <View style={[styles.formCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>

            {/* Cliente */}
            <SearchCombobox
              label="Cliente *"
              placeholder="Selecionar cliente..."
              items={clients}
              selectedId={form.clientId}
              onSelect={(id) => setForm((f) => ({ ...f, clientId: id === 0 ? null : id }))}
              colors={colors}
            />

            {/* Barbeiro */}
            <SearchCombobox
              label="Barbeiro *"
              placeholder="Selecionar barbeiro..."
              items={barbers}
              selectedId={form.barberId}
              onSelect={(id) => setForm((f) => ({ ...f, barberId: id === 0 ? null : id }))}
              colors={colors}
            />

            {/* Serviço */}
            <SearchCombobox
              label="Serviço *"
              placeholder="Selecionar serviço..."
              items={services}
              selectedId={form.serviceId}
              onSelect={(id, _item) => handleSelectService(id)}
              colors={colors}
            />

          </View>

          {/* Data e horários */}
          <View style={[styles.formCard, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: 12 }]}>
            <Text style={dyn.label}>DATA DE INÍCIO *</Text>
            <TextInput
              style={[dyn.input, { ...(Platform.OS === "web" ? { outlineStyle: "none" } as any : {}) }]}
              value={form.startDate}
              onChangeText={(t) => setForm((f) => ({ ...f, startDate: t }))}
              placeholder="AAAA-MM-DD"
              placeholderTextColor={colors.muted}
            />

            <View style={{ flexDirection: "row", gap: 12, marginTop: 4 }}>
              <View style={{ flex: 1 }}>
                <Text style={dyn.label}>HORÁRIO INÍCIO</Text>
                <TextInput
                  style={[dyn.input, { ...(Platform.OS === "web" ? { outlineStyle: "none" } as any : {}) }]}
                  value={form.startTime}
                  onChangeText={handleStartTimeChange}
                  placeholder="09:00"
                  placeholderTextColor={colors.muted}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={dyn.label}>HORÁRIO FIM</Text>
                <View style={[dyn.input, { opacity: 0.6, justifyContent: "center" }]}>
                  <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "500" }}>{form.endTime}</Text>
                </View>
              </View>
            </View>
            {form.serviceId && (
              <Text style={{ fontSize: 11, color: "#C9A84C", marginTop: 6 }}>
                ⏱ Calculado automaticamente pela duração do serviço
              </Text>
            )}
          </View>

          {/* Frequência */}
          <View style={[styles.formCard, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: 12 }]}>
            <Text style={dyn.label}>FREQUÊNCIA</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {[1, 2, 3, 4].map((w) => (
                <TouchableOpacity
                  key={w}
                  style={dyn.chip(form.intervalWeeks === w)}
                  onPress={() => setForm((f) => ({ ...f, intervalWeeks: w }))}
                  activeOpacity={0.8}
                >
                  <Text style={dyn.chipText(form.intervalWeeks === w)}>{INTERVAL_LABELS[w]}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[dyn.label, { marginTop: 16 }]}>NÚMERO DE OCORRÊNCIAS</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {[2, 4, 6, 8, 12, 24].map((n) => (
                <TouchableOpacity
                  key={n}
                  style={dyn.chip(form.occurrences === n)}
                  onPress={() => setForm((f) => ({ ...f, occurrences: n }))}
                  activeOpacity={0.8}
                >
                  <Text style={dyn.chipText(form.occurrences === n)}>{n}x</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Observações */}
          <View style={[styles.formCard, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: 12 }]}>
            <Text style={dyn.label}>OBSERVAÇÕES</Text>
            <TextInput
              style={[dyn.input, { minHeight: 80, textAlignVertical: "top", ...(Platform.OS === "web" ? { outlineStyle: "none" } as any : {}) }]}
              value={form.notes}
              onChangeText={(t) => setForm((f) => ({ ...f, notes: t }))}
              multiline
              placeholder="Observações opcionais..."
              placeholderTextColor={colors.muted}
            />
          </View>

          {/* Botão criar */}
          <TouchableOpacity
            style={[styles.saveBtn, { opacity: createMutation.isPending ? 0.7 : 1 }]}
            onPress={handleCreate}
            disabled={createMutation.isPending}
            activeOpacity={0.85}
          >
            {createMutation.isPending ? (
              <ActivityIndicator color="#0A0A0A" />
            ) : (
              <>
                <IconSymbol name="checkmark.circle.fill" size={18} color="#0A0A0A" />
                <Text style={styles.saveBtnText}>Criar Recorrência</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, paddingHorizontal: 40 },
  emptyIcon: { width: 80, height: 80, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: 18, fontWeight: "700", textAlign: "center" },
  emptySubtitle: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  emptyBtn: {
    marginTop: 8, paddingHorizontal: 24, paddingVertical: 13, borderRadius: 12,
    backgroundColor: "#C9A84C",
  },
  emptyBtnText: { color: "#0A0A0A", fontWeight: "700", fontSize: 15 },
  newBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  newBtnText: { color: "#0A0A0A", fontWeight: "700", fontSize: 13 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconBox: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  clientName: { fontSize: 15, fontWeight: "700" },
  serviceName: { fontSize: 13, marginTop: 2 },
  cancelBtn: { padding: 4 },
  divider: { height: 1 },
  infoRow: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  infoItem: { flex: 1, minWidth: 80 },
  infoLabel: { fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 },
  infoValue: { fontSize: 13, fontWeight: "600" },
  formHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  formTitle: { fontSize: 22, fontWeight: "800" },
  formCloseBtn: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  formCard: { borderRadius: 16, borderWidth: 1, padding: 16 },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#C9A84C",
    borderRadius: 14,
    padding: 16,
    marginTop: 16,
  },
  saveBtnText: { color: "#0A0A0A", fontWeight: "800", fontSize: 16 },
});
