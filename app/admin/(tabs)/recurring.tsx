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
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { AdminHeader } from "@/components/admin-header";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";
import { useBarberAuth } from "@/lib/auth-context";


function toLocalDate(d: Date): string {
  const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,"0"), dd = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${dd}`;
}

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
  startDate: toLocalDate(new Date()),
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

/** Seletor de horário visual — rolagem de horas e minutos */
function InlineTimePicker({
  value,
  onChange,
  colors,
  label,
  disabled = false,
}: {
  value: string;
  onChange: (time: string) => void;
  colors: ReturnType<typeof useColors>;
  label: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [h, m] = value.split(":").map(Number);
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from({ length: 12 }, (_, i) => i * 5); // 0,5,10,...,55

  return (
    <View style={{ flex: 1 }}>
      <Text style={{ fontSize: 11, fontWeight: "700", color: colors.muted, letterSpacing: 0.8, textTransform: "uppercase" as const, marginBottom: 6 }}>{label}</Text>
      <TouchableOpacity
        onPress={() => !disabled && setOpen(!open)}
        activeOpacity={disabled ? 1 : 0.7}
        style={[{
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: open ? "#C9A84C" : colors.border,
          borderRadius: 12,
          paddingHorizontal: 14,
          paddingVertical: 12,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          opacity: disabled ? 0.5 : 1,
        }]}
      >
        <Text style={{ fontSize: 16, fontWeight: "700", color: disabled ? colors.muted : colors.foreground }}>{value}</Text>
        <IconSymbol name={open ? "chevron.up" : "chevron.down"} size={12} color={disabled ? colors.muted : "#C9A84C"} />
      </TouchableOpacity>
      {open && !disabled && (
        <View style={[{
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: "#C9A84C",
          borderRadius: 12,
          marginTop: 6,
          flexDirection: "row",
          overflow: "hidden",
        }]}>
          {/* Horas */}
          <ScrollView style={{ flex: 1, maxHeight: 180 }} showsVerticalScrollIndicator={false}>
            {hours.map((hr) => (
              <TouchableOpacity
                key={hr}
                onPress={() => {
                  const newTime = `${String(hr).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
                  onChange(newTime);
                }}
                style={[{
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                  backgroundColor: hr === h ? "#C9A84C" : "transparent",
                }]}
              >
                <Text style={[{
                  fontSize: 14,
                  fontWeight: hr === h ? "800" : "500",
                  color: hr === h ? "#0A0A0A" : colors.foreground,
                  textAlign: "center",
                }]}>{String(hr).padStart(2, "0")}h</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={{ width: 1, backgroundColor: colors.border }} />
          {/* Minutos */}
          <ScrollView style={{ flex: 1, maxHeight: 180 }} showsVerticalScrollIndicator={false}>
            {minutes.map((min) => (
              <TouchableOpacity
                key={min}
                onPress={() => {
                  const newTime = `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
                  onChange(newTime);
                  setOpen(false);
                }}
                style={[{
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                  backgroundColor: min === m ? "#C9A84C" : "transparent",
                }]}
              >
                <Text style={[{
                  fontSize: 14,
                  fontWeight: min === m ? "800" : "500",
                  color: min === m ? "#0A0A0A" : colors.foreground,
                  textAlign: "center",
                }]}>{String(min).padStart(2, "0")}min</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

/** Gera lista de datas futuras para pré-visualização */
function generateDates(startDate: string, intervalWeeks: number, occurrences: number): string[] {
  const dates: string[] = [];
  const d = new Date(startDate + "T12:00:00");
  for (let i = 0; i < occurrences; i++) {
    dates.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + intervalWeeks * 7);
  }
  return dates;
}

/** Calendário inline — sem dependências externas, visual dark/dourado */
function InlineDatePicker({
  value,
  onChange,
  colors,
}: {
  value: string;
  onChange: (date: string) => void;
  colors: ReturnType<typeof useColors>;
}) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(() => {
    const d = value ? new Date(value + "T12:00:00") : today;
    return d.getFullYear();
  });
  const [viewMonth, setViewMonth] = useState(() => {
    const d = value ? new Date(value + "T12:00:00") : today;
    return d.getMonth();
  });

  const MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  const DAYS = ["D","S","T","Q","Q","S","S"];

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // pad to full rows
  while (cells.length % 7 !== 0) cells.push(null);

  const selectedDate = value ? new Date(value + "T12:00:00") : null;
  const todayStr = today.toISOString().slice(0, 10);

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  }
  function selectDay(day: number) {
    const mm = String(viewMonth + 1).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    onChange(`${viewYear}-${mm}-${dd}`);
  }

  return (
    <View style={[calStyles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {/* Nav */}
      <View style={calStyles.nav}>
        <TouchableOpacity onPress={prevMonth} style={calStyles.navBtn} activeOpacity={0.7}>
          <IconSymbol name="chevron.left" size={16} color="#C9A84C" />
        </TouchableOpacity>
        <Text style={[calStyles.monthLabel, { color: colors.foreground }]}>
          {MONTHS[viewMonth]} {viewYear}
        </Text>
        <TouchableOpacity onPress={nextMonth} style={calStyles.navBtn} activeOpacity={0.7}>
          <IconSymbol name="chevron.right" size={16} color="#C9A84C" />
        </TouchableOpacity>
      </View>

      {/* Dias da semana */}
      <View style={calStyles.weekRow}>
        {DAYS.map((d, i) => (
          <Text key={i} style={[calStyles.weekDay, { color: colors.muted }]}>{d}</Text>
        ))}
      </View>

      {/* Grade */}
      {Array.from({ length: cells.length / 7 }, (_, row) => (
        <View key={row} style={calStyles.weekRow}>
          {cells.slice(row * 7, row * 7 + 7).map((day, col) => {
            if (!day) return <View key={col} style={calStyles.cell} />;
            const mm = String(viewMonth + 1).padStart(2, "0");
            const dd = String(day).padStart(2, "0");
            const dateStr = `${viewYear}-${mm}-${dd}`;
            const isSelected = selectedDate &&
              selectedDate.getFullYear() === viewYear &&
              selectedDate.getMonth() === viewMonth &&
              selectedDate.getDate() === day;
            const isToday = dateStr === todayStr;
            const isPast = dateStr < todayStr;
            return (
              <TouchableOpacity
                key={col}
                style={[
                  calStyles.cell,
                  isSelected && calStyles.cellSelected,
                  isToday && !isSelected && calStyles.cellToday,
                ]}
                onPress={() => !isPast && selectDay(day)}
                activeOpacity={isPast ? 1 : 0.7}
                disabled={isPast}
              >
                <Text style={[
                  calStyles.cellText,
                  { color: isPast ? colors.muted + "55" : isSelected ? "#0A0A0A" : isToday ? "#C9A84C" : colors.foreground },
                  isSelected && { fontWeight: "800" },
                ]}>
                  {day}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}

      {/* Data selecionada */}
      {value && (
        <View style={[calStyles.selectedRow, { borderTopColor: colors.border }]}>
          <IconSymbol name="calendar" size={13} color="#C9A84C" />
          <Text style={{ fontSize: 12, color: "#C9A84C", fontWeight: "600" }}>
            {selectedDate?.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
          </Text>
        </View>
      )}
    </View>
  );
}

const calStyles = StyleSheet.create({
  container: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 4,
  },
  nav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  navBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#C9A84C18",
    alignItems: "center",
    justifyContent: "center",
  },
  monthLabel: {
    fontSize: 14,
    fontWeight: "700",
  },
  weekRow: {
    flexDirection: "row",
  },
  weekDay: {
    flex: 1,
    textAlign: "center",
    fontSize: 11,
    fontWeight: "700",
    paddingVertical: 6,
  },
  cell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    margin: 1,
    borderRadius: 8,
  },
  cellSelected: {
    backgroundColor: "#C9A84C",
  },
  cellToday: {
    borderWidth: 1,
    borderColor: "#C9A84C",
  },
  cellText: {
    fontSize: 13,
    fontWeight: "500",
  },
  selectedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
});

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
  const router = useRouter();
  const utils = trpc.useUtils();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<NewRecurring>(EMPTY_FORM);
  const [showConfirm, setShowConfirm] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");
  const [activeTab, setActiveTab] = useState<"active" | "cancelled">("active");
  const [cancelReasonInput, setCancelReasonInput] = useState("");
  const [cancelTargetId, setCancelTargetId] = useState<number | null>(null);
  const [cancelTargetName, setCancelTargetName] = useState("");

  const listQuery = trpc.recurring.listAll.useQuery({ tenantId });
  const cancelledQuery = trpc.recurring.listCancelled.useQuery({ tenantId });
  const statsQuery = trpc.recurring.stats.useQuery({ tenantId });
  const clientsQuery = trpc.clients.list.useQuery({ tenantId });
  const barbersQuery = trpc.barbers.list.useQuery({ tenantId });
  const servicesQuery = trpc.services.list.useQuery({ activeOnly: true, tenantId });

  const cancelMutation = trpc.recurring.cancelWithReason.useMutation({
    onSuccess: () => {
      utils.recurring.listAll.invalidate();
      utils.recurring.listCancelled.invalidate();
      utils.recurring.stats.invalidate();
      setCancelTargetId(null);
      setCancelReasonInput("");
    },
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
    setCancelTargetId(id);
    setCancelTargetName(clientName);
    setCancelReasonInput("");
  }

  function confirmCancel() {
    if (!cancelTargetId) return;
    cancelMutation.mutate({ id: cancelTargetId, reason: cancelReasonInput.trim() || undefined });
  }

  function handleCreate() {
    if (!form.clientId) { Alert.alert("Atenção", "Selecione um cliente."); return; }
    if (!form.barberId) { Alert.alert("Atenção", "Selecione um barbeiro."); return; }
    if (!form.serviceId) { Alert.alert("Atenção", "Selecione um serviço."); return; }
    if (!form.startDate) { Alert.alert("Atenção", "Informe a data de início."); return; }
    // Mostrar card de confirmação antes de salvar
    setShowConfirm(true);
  }

  function confirmCreate() {
    setShowConfirm(false);
    createMutation.mutate({
      clientId: form.clientId!,
      barberId: form.barberId!,
      serviceId: form.serviceId!,
      startDate: form.startDate,
      startTime: form.startTime,
      endTime: form.endTime,
      intervalWeeks: form.intervalWeeks,
      occurrences: form.occurrences,
      notes: form.notes || undefined,
    });
  }

  const allData = listQuery.data ?? [];
  const data = searchFilter.trim()
    ? allData.filter((item: any) => {
        const q = searchFilter.toLowerCase();
        return (
          ((item as any).clientName ?? "").toLowerCase().includes(q) ||
          ((item as any).serviceName ?? "").toLowerCase().includes(q) ||
          ((item as any).barberName ?? "").toLowerCase().includes(q)
        );
      })
    : allData;

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
        title="Assinaturas"
        rightElement={
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable
              style={({ pressed }) => [styles.newBtn, { backgroundColor: colors.surface, borderWidth: 1, borderColor: "#C9A84C", opacity: pressed ? 0.8 : 1 }]}
              onPress={() => router.push("/admin/subscription-plans" as any)}
            >
              <IconSymbol name="star.fill" size={14} color="#C9A84C" />
              <Text style={[styles.newBtnText, { color: "#C9A84C" }]}>Planos</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.newBtn, { backgroundColor: "#C9A84C", opacity: pressed ? 0.8 : 1 }]}
              onPress={() => { setForm(EMPTY_FORM); setShowForm(true); }}
            >
              <IconSymbol name="plus" size={16} color="#0A0A0A" />
              <Text style={styles.newBtnText}>Nova</Text>
            </Pressable>
          </View>
        }
      />

      {/* ── Modal de cancelamento com motivo ── */}
      {cancelTargetId !== null && (
        <View style={[{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.7)", zIndex: 100, justifyContent: "center", alignItems: "center", padding: 24 }]}>
          <View style={[{ backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.border, padding: 20, width: "100%", maxWidth: 400 }]}>
            <Text style={{ fontSize: 18, fontWeight: "800", color: colors.foreground, marginBottom: 4 }}>Cancelar Assinatura</Text>
            <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 16 }}>Cancelar a assinatura de {cancelTargetName}? Os agendamentos já criados não serão removidos.</Text>
            <Text style={{ fontSize: 11, fontWeight: "700", color: colors.muted, textTransform: "uppercase" as const, letterSpacing: 0.8, marginBottom: 6 }}>MOTIVO (OPCIONAL)</Text>
            <TextInput
              style={[{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 13, color: colors.foreground, fontSize: 14, minHeight: 60, textAlignVertical: "top" as const, ...(Platform.OS === "web" ? { outlineStyle: "none" } as any : {}) }]}
              value={cancelReasonInput}
              onChangeText={setCancelReasonInput}
              placeholder="Ex: Cliente solicitou cancelamento, mudou de horário..."
              placeholderTextColor={colors.muted}
              multiline
            />
            <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
              <TouchableOpacity
                style={{ flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingVertical: 13, alignItems: "center" }}
                onPress={() => { setCancelTargetId(null); setCancelReasonInput(""); }}
                activeOpacity={0.7}
              >
                <Text style={{ color: colors.muted, fontWeight: "600", fontSize: 14 }}>Voltar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 2, backgroundColor: colors.error, borderRadius: 12, paddingVertical: 13, alignItems: "center", opacity: cancelMutation.isPending ? 0.7 : 1 }}
                onPress={confirmCancel}
                disabled={cancelMutation.isPending}
                activeOpacity={0.85}
              >
                {cancelMutation.isPending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={{ color: "#fff", fontWeight: "800", fontSize: 14 }}>Cancelar Assinatura</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* ── Dashboard de métricas ── */}
      {!showForm && (
        <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 }}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {[
              { label: "Ativas", value: statsQuery.data?.totalActive ?? 0, color: "#C9A84C" },
              { label: "MRR", value: `R$ ${(statsQuery.data?.estimatedMRR ?? 0).toFixed(0)}`, color: "#22C55E" },
              { label: "Canceladas", value: statsQuery.data?.totalCancelled ?? 0, color: colors.error },
              { label: "Churn", value: `${statsQuery.data?.cancelRate ?? 0}%`, color: "#F59E0B" },
            ].map((m, i) => (
              <View key={i} style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 12, alignItems: "center" }}>
                <Text style={{ fontSize: 18, fontWeight: "900", color: m.color }}>{m.value}</Text>
                <Text style={{ fontSize: 10, fontWeight: "600", color: colors.muted, textTransform: "uppercase" as const, letterSpacing: 0.5, marginTop: 2 }}>{m.label}</Text>
              </View>
            ))}
          </View>

          {/* Tabs: Ativas / Encerradas */}
          <View style={{ flexDirection: "row", gap: 0, marginTop: 12, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, overflow: "hidden" }}>
            {(["active", "cancelled"] as const).map((tab) => (
              <TouchableOpacity
                key={tab}
                style={{ flex: 1, paddingVertical: 10, alignItems: "center", backgroundColor: activeTab === tab ? "#C9A84C" : "transparent" }}
                onPress={() => setActiveTab(tab)}
                activeOpacity={0.8}
              >
                <Text style={{ fontSize: 13, fontWeight: "700", color: activeTab === tab ? "#0A0A0A" : colors.muted }}>
                  {tab === "active" ? `Ativas (${statsQuery.data?.totalActive ?? 0})` : `Encerradas (${statsQuery.data?.totalCancelled ?? 0})`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* ── Lista de assinaturas ── */}
      {listQuery.isLoading ? (
        <ActivityIndicator color="#C9A84C" style={{ marginTop: 60 }} />
      ) : !showForm && activeTab === "active" && allData.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={[styles.emptyIcon, { backgroundColor: "#C9A84C15" }]}>
            <IconSymbol name="calendar.badge.clock" size={40} color="#C9A84C" />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Nenhuma assinatura ativa</Text>
          <Text style={[styles.emptySubtitle, { color: colors.muted }]}>
            Toque em "Nova" para criar uma assinatura de agendamentos recorrentes.
          </Text>
          <Pressable
            style={({ pressed }) => [styles.emptyBtn, { opacity: pressed ? 0.8 : 1 }]}
            onPress={() => { setForm(EMPTY_FORM); setShowForm(true); }}
          >
            <Text style={styles.emptyBtnText}>+ Nova Assinatura</Text>
          </Pressable>
        </View>
      ) : !showForm && activeTab === "cancelled" ? (
        /* ── Lista de encerradas ── */
        <FlatList
          data={cancelledQuery.data ?? []}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          ListEmptyComponent={
            <View style={{ alignItems: "center", paddingTop: 40 }}>
              <Text style={{ fontSize: 15, color: colors.muted }}>Nenhuma assinatura encerrada</Text>
            </View>
          }
          renderItem={({ item }) => {
            const intervalLabel = INTERVAL_LABELS[item.intervalWeeks] ?? `A cada ${item.intervalWeeks} semanas`;
            const cancelDate = item.cancelledAt
              ? new Date(item.cancelledAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
              : "—";
            return (
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, opacity: 0.75 }]}>
                <View style={styles.cardHeader}>
                  <View style={[styles.iconBox, { backgroundColor: `${colors.error}22` }]}>
                    <IconSymbol name="xmark.circle.fill" size={20} color={colors.error} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.clientName, { color: colors.foreground }]} numberOfLines={1}>
                      {(item as any).clientName ?? "Cliente"}
                    </Text>
                    <Text style={[styles.serviceName, { color: colors.muted }]} numberOfLines={1}>
                      {(item as any).serviceName ?? "Serviço"} · {(item as any).barberName ?? "Barbeiro"}
                    </Text>
                  </View>
                  <View style={{ backgroundColor: `${colors.error}22`, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
                    <Text style={{ fontSize: 10, fontWeight: "700", color: colors.error }}>CANCELADA</Text>
                  </View>
                </View>
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <View style={styles.infoRow}>
                  <View style={styles.infoItem}>
                    <Text style={[styles.infoLabel, { color: colors.muted }]}>Frequência</Text>
                    <Text style={[styles.infoValue, { color: colors.foreground }]}>{intervalLabel}</Text>
                  </View>
                  <View style={styles.infoItem}>
                    <Text style={[styles.infoLabel, { color: colors.muted }]}>Cancelada em</Text>
                    <Text style={[styles.infoValue, { color: colors.error }]}>{cancelDate}</Text>
                  </View>
                  <View style={styles.infoItem}>
                    <Text style={[styles.infoLabel, { color: colors.muted }]}>Ocorrências</Text>
                    <Text style={[styles.infoValue, { color: colors.foreground }]}>{item.occurrences}x</Text>
                  </View>
                </View>
                {item.cancelReason ? (
                  <View style={{ backgroundColor: `${colors.error}10`, borderRadius: 10, padding: 10, marginTop: 4 }}>
                    <Text style={{ fontSize: 11, fontWeight: "600", color: colors.muted, textTransform: "uppercase" as const, letterSpacing: 0.5, marginBottom: 2 }}>Motivo</Text>
                    <Text style={{ fontSize: 13, color: colors.foreground }}>{item.cancelReason}</Text>
                  </View>
                ) : null}
              </View>
            );
          }}
        />
      ) : !showForm && activeTab === "active" ? (
        <FlatList
          data={data}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          ListHeaderComponent={
            allData.length > 3 ? (
              <View style={[{
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 12,
                marginBottom: 6,
              }]}>
                <IconSymbol name="magnifyingglass" size={16} color={colors.muted} />
                <TextInput
                  style={[{
                    flex: 1,
                    paddingVertical: 12,
                    paddingHorizontal: 8,
                    color: colors.foreground,
                    fontSize: 14,
                    ...(Platform.OS === "web" ? { outlineStyle: "none" } as any : {}),
                  }]}
                  placeholder="Buscar por cliente, serviço ou barbeiro..."
                  placeholderTextColor={colors.muted}
                  value={searchFilter}
                  onChangeText={setSearchFilter}
                />
                {searchFilter.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchFilter("")} activeOpacity={0.7}>
                    <IconSymbol name="xmark" size={14} color={colors.muted} />
                  </TouchableOpacity>
                )}
              </View>
            ) : null
          }
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
              <Text style={[styles.formTitle, { color: colors.foreground }]}>Nova Assinatura</Text>
              <Text style={{ fontSize: 13, color: colors.muted, marginTop: 2 }}>Configure os detalhes da assinatura</Text>
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
            <InlineDatePicker
              value={form.startDate}
              onChange={(d) => setForm((f) => ({ ...f, startDate: d }))}
              colors={colors}
            />

            <View style={{ flexDirection: "row", gap: 12, marginTop: 4 }}>
              <InlineTimePicker
                label="HORÁRIO INÍCIO"
                value={form.startTime}
                onChange={handleStartTimeChange}
                colors={colors}
              />
              <InlineTimePicker
                label="HORÁRIO FIM"
                value={form.endTime}
                onChange={() => {}}
                colors={colors}
                disabled={true}
              />
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

          {/* Card de confirmação */}
          {showConfirm && (() => {
            const clientLabel = clients.find((c) => c.id === form.clientId)?.label ?? "";
            const barberLabel = barbers.find((b) => b.id === form.barberId)?.label ?? "";
            const serviceLabel = services.find((s) => s.id === form.serviceId)?.label ?? "";
            const freqLabel = { 1: "Toda semana", 2: "A cada 2 semanas", 3: "A cada 3 semanas", 4: "Mensal" }[form.intervalWeeks] ?? "";
            const dateFormatted = form.startDate
              ? new Date(form.startDate + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })
              : "";
            return (
              <View style={[styles.confirmCard, { backgroundColor: colors.surface, borderColor: "#C9A84C" }]}>
                <View style={styles.confirmHeader}>
                  <View style={styles.confirmIconBox}>
                    <IconSymbol name="checkmark.circle.fill" size={22} color="#C9A84C" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.confirmTitle, { color: colors.foreground }]}>Confirmar Assinatura</Text>
                    <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>Revise os dados antes de criar</Text>
                  </View>
                  <TouchableOpacity onPress={() => setShowConfirm(false)} activeOpacity={0.7}>
                    <IconSymbol name="xmark" size={16} color={colors.muted} />
                  </TouchableOpacity>
                </View>
                <View style={[styles.confirmDivider, { backgroundColor: colors.border }]} />
                {([
                  ["Cliente", clientLabel.split(" · ")[0]],
                  ["Barbeiro", barberLabel],
                  ["Serviço", serviceLabel],
                  ["Início", dateFormatted],
                  ["Horário", `${form.startTime} – ${form.endTime}`],
                  ["Frequência", freqLabel],
                  ["Ocorrências", `${form.occurrences} agendamentos`],
                ] as [string, string][]).map(([label, value]) => (
                  <View key={label} style={styles.confirmRow}>
                    <Text style={[styles.confirmRowLabel, { color: colors.muted }]}>{label}</Text>
                    <Text style={[styles.confirmRowValue, { color: colors.foreground }]} numberOfLines={2}>{value}</Text>
                  </View>
                ))}
                {form.notes ? (
                  <View style={styles.confirmRow}>
                    <Text style={[styles.confirmRowLabel, { color: colors.muted }]}>Obs.</Text>
                    <Text style={[styles.confirmRowValue, { color: colors.foreground }]}>{form.notes}</Text>
                  </View>
                ) : null}
                {/* Pré-visualização das datas */}
                <View style={[styles.confirmDivider, { backgroundColor: colors.border, marginTop: 4 }]} />
                <Text style={[styles.confirmRowLabel, { color: colors.muted, marginBottom: 6, marginTop: 4 }]}>DATAS GERADAS</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  {generateDates(form.startDate, form.intervalWeeks, form.occurrences).map((d, i) => {
                    const dt = new Date(d + "T12:00:00");
                    const label = dt.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
                    return (
                      <View key={i} style={{ backgroundColor: "#C9A84C18", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 }}>
                        <Text style={{ fontSize: 11, fontWeight: "600", color: "#C9A84C" }}>{label}</Text>
                      </View>
                    );
                  })}
                </View>
                <View style={[styles.confirmDivider, { backgroundColor: colors.border, marginTop: 8 }]} />
                <View style={styles.confirmActions}>
                  <TouchableOpacity
                    style={[styles.confirmCancelBtn, { borderColor: colors.border }]}
                    onPress={() => setShowConfirm(false)}
                    activeOpacity={0.7}
                  >
                    <Text style={{ color: colors.muted, fontWeight: "600", fontSize: 14 }}>Editar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.confirmSaveBtn, { opacity: createMutation.isPending ? 0.7 : 1 }]}
                    onPress={confirmCreate}
                    disabled={createMutation.isPending}
                    activeOpacity={0.85}
                  >
                    {createMutation.isPending ? (
                      <ActivityIndicator color="#0A0A0A" size="small" />
                    ) : (
                      <Text style={{ color: "#0A0A0A", fontWeight: "800", fontSize: 14 }}>Confirmar e Criar</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            );
          })()}

          {/* Botão criar */}
          {!showConfirm && (
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
                  <Text style={styles.saveBtnText}>Criar Assinatura</Text>
                </>
              )}
            </TouchableOpacity>
          )}
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
  confirmCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 16,
    marginTop: 16,
  },
  confirmHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  confirmIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#C9A84C18",
    alignItems: "center",
    justifyContent: "center",
  },
  confirmTitle: { fontSize: 16, fontWeight: "800" },
  confirmDivider: { height: 1, marginBottom: 8 },
  confirmRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 7,
    gap: 12,
  },
  confirmRowLabel: { fontSize: 12, fontWeight: "600", textTransform: "uppercase" as const, letterSpacing: 0.5, flex: 0.45 },
  confirmRowValue: { fontSize: 13, fontWeight: "600", flex: 0.55, textAlign: "right" as const },
  confirmActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  confirmCancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmSaveBtn: {
    flex: 2,
    backgroundColor: "#C9A84C",
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
  },
});
