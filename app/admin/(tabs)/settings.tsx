import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
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
import { useBarberAuth } from "@/lib/auth-context";
import { trpc } from "@/lib/trpc";
import { SingleImageUploader } from "@/components/media-uploader";
import { TimePickerModal } from "@/components/time-picker-modal";

type SettingsTab = "shop" | "barbers" | "hours";

const GOOGLE_MAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const ROLES = [
  { key: "super_admin", label: "Super Admin" },
  { key: "barber",      label: "Barbeiro" },
  { key: "receptionist", label: "Recepcionista" },
];

export default function SettingsScreen() {
  const { barber } = useBarberAuth();
  const [activeTab, setActiveTab] = useState<SettingsTab>("shop");
  const [showBarberModal, setShowBarberModal] = useState(false);
  const [editingBarber, setEditingBarber] = useState<any>(null);
  const [selectedBarberId, setSelectedBarberId] = useState<number | null>(null);

  // Shop form
  const [shopName, setShopName] = useState("");
  const [shopAddress, setShopAddress] = useState("");
  const [shopPhone, setShopPhone] = useState("");
  const [shopWhatsapp, setShopWhatsapp] = useState("");
  const [mpAccessToken, setMpAccessToken] = useState("");
  const [mpPublicKey, setMpPublicKey] = useState("");
  const [shopLogoUrl, setShopLogoUrl] = useState<string | null>(null);
  const [shopGallery, setShopGallery] = useState<string[]>([]);
  const [shopLoaded, setShopLoaded] = useState(false);
  // Google Places
  const [addressSuggestions, setAddressSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [addressSearchTimeout, setAddressSearchTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);

  // Barber form
  const [bName, setBName] = useState("");
  const [bEmail, setBEmail] = useState("");
  const [bPhone, setBPhone] = useState("");
  const [bPassword, setBPassword] = useState("");
  const [bRole, setBRole] = useState("barber");
  const [bSpecialties, setBSpecialties] = useState("");

  // Time picker para horários de trabalho
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timePickerTarget, setTimePickerTarget] = useState<{ dayOfWeek: number; field: "start" | "end"; existing: any } | null>(null);

  const utils = trpc.useUtils();

  const settingsQuery = trpc.settings.get.useQuery();
  if (settingsQuery.data && !shopLoaded) {
    const d = settingsQuery.data as any;
    setShopName(d.shopName ?? "");
    setShopAddress(d.address ?? "");
    setShopPhone(d.phone ?? "");
    setShopWhatsapp(d.whatsapp ?? "");
    setMpAccessToken(d.mercadoPagoAccessToken ?? "");
    setMpPublicKey(d.mercadoPagoPublicKey ?? "");
    if (d.logoUrl) setShopLogoUrl(d.logoUrl);
    if (d.galleryUrls) {
      try { setShopGallery(JSON.parse(d.galleryUrls)); } catch {}
    }
    setShopLoaded(true);
  }

  async function searchAddress(text: string) {
    setShopAddress(text);
    if (addressSearchTimeout) clearTimeout(addressSearchTimeout);
    if (text.length < 3) { setAddressSuggestions([]); setShowSuggestions(false); return; }
    const t = setTimeout(async () => {
      try {
        const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(text)}&language=pt-BR&components=country:br&key=${GOOGLE_MAPS_KEY}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.predictions) {
          setAddressSuggestions(data.predictions);
          setShowSuggestions(true);
        }
      } catch {}
    }, 400);
    setAddressSearchTimeout(t);
  }

  function selectAddress(prediction: any) {
    setShopAddress(prediction.description);
    setAddressSuggestions([]);
    setShowSuggestions(false);
  }

  const barbersQuery = trpc.barbers.list.useQuery();
  const workingHoursQuery = trpc.barbers.workingHours.get.useQuery(
    { barberId: selectedBarberId ?? 0 },
    { enabled: !!selectedBarberId }
  );

  const updateSettingsMutation = trpc.settings.update.useMutation({
    onSuccess: () => { utils.settings.get.invalidate(); Alert.alert("Sucesso", "Configurações salvas!"); },
    onError: (e: any) => Alert.alert("Erro", e.message),
  });

  const createBarberMutation = trpc.barbers.create.useMutation({
    onSuccess: () => { utils.barbers.list.invalidate(); closeBarberModal(); },
    onError: (e: any) => Alert.alert("Erro", e.message),
  });

  const updateBarberMutation = trpc.barbers.update.useMutation({
    onSuccess: () => { utils.barbers.list.invalidate(); closeBarberModal(); },
    onError: (e: any) => Alert.alert("Erro", e.message),
  });

  const upsertHoursMutation = trpc.barbers.workingHours.upsert.useMutation({
    onSuccess: () => utils.barbers.workingHours.get.invalidate(),
  });

  function openCreateBarber() {
    setEditingBarber(null);
    setBName(""); setBEmail(""); setBPhone(""); setBPassword(""); setBRole("barber"); setBSpecialties("");
    setShowBarberModal(true);
  }

  function openEditBarber(b: any) {
    setEditingBarber(b);
    setBName(b.name); setBEmail(b.email ?? ""); setBPhone(b.phone ?? ""); setBPassword(""); setBRole(b.role); setBSpecialties(b.specialties ?? "");
    setShowBarberModal(true);
  }

  function closeBarberModal() { setShowBarberModal(false); setEditingBarber(null); }

  function handleSaveBarber() {
    if (!bName.trim()) { Alert.alert("Atenção", "Informe o nome."); return; }
    if (!editingBarber && (!bPassword || bPassword.length < 6)) { Alert.alert("Atenção", "Senha deve ter pelo menos 6 caracteres."); return; }
    if (editingBarber) {
      const data: any = { id: editingBarber.id, name: bName.trim(), role: bRole as any };
      if (bEmail) data.email = bEmail.trim();
      if (bPhone) data.phone = bPhone.trim();
      if (bSpecialties) data.specialties = bSpecialties.trim();
      if (bPassword && bPassword.length >= 6) data.password = bPassword;
      updateBarberMutation.mutate(data);
    } else {
      createBarberMutation.mutate({ name: bName.trim(), email: bEmail.trim() || undefined, phone: bPhone.trim() || undefined, password: bPassword, role: bRole as any, specialties: bSpecialties.trim() || undefined });
    }
  }

  function handleSaveShop() {
    updateSettingsMutation.mutate({
      shopName: shopName.trim() || undefined,
      address: shopAddress.trim() || null,
      phone: shopPhone.trim() || null,
      whatsapp: shopWhatsapp.trim() || null,
      mercadoPagoAccessToken: mpAccessToken.trim() || null,
      mercadoPagoPublicKey: mpPublicKey.trim() || null,
      logoUrl: shopLogoUrl || null,
      galleryUrls: shopGallery.length > 0 ? JSON.stringify(shopGallery) : null,
    } as any);
  }

  function handleToggleDay(dayOfWeek: number, isWorking: boolean, existing: any) {
    if (!selectedBarberId) return;
    upsertHoursMutation.mutate({
      barberId: selectedBarberId,
      dayOfWeek,
      isWorking,
      startTime: existing?.startTime ?? "09:00",
      endTime: existing?.endTime ?? "18:00",
      lunchStart: existing?.lunchStart ?? null,
      lunchEnd: existing?.lunchEnd ?? null,
    });
  }

  function openTimePicker(dayOfWeek: number, field: "start" | "end", existing: any) {
    setTimePickerTarget({ dayOfWeek, field, existing });
    setShowTimePicker(true);
  }

  function handleTimeConfirm(time: string) {
    if (!timePickerTarget || !selectedBarberId) return;
    const { dayOfWeek, field, existing } = timePickerTarget;
    upsertHoursMutation.mutate({
      barberId: selectedBarberId,
      dayOfWeek,
      isWorking: existing?.isWorking ?? true,
      startTime: field === "start" ? time : (existing?.startTime ?? "09:00"),
      endTime: field === "end" ? time : (existing?.endTime ?? "18:00"),
      lunchStart: existing?.lunchStart ?? null,
      lunchEnd: existing?.lunchEnd ?? null,
    });
    setShowTimePicker(false);
    setTimePickerTarget(null);
  }

  const barbers = (barbersQuery.data ?? []) as any[];
  const hours = (workingHoursQuery.data ?? []) as any[];
  const isSuperAdmin = barber?.role === "super_admin";

  return (
    <ScreenContainer containerClassName="bg-background">
      <View style={styles.header}>
        <Text style={styles.title}>Configurações</Text>
        {activeTab === "barbers" && isSuperAdmin && (
          <Pressable style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.8 }]} onPress={openCreateBarber}>
            <IconSymbol name="plus" size={18} color="#0A0A0A" />
            <Text style={styles.addBtnText}>Barbeiro</Text>
          </Pressable>
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {(["shop", "barbers", "hours"] as SettingsTab[]).map(tab => (
          <Pressable key={tab} style={[styles.tab, activeTab === tab && styles.tabActive]} onPress={() => setActiveTab(tab)}>
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === "shop" ? "Barbearia" : tab === "barbers" ? "Equipe" : "Horários"}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 80 }}>
        {/* Shop Settings */}
        {activeTab === "shop" && (
          <>
            {/* Logo e Galeria */}
            <Text style={styles.sectionTitle}>Identidade Visual</Text>
            <View style={{ flexDirection: "row", gap: 16, marginBottom: 20, alignItems: "flex-start" }}>
              <View style={{ alignItems: "center", gap: 6 }}>
                <SingleImageUploader
                  value={shopLogoUrl}
                  onUpload={(url) => setShopLogoUrl(url)}
                  imageType="logo"
                  label="Logo"
                  size={90}
                />
                <Text style={{ color: "#888880", fontSize: 11 }}>Logo</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.fieldLabel, { marginBottom: 8 }]}>Fotos do Ambiente</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    {shopGallery.map((url, i) => (
                      <View key={i} style={{ position: "relative" }}>
                        <Image source={{ uri: url }} style={{ width: 80, height: 80, borderRadius: 10, backgroundColor: "#1A1A1A" }} />
                        <Pressable
                          style={{ position: "absolute", top: -6, right: -6, backgroundColor: "#EF4444", borderRadius: 10, width: 20, height: 20, alignItems: "center", justifyContent: "center" }}
                          onPress={() => setShopGallery(shopGallery.filter((_, j) => j !== i))}
                        >
                          <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800" }}>✕</Text>
                        </Pressable>
                      </View>
                    ))}
                    {shopGallery.length < 8 && (
                      <SingleImageUploader
                        value={null}
                        onUpload={(url) => setShopGallery([...shopGallery, url])}
                        imageType="gallery"
                        label="+ Foto"
                        size={80}
                      />
                    )}
                  </View>
                </ScrollView>
              </View>
            </View>

            <View style={styles.divider} />
            <Text style={styles.sectionTitle}>Informações da Barbearia</Text>
            {[
              { label: "Nome da Barbearia", value: shopName, setter: setShopName, placeholder: "Barber Pro" },
              { label: "Telefone", value: shopPhone, setter: setShopPhone, placeholder: "(11) 3333-4444" },
              { label: "WhatsApp (com DDD)", value: shopWhatsapp, setter: setShopWhatsapp, placeholder: "5511999999999" },
            ].map(f => (
              <View key={f.label} style={{ marginBottom: 14 }}>
                <Text style={styles.fieldLabel}>{f.label}</Text>
                <TextInput style={styles.input} value={f.value} onChangeText={f.setter} placeholder={f.placeholder} placeholderTextColor="#555" />
              </View>
            ))}

            {/* Endereço com Google Places */}
            <View style={{ marginBottom: 14 }}>
              <Text style={styles.fieldLabel}>Endereço</Text>
              <TextInput
                style={styles.input}
                value={shopAddress}
                onChangeText={searchAddress}
                placeholder="Rua das Flores, 123 — São Paulo"
                placeholderTextColor="#555"
                returnKeyType="done"
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              />
              {showSuggestions && addressSuggestions.length > 0 && (
                <View style={styles.suggestionBox}>
                  {addressSuggestions.map((p: any) => (
                    <Pressable key={p.place_id} style={styles.suggestionItem} onPress={() => selectAddress(p)}>
                      <IconSymbol name="mappin" size={14} color="#C9A84C" />
                      <Text style={styles.suggestionText} numberOfLines={2}>{p.description}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            <View style={styles.divider} />
            <Text style={styles.sectionTitle}>Integração Mercado Pago</Text>
            <View style={styles.infoCard}>
              <IconSymbol name="info.circle.fill" size={16} color="#2196F3" />
              <Text style={styles.infoText}>Acesse o Painel do Mercado Pago → Configurações → Credenciais para obter suas chaves.</Text>
            </View>
            {[
              { label: "Access Token", value: mpAccessToken, setter: setMpAccessToken, placeholder: "APP_USR-..." },
              { label: "Public Key", value: mpPublicKey, setter: setMpPublicKey, placeholder: "APP_USR-..." },
            ].map(f => (
              <View key={f.label} style={{ marginBottom: 14 }}>
                <Text style={styles.fieldLabel}>{f.label}</Text>
                <TextInput style={styles.input} value={f.value} onChangeText={f.setter} placeholder={f.placeholder} placeholderTextColor="#555" secureTextEntry={f.label === "Access Token"} autoCapitalize="none" autoCorrect={false} />
              </View>
            ))}

            <Pressable style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.8 }]} onPress={handleSaveShop} disabled={updateSettingsMutation.isPending}>
              {updateSettingsMutation.isPending ? <ActivityIndicator color="#0A0A0A" /> : <Text style={styles.saveBtnText}>SALVAR CONFIGURAÇÕES</Text>}
            </Pressable>
          </>
        )}

        {/* Barbers */}
        {activeTab === "barbers" && (
          <>
            {barbersQuery.isLoading ? (
              <ActivityIndicator color="#C9A84C" style={{ marginTop: 40 }} />
            ) : barbers.length === 0 ? (
              <View style={styles.emptyCard}>
                <IconSymbol name="person.2.fill" size={40} color="#2A2A2A" />
                <Text style={styles.emptyText}>Nenhum barbeiro cadastrado</Text>
              </View>
            ) : (
              barbers.map((b: any) => (
                <View key={b.id} style={styles.barberCard}>
                  <View style={styles.barberAvatar}>
                    <Text style={styles.barberAvatarText}>{b.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.barberName}>{b.name}</Text>
                    <Text style={styles.barberRole}>{ROLES.find(r => r.key === b.role)?.label ?? b.role}</Text>
                    {b.email ? <Text style={styles.barberEmail}>{b.email}</Text> : null}
                  </View>
                  <View style={styles.barberActions}>
                    {!b.isActive && <View style={styles.inactiveBadge}><Text style={styles.inactiveBadgeText}>Inativo</Text></View>}
                    {isSuperAdmin && (
                      <Pressable onPress={() => openEditBarber(b)} style={({ pressed }) => [styles.editBtn, pressed && { opacity: 0.6 }]}>
                        <IconSymbol name="pencil" size={16} color="#C9A84C" />
                      </Pressable>
                    )}
                  </View>
                </View>
              ))
            )}
          </>
        )}

        {/* Working Hours */}
        {activeTab === "hours" && (
          <>
            <Text style={styles.sectionTitle}>Selecione o Barbeiro</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {barbers.map((b: any) => (
                  <Pressable
                    key={b.id}
                    style={[styles.barberChip, selectedBarberId === b.id && styles.barberChipActive]}
                    onPress={() => setSelectedBarberId(b.id)}
                  >
                    <Text style={[styles.barberChipText, selectedBarberId === b.id && styles.barberChipTextActive]}>{b.name}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            {!selectedBarberId ? (
              <View style={styles.emptyCard}>
                <IconSymbol name="calendar" size={40} color="#2A2A2A" />
                <Text style={styles.emptyText}>Selecione um barbeiro</Text>
              </View>
            ) : workingHoursQuery.isLoading ? (
              <ActivityIndicator color="#C9A84C" />
            ) : (
              DAYS.map((day, idx) => {
                const existing = hours.find((h: any) => h.dayOfWeek === idx);
                const isWorking = existing?.isWorking ?? false;
                return (
                  <View key={idx} style={styles.dayCard}>
                    <View style={{ flex: 1 }}>
                      <View style={styles.dayLeft}>
                        <Text style={styles.dayName}>{day}</Text>
                        <Switch
                          value={isWorking}
                          onValueChange={(v) => handleToggleDay(idx, v, existing)}
                          trackColor={{ false: "#2A2A2A", true: "#C9A84C44" }}
                          thumbColor={isWorking ? "#C9A84C" : "#555"}
                        />
                      </View>
                      {isWorking && (
                        <View style={styles.timeRow}>
                          <Pressable
                            style={styles.timeBtn}
                            onPress={() => openTimePicker(idx, "start", existing)}
                          >
                            <Text style={styles.timeBtnLabel}>Entrada</Text>
                            <Text style={styles.timeBtnValue}>{existing?.startTime ?? "09:00"}</Text>
                          </Pressable>
                          <Text style={styles.timeSep}>→</Text>
                          <Pressable
                            style={styles.timeBtn}
                            onPress={() => openTimePicker(idx, "end", existing)}
                          >
                            <Text style={styles.timeBtnLabel}>Saída</Text>
                            <Text style={styles.timeBtnValue}>{existing?.endTime ?? "18:00"}</Text>
                          </Pressable>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })
            )}
          </>
        )}
      </ScrollView>

      {/* Time Picker para Horários de Trabalho */}
      <TimePickerModal
        visible={showTimePicker}
        title={timePickerTarget?.field === "start" ? "Horário de Entrada" : "Horário de Saída"}
        value={
          timePickerTarget?.field === "start"
            ? (timePickerTarget?.existing?.startTime ?? "09:00")
            : (timePickerTarget?.existing?.endTime ?? "18:00")
        }
        onConfirm={handleTimeConfirm}
        onCancel={() => { setShowTimePicker(false); setTimePickerTarget(null); }}
      />

      {/* Modal Barbeiro */}
      <Modal visible={showBarberModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ width: "100%" }}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{editingBarber ? "Editar Barbeiro" : "Novo Barbeiro"}</Text>
                <Pressable onPress={closeBarberModal}><IconSymbol name="xmark" size={22} color="#888880" /></Pressable>
              </View>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {[
                  { label: "Nome *", value: bName, setter: setBName, placeholder: "João Barbeiro", keyboard: "default" as const },
                  { label: "E-mail", value: bEmail, setter: setBEmail, placeholder: "joao@email.com", keyboard: "email-address" as const },
                  { label: "Telefone", value: bPhone, setter: setBPhone, placeholder: "(11) 99999-9999", keyboard: "phone-pad" as const },
                  { label: editingBarber ? "Nova Senha (deixe vazio para manter)" : "Senha *", value: bPassword, setter: setBPassword, placeholder: "Mínimo 6 caracteres", keyboard: "default" as const },
                  { label: "Especialidades", value: bSpecialties, setter: setBSpecialties, placeholder: "Corte, Barba, Coloração...", keyboard: "default" as const },
                ].map(f => (
                  <View key={f.label} style={{ marginBottom: 14 }}>
                    <Text style={styles.fieldLabel}>{f.label}</Text>
                    <TextInput style={styles.input} value={f.value} onChangeText={f.setter} placeholder={f.placeholder} placeholderTextColor="#555" keyboardType={f.keyboard} secureTextEntry={f.label.includes("Senha")} autoCapitalize={f.keyboard === "email-address" ? "none" : "words"} autoCorrect={false} />
                  </View>
                ))}

                <Text style={styles.fieldLabel}>Perfil de Acesso</Text>
                <View style={styles.roleRow}>
                  {ROLES.map(r => (
                    <Pressable key={r.key} style={[styles.roleChip, bRole === r.key && styles.roleChipActive]} onPress={() => setBRole(r.key)}>
                      <Text style={[styles.roleChipText, bRole === r.key && styles.roleChipTextActive]}>{r.label}</Text>
                    </Pressable>
                  ))}
                </View>

                <Pressable style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.8 }]} onPress={handleSaveBarber} disabled={createBarberMutation.isPending || updateBarberMutation.isPending}>
                  {(createBarberMutation.isPending || updateBarberMutation.isPending) ? <ActivityIndicator color="#0A0A0A" /> : <Text style={styles.saveBtnText}>{editingBarber ? "SALVAR" : "CADASTRAR"}</Text>}
                </Pressable>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, paddingBottom: 12 },
  title: { fontSize: 24, fontWeight: "800", color: "#F5F5F0" },
  addBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "#C9A84C", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, gap: 6 },
  addBtnText: { color: "#0A0A0A", fontWeight: "700", fontSize: 14 },
  tabs: { flexDirection: "row", marginHorizontal: 16, backgroundColor: "#141414", borderRadius: 12, padding: 4, marginBottom: 16, borderWidth: 1, borderColor: "#2A2A2A" },
  tab: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 8 },
  tabActive: { backgroundColor: "#C9A84C" },
  tabText: { fontSize: 13, color: "#888880", fontWeight: "600" },
  tabTextActive: { color: "#0A0A0A" },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#F5F5F0", marginBottom: 12 },
  fieldLabel: { fontSize: 13, color: "#888880", marginBottom: 6, fontWeight: "500" },
  input: { backgroundColor: "#141414", borderWidth: 1, borderColor: "#2A2A2A", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: "#F5F5F0", marginBottom: 0 },
  divider: { height: 1, backgroundColor: "#2A2A2A", marginVertical: 20 },
  infoCard: { flexDirection: "row", gap: 8, backgroundColor: "#2196F322", borderRadius: 10, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: "#2196F344", alignItems: "flex-start" },
  infoText: { flex: 1, fontSize: 12, color: "#2196F3", lineHeight: 17 },
  saveBtn: { backgroundColor: "#C9A84C", borderRadius: 12, paddingVertical: 15, alignItems: "center", marginTop: 8 },
  saveBtnText: { color: "#0A0A0A", fontSize: 15, fontWeight: "800", letterSpacing: 1 },
  emptyCard: { alignItems: "center", paddingVertical: 60, gap: 10 },
  emptyText: { color: "#888880", fontSize: 16, fontWeight: "600" },
  barberCard: { backgroundColor: "#141414", borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "#2A2A2A", flexDirection: "row", alignItems: "center", gap: 12 },
  barberAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#C9A84C22", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#C9A84C44" },
  barberAvatarText: { color: "#C9A84C", fontSize: 20, fontWeight: "700" },
  barberName: { fontSize: 15, fontWeight: "700", color: "#F5F5F0" },
  barberRole: { fontSize: 12, color: "#C9A84C", marginTop: 2 },
  barberEmail: { fontSize: 12, color: "#888880", marginTop: 2 },
  barberActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  inactiveBadge: { backgroundColor: "#F4433622", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: "#F4433644" },
  inactiveBadgeText: { fontSize: 11, color: "#F44336", fontWeight: "600" },
  editBtn: { padding: 6 },
  barberChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: "#141414", borderWidth: 1, borderColor: "#2A2A2A" },
  barberChipActive: { backgroundColor: "#C9A84C22", borderColor: "#C9A84C" },
  barberChipText: { fontSize: 13, color: "#888880", fontWeight: "600" },
  barberChipTextActive: { color: "#C9A84C" },
  dayCard: { backgroundColor: "#141414", borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: "#2A2A2A" },
  dayLeft: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dayName: { fontSize: 15, fontWeight: "600", color: "#F5F5F0", flex: 1 },
  dayHours: { fontSize: 12, color: "#888880", marginTop: 2 },
  timeRow: { flexDirection: "row", alignItems: "center", marginTop: 10, gap: 8 },
  timeBtn: { flex: 1, backgroundColor: "#1A1A1A", borderWidth: 1, borderColor: "#C9A84C", borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, alignItems: "center" },
  timeBtnLabel: { fontSize: 10, color: "#888880", fontWeight: "600", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 2 },
  timeBtnValue: { fontSize: 20, fontWeight: "700", color: "#C9A84C", letterSpacing: 1 },
  timeSep: { fontSize: 18, color: "#555", fontWeight: "300" },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: "#000000AA", justifyContent: "flex-end" },
  modalCard: { backgroundColor: "#141414", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: "90%", borderWidth: 1, borderColor: "#2A2A2A" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: "700", color: "#F5F5F0" },
  roleRow: { flexDirection: "row", gap: 8, marginBottom: 16, flexWrap: "wrap" },
  roleChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: "#1E1E1E", borderWidth: 1, borderColor: "#2A2A2A" },
  roleChipActive: { backgroundColor: "#C9A84C22", borderColor: "#C9A84C" },
  roleChipText: { fontSize: 13, color: "#888880", fontWeight: "600" },
  roleChipTextActive: { color: "#C9A84C" },
  // Google Places suggestions
  suggestionBox: { backgroundColor: "#1A1A1A", borderWidth: 1, borderColor: "#2A2A2A", borderRadius: 10, marginTop: 4, overflow: "hidden", zIndex: 100 },
  suggestionItem: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#2A2A2A" },
  suggestionText: { flex: 1, fontSize: 13, color: "#F5F5F0", lineHeight: 18 },
});
