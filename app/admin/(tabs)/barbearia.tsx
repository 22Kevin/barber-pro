import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { SortableGallery } from "@/components/sortable-gallery";
import { TimePickerModal } from "@/components/time-picker-modal";
import { AdminHeader } from "@/components/admin-header";
import { applyDocumentMask, applyCepMask, applyPhoneMask, stripMask, validateDocument } from "@/hooks/use-mask";
import {} from "react-native-safe-area-context";
import { useTabBarHeight } from "@/hooks/use-tab-bar-height";

type BarbeariaTab = "dados" | "equipe" | "horarios" | "integracoes";

const GOOGLE_MAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const ROLES = [
  { key: "super_admin", label: "Super Admin" },
  { key: "barber", label: "Barbeiro" },
  { key: "receptionist", label: "Recepcionista" },
];

export default function BarbeariaScreen() {
  const tabBarHeight = useTabBarHeight();
  const { barber } = useBarberAuth();
  const [activeTab, setActiveTab] = useState<BarbeariaTab>("dados");
  const [showBarberModal, setShowBarberModal] = useState(false);
  const [editingBarber, setEditingBarber] = useState<any>(null);
  const [selectedBarberId, setSelectedBarberId] = useState<number | null>(null);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Dados da barbearia
  const [shopName, setShopName] = useState("");
  const [shopAddress, setShopAddress] = useState("");
  const [shopPhone, setShopPhone] = useState("");
  const handleShopPhoneChange = (t: string) => setShopPhone(applyPhoneMask(t));
  const [shopWhatsapp, setShopWhatsapp] = useState("");
  const handleShopWhatsappChange = (t: string) => setShopWhatsapp(applyPhoneMask(t));
  const [shopInstagram, setShopInstagram] = useState("");
  const [shopCnpj, setShopCnpj] = useState("");
  const [cnpjError, setCnpjError] = useState<string | null>(null);
  const handleCnpjChange = (t: string) => {
    const masked = applyDocumentMask(t);
    setShopCnpj(masked);
    const result = validateDocument(masked);
    if (result === false) {
      const digits = masked.replace(/\D/g, "");
      setCnpjError(digits.length === 11 ? "CPF inválido" : "CNPJ inválido");
    } else {
      setCnpjError(null);
    }
  };
  const [shopGoogleMapsUrl, setShopGoogleMapsUrl] = useState("");
  const [shopLogoUrl, setShopLogoUrl] = useState<string | null>(null);
  const [shopGallery, setShopGallery] = useState<string[]>([]);

  // CEP
  const [shopCep, setShopCep] = useState("");
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);
  const [shopAddressNumber, setShopAddressNumber] = useState("");
  const [shopAddressComplement, setShopAddressComplement] = useState("");
  const [cepFilled, setCepFilled] = useState(false);
  const numberInputRef = useRef<any>(null);

  async function handleCepChange(raw: string) {
    const masked = applyCepMask(raw);
    setShopCep(masked);
    setCepError(null);
    setCepFilled(false);
    const digits = masked.replace(/\D/g, "");
    if (digits.length === 8) {
      setCepLoading(true);
      try {
        const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
        const data = await res.json();
        if (data.erro) {
          setCepError("CEP não encontrado");
        } else {
          const street = data.logradouro ? `${data.logradouro}, ` : "";
          const baseAddress = `${street}${data.bairro} — ${data.localidade}/${data.uf}`;
          setShopAddress(baseAddress);
          setAddressSuggestions([]);
          setShowSuggestions(false);
          setCepFilled(true);
          // Foca no campo Número após preencher o endereço
          setTimeout(() => numberInputRef.current?.focus(), 300);
        }
      } catch {
        setCepError("Erro ao buscar CEP");
      } finally {
        setCepLoading(false);
      }
    }
  }

  // Monta endereço completo com número e complemento
  function buildFullAddress(): string {
    let addr = shopAddress.trim();
    if (shopAddressNumber.trim()) {
      // Insere o número após a vírgula do logradouro (ex: "Rua X, 123 — Bairro")
      const commaIdx = addr.indexOf(",");
      if (commaIdx !== -1) {
        addr = addr.slice(0, commaIdx) + ", " + shopAddressNumber.trim() + addr.slice(commaIdx + 1);
      } else {
        addr = addr + ", " + shopAddressNumber.trim();
      }
    }
    if (shopAddressComplement.trim()) {
      addr = addr + " (" + shopAddressComplement.trim() + ")";
    }
    return addr;
  }

  // Integrações
  const [shopPixKey, setShopPixKey] = useState("");
  const [mpAccessToken, setMpAccessToken] = useState("");
  const [mpPublicKey, setMpPublicKey] = useState("");

  // Google Places
  const [addressSuggestions, setAddressSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [addressSearchTimeout, setAddressSearchTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);

  // Equipe
  const [bName, setBName] = useState("");
  const [bEmail, setBEmail] = useState("");
  const [bPhone, setBPhone] = useState("");
  const handleBPhoneChange = (t: string) => setBPhone(applyPhoneMask(t));
  const [bPassword, setBPassword] = useState("");
  const [bRole, setBRole] = useState("barber");
  const [bSpecialties, setBSpecialties] = useState("");

  // Horários
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timePickerTarget, setTimePickerTarget] = useState<{ dayOfWeek: number; field: "start" | "end" | "lunchStart" | "lunchEnd"; existing: any } | null>(null);

  const utils = trpc.useUtils();
  const settingsQuery = trpc.settings.get.useQuery();

  if (settingsQuery.data && !dataLoaded) {
    const d = settingsQuery.data as any;
    setShopName(d.shopName ?? "");
    setShopAddress(d.address ?? "");
    setShopCep(applyCepMask(d.cep ?? ""));
    setShopAddressNumber(d.addressNumber ?? "");
    setShopAddressComplement(d.addressComplement ?? "");
    if (d.cep) setCepFilled(true);
    setShopPhone(applyPhoneMask(d.phone ?? ""));
    setShopWhatsapp(applyPhoneMask(d.whatsapp ?? ""));
    setMpAccessToken(d.mercadoPagoAccessToken ?? "");
    setMpPublicKey(d.mercadoPagoPublicKey ?? "");
    setShopInstagram(d.instagram ?? "");
    setShopCnpj(applyDocumentMask(d.cnpj ?? ""));
    setShopGoogleMapsUrl(d.googleMapsUrl ?? "");
    setShopPixKey(d.pixKey ?? "");
    if (d.logoUrl) setShopLogoUrl(d.logoUrl);
    if (d.galleryUrls) {
      try { setShopGallery(JSON.parse(d.galleryUrls)); } catch {}
    }
    setDataLoaded(true);
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
        if (data.predictions) { setAddressSuggestions(data.predictions); setShowSuggestions(true); }
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
    onSuccess: () => { utils.settings.get.invalidate(); Alert.alert("Sucesso", "Dados salvos com sucesso!"); },
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

  const deleteBarberMutation = trpc.barbers.delete.useMutation({
    onSuccess: () => utils.barbers.list.invalidate(),
    onError: (e: any) => Alert.alert("Erro", e.message),
  });
  const upsertHoursMutation = trpc.barbers.workingHours.upsert.useMutation({
    onSuccess: () => utils.barbers.workingHours.get.invalidate(),
  });
  function handleDeleteBarber(b: any) {
    if (b.role === "super_admin") {
      Alert.alert("Não permitido", "Não é possível excluir o Super Admin.");
      return;
    }
    Alert.alert(
      "Excluir usuário",
      `Tem certeza que deseja excluir "${b.name}"? Esta ação desativará o acesso deste usuário.`,
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Excluir", style: "destructive", onPress: () => deleteBarberMutation.mutate({ id: b.id }) },
      ]
    );
  }

  function openCreateBarber() {
    setEditingBarber(null);
    setBName(""); setBEmail(""); setBPhone(""); setBPassword(""); setBRole("barber"); setBSpecialties("");
    setShowBarberModal(true);
  }

  function openEditBarber(b: any) {
    setEditingBarber(b);
    setBName(b.name); setBEmail(b.email ?? ""); setBPhone(applyPhoneMask(b.phone ?? "")); setBPassword(""); setBRole(b.role); setBSpecialties(b.specialties ?? "");
    setShowBarberModal(true);
  }

  function closeBarberModal() { setShowBarberModal(false); setEditingBarber(null); }

  function handleSaveBarber() {
    if (!bName.trim()) { Alert.alert("Atenção", "Informe o nome."); return; }
    if (!editingBarber && (!bPassword || bPassword.length < 6)) { Alert.alert("Atenção", "Senha deve ter pelo menos 6 caracteres."); return; }
    if (editingBarber) {
      const data: any = { id: editingBarber.id, name: bName.trim(), role: bRole as any };
      if (bEmail) data.email = bEmail.trim();
      if (bPhone) data.phone = stripMask(bPhone).trim();
      if (bSpecialties) data.specialties = bSpecialties.trim();
      if (bPassword && bPassword.length >= 6) data.password = bPassword;
      updateBarberMutation.mutate(data);
    } else {
      createBarberMutation.mutate({ name: bName.trim(), email: bEmail.trim() || undefined, phone: stripMask(bPhone).trim() || undefined, password: bPassword, role: bRole as any, specialties: bSpecialties.trim() || undefined });
    }
  }

  function handleSaveDados() {
    updateSettingsMutation.mutate({
      shopName: shopName.trim() || undefined,
      address: buildFullAddress() || null,
      cep: stripMask(shopCep).trim() || null,
      addressNumber: shopAddressNumber.trim() || null,
      addressComplement: shopAddressComplement.trim() || null,
      phone: stripMask(shopPhone).trim() || null,
      whatsapp: stripMask(shopWhatsapp).trim() || null,
      instagram: shopInstagram.trim() || null,
      cnpj: stripMask(shopCnpj).trim() || null,
      googleMapsUrl: shopGoogleMapsUrl.trim() || null,
      logoUrl: shopLogoUrl || null,
      galleryUrls: shopGallery.length > 0 ? JSON.stringify(shopGallery) : null,
    } as any);
  }

  function handleSaveIntegracoes() {
    updateSettingsMutation.mutate({
      pixKey: shopPixKey.trim() || null,
      mercadoPagoAccessToken: mpAccessToken.trim() || null,
      mercadoPagoPublicKey: mpPublicKey.trim() || null,
    } as any);
  }

  function handleToggleDay(dayOfWeek: number, isWorking: boolean, existing: any) {
    if (!selectedBarberId) return;
    upsertHoursMutation.mutate({
      barberId: selectedBarberId, dayOfWeek, isWorking,
      startTime: existing?.startTime ?? "09:00",
      endTime: existing?.endTime ?? "18:00",
      lunchStart: existing?.lunchStart ?? null,
      lunchEnd: existing?.lunchEnd ?? null,
    });
  }

  function openTimePicker(dayOfWeek: number, field: "start" | "end" | "lunchStart" | "lunchEnd", existing: any) {
    setTimePickerTarget({ dayOfWeek, field, existing });
    setShowTimePicker(true);
  }

  function handleTimeConfirm(time: string) {
    if (!timePickerTarget || !selectedBarberId) return;
    const { dayOfWeek, field, existing } = timePickerTarget;
    upsertHoursMutation.mutate({
      barberId: selectedBarberId, dayOfWeek,
      isWorking: existing?.isWorking ?? true,
      startTime: field === "start" ? time : (existing?.startTime ?? "09:00"),
      endTime: field === "end" ? time : (existing?.endTime ?? "18:00"),
      lunchStart: field === "lunchStart" ? time : (existing?.lunchStart ?? null),
      lunchEnd: field === "lunchEnd" ? time : (existing?.lunchEnd ?? null),
    });
    setShowTimePicker(false);
    setTimePickerTarget(null);
  }

  function handleRemoveLunch(dayOfWeek: number, existing: any) {
    if (!selectedBarberId) return;
    upsertHoursMutation.mutate({
      barberId: selectedBarberId, dayOfWeek,
      isWorking: existing?.isWorking ?? true,
      startTime: existing?.startTime ?? "09:00",
      endTime: existing?.endTime ?? "18:00",
      lunchStart: null,
      lunchEnd: null,
    });
  }

  const barbers = (barbersQuery.data ?? []) as any[];
  const hours = (workingHoursQuery.data ?? []) as any[];
  const isSuperAdmin = barber?.role === "super_admin";

  const TABS: { key: BarbeariaTab; label: string; icon: string }[] = [
    { key: "dados", label: "Dados", icon: "building.2.fill" },
    { key: "equipe", label: "Equipe", icon: "person.2.fill" },
    { key: "horarios", label: "Horários", icon: "clock.fill" },
    { key: "integracoes", label: "Integrações", icon: "link" },
  ];

  return (
    <ScreenContainer containerClassName="bg-background" edges={["top"]}>
      <AdminHeader
        title="Barbearia"
        rightElement={
          activeTab === "equipe" && isSuperAdmin ? (
            <Pressable style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.8 }]} onPress={openCreateBarber}>
              <IconSymbol name="plus" size={18} color="#0A0A0A" />
              <Text style={styles.addBtnText}>Membro</Text>
            </Pressable>
          ) : <View style={{ width: 40 }} />
        }
      />

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll} contentContainerStyle={styles.tabsContent}>
        {TABS.map(tab => (
          <Pressable key={tab.key} style={[styles.tab, activeTab === tab.key && styles.tabActive]} onPress={() => setActiveTab(tab.key)}>
            <IconSymbol name={tab.icon as any} size={14} color={activeTab === tab.key ? "#0A0A0A" : "#888880"} />
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: tabBarHeight }} keyboardShouldPersistTaps="handled">

        {/* ── ABA DADOS ── */}
        {activeTab === "dados" && (
          <>
            <Text style={styles.sectionTitle}>Identidade Visual</Text>
            <View style={{ flexDirection: "row", gap: 16, marginBottom: 20, alignItems: "flex-start" }}>
              <View style={{ alignItems: "center", gap: 6 }}>
                <SingleImageUploader
                  value={shopLogoUrl}
                  onUpload={(url) => {
                    setShopLogoUrl(url);
                    // Salva automaticamente o logo no banco após o upload
                    updateSettingsMutation.mutate({ logoUrl: url } as any);
                  }}
                  imageType="logo"
                  label="Logo"
                  size={90}
                />
                <Text style={{ color: "#888880", fontSize: 11 }}>Logo</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.fieldLabel, { marginBottom: 4 }]}>Fotos do Ambiente</Text>
                <Text style={{ color: "#555", fontSize: 11, marginBottom: 8 }}>Pressione e segure para reordenar</Text>
                <SortableGallery
                  images={shopGallery}
                  onChange={(newGallery) => {
                    setShopGallery(newGallery);
                    // Salva automaticamente a galeria no banco após mudanças
                    updateSettingsMutation.mutate({
                      galleryUrls: newGallery.length > 0 ? JSON.stringify(newGallery) : null,
                    } as any);
                  }}
                  maxImages={8}
                />
              </View>
            </View>

            <View style={styles.divider} />
            <Text style={styles.sectionTitle}>Informações da Barbearia</Text>
            {[
              { label: "Nome da Barbearia", value: shopName, setter: setShopName, placeholder: "Barber Pro", keyboard: "default" as const },
              { label: "Telefone", value: shopPhone, setter: handleShopPhoneChange, placeholder: "(11) 3333-4444", keyboard: "phone-pad" as const },
              { label: "WhatsApp (com DDD)", value: shopWhatsapp, setter: handleShopWhatsappChange, placeholder: "(11) 99999-9999", keyboard: "phone-pad" as const },
              { label: "Instagram (usuário)", value: shopInstagram, setter: setShopInstagram, placeholder: "@barberpro", keyboard: "default" as const },
              { label: "Link do Google Maps", value: shopGoogleMapsUrl, setter: setShopGoogleMapsUrl, placeholder: "https://maps.google.com/...", keyboard: "url" as const },
            ].map(f => (
              <View key={f.label} style={{ marginBottom: 14 }}>
                <Text style={styles.fieldLabel}>{f.label}</Text>
                <TextInput style={styles.input} value={f.value} onChangeText={f.setter} placeholder={f.placeholder} placeholderTextColor="#555" keyboardType={f.keyboard} autoCapitalize={f.keyboard === "default" && f.label.includes("Instagram") ? "none" : "sentences"} autoCorrect={false} />
              </View>
            ))}

            {/* CPF / CNPJ com validação */}
            <View style={{ marginBottom: 14 }}>
              <Text style={styles.fieldLabel}>CPF / CNPJ</Text>
              <View style={{ position: "relative" }}>
                <TextInput
                  style={[styles.input, cnpjError ? { borderColor: "#EF4444" } : shopCnpj && validateDocument(shopCnpj) === true ? { borderColor: "#22C55E" } : {}]}
                  value={shopCnpj}
                  onChangeText={handleCnpjChange}
                  placeholder="000.000.000-00 ou 00.000.000/0001-00"
                  placeholderTextColor="#555"
                  keyboardType="numeric"
                  autoCorrect={false}
                />
                {shopCnpj.replace(/\D/g, "").length >= 11 && (
                  <View style={{ position: "absolute", right: 12, top: 0, bottom: 0, justifyContent: "center" }}>
                    {cnpjError ? (
                      <IconSymbol name="xmark.circle.fill" size={18} color="#EF4444" />
                    ) : validateDocument(shopCnpj) === true ? (
                      <IconSymbol name="checkmark.circle.fill" size={18} color="#22C55E" />
                    ) : null}
                  </View>
                )}
              </View>
              {cnpjError && <Text style={{ color: "#EF4444", fontSize: 12, marginTop: 4 }}>{cnpjError}</Text>}
            </View>

            {/* CEP com busca automática ViaCEP */}
            <View style={{ marginBottom: 14 }}>
              <Text style={styles.fieldLabel}>CEP</Text>
              <View style={{ position: "relative" }}>
                <TextInput
                  style={[styles.input, cepError ? { borderColor: "#EF4444" } : {}]}
                  value={shopCep}
                  onChangeText={handleCepChange}
                  placeholder="00000-000"
                  placeholderTextColor="#555"
                  keyboardType="numeric"
                  maxLength={9}
                  returnKeyType="done"
                />
                {cepLoading && (
                  <View style={{ position: "absolute", right: 12, top: 0, bottom: 0, justifyContent: "center" }}>
                    <ActivityIndicator size="small" color="#C9A84C" />
                  </View>
                )}
              </View>
              {cepError ? (
                <Text style={{ color: "#EF4444", fontSize: 12, marginTop: 4 }}>{cepError}</Text>
              ) : shopCep.replace(/\D/g, "").length === 8 && !cepLoading ? (
                <Text style={{ color: "#22C55E", fontSize: 12, marginTop: 4 }}>✓ Endereço preenchido automaticamente</Text>
              ) : (
                <Text style={{ color: "#555", fontSize: 12, marginTop: 4 }}>Digite o CEP para preencher o endereço automaticamente</Text>
              )}
            </View>

            {/* Número e Complemento (aparecem após CEP preenchido) */}
            {cepFilled && (
              <View style={{ flexDirection: "row", gap: 10, marginBottom: 14 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Número</Text>
                  <TextInput
                    ref={numberInputRef}
                    style={styles.input}
                    value={shopAddressNumber}
                    onChangeText={setShopAddressNumber}
                    placeholder="123"
                    placeholderTextColor="#555"
                    keyboardType="numeric"
                    returnKeyType="next"
                  />
                </View>
                <View style={{ flex: 2 }}>
                  <Text style={styles.fieldLabel}>Complemento</Text>
                  <TextInput
                    style={styles.input}
                    value={shopAddressComplement}
                    onChangeText={setShopAddressComplement}
                    placeholder="Sala 2, Andar 3..."
                    placeholderTextColor="#555"
                    returnKeyType="done"
                  />
                </View>
              </View>
            )}

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

            <Pressable style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.8 }]} onPress={handleSaveDados} disabled={updateSettingsMutation.isPending}>
              {updateSettingsMutation.isPending ? <ActivityIndicator color="#0A0A0A" /> : <Text style={styles.saveBtnText}>SALVAR DADOS</Text>}
            </Pressable>
          </>
        )}

        {/* ── ABA EQUIPE ── */}
        {activeTab === "equipe" && (
          <>
            {barbersQuery.isLoading ? (
              <ActivityIndicator color="#C9A84C" style={{ marginTop: 40 }} />
            ) : barbers.length === 0 ? (
              <View style={styles.emptyCard}>
                <IconSymbol name="person.2.fill" size={40} color="#2A2A2A" />
                <Text style={styles.emptyText}>Nenhum membro cadastrado</Text>
                <Text style={styles.emptySubtext}>Toque em "+ Membro" para adicionar</Text>
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
                    {b.specialties ? <Text style={styles.barberSpecialties}>{b.specialties}</Text> : null}
                  </View>
                  <View style={styles.barberActions}>
                    {!b.isActive && <View style={styles.inactiveBadge}><Text style={styles.inactiveBadgeText}>Inativo</Text></View>}
                    {isSuperAdmin && (
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        <Pressable onPress={() => openEditBarber(b)} style={({ pressed }) => [styles.editBtn, pressed && { opacity: 0.6 }]}>
                          <IconSymbol name="pencil" size={16} color="#C9A84C" />
                        </Pressable>
                        {b.role !== "super_admin" && (
                          <Pressable
                            onPress={() => handleDeleteBarber(b)}
                            style={({ pressed }) => [styles.editBtn, { borderColor: "#F4433644", backgroundColor: "#F4433611" }, pressed && { opacity: 0.6 }]}
                            disabled={deleteBarberMutation.isPending}
                          >
                            <IconSymbol name="trash" size={16} color="#F44336" />
                          </Pressable>
                        )}
                      </View>
                    )}
                  </View>
                </View>
              ))
            )}
          </>
        )}

        {/* ── ABA HORÁRIOS ── */}
        {activeTab === "horarios" && (
          <>
            <Text style={styles.sectionTitle}>Selecione o Membro</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {barbers.map((b: any) => (
                  <Pressable key={b.id} style={[styles.barberChip, selectedBarberId === b.id && styles.barberChipActive]} onPress={() => setSelectedBarberId(b.id)}>
                    <Text style={[styles.barberChipText, selectedBarberId === b.id && styles.barberChipTextActive]}>{b.name}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            {!selectedBarberId ? (
              <View style={styles.emptyCard}>
                <IconSymbol name="clock.fill" size={40} color="#2A2A2A" />
                <Text style={styles.emptyText}>Selecione um membro</Text>
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
                        <>
                          {/* Entrada / Saída principal */}
                          <View style={styles.timeRow}>
                            <Pressable style={styles.timeBtn} onPress={() => openTimePicker(idx, "start", existing)}>
                              <Text style={styles.timeBtnLabel}>Entrada</Text>
                              <Text style={styles.timeBtnValue}>{existing?.startTime ?? "09:00"}</Text>
                            </Pressable>
                            <Text style={styles.timeSep}>→</Text>
                            <Pressable style={styles.timeBtn} onPress={() => openTimePicker(idx, "end", existing)}>
                              <Text style={styles.timeBtnLabel}>Saída</Text>
                              <Text style={styles.timeBtnValue}>{existing?.endTime ?? "18:00"}</Text>
                            </Pressable>
                          </View>

                          {/* Intervalo de almoço */}
                          {existing?.lunchStart && existing?.lunchEnd ? (
                            <View style={[styles.timeRow, { marginTop: 6 }]}>
                              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, flex: 1 }}>
                                <IconSymbol name="fork.knife" size={12} color="#888880" />
                                <Text style={{ color: "#888880", fontSize: 11 }}>Almoço</Text>
                              </View>
                              <Pressable style={[styles.timeBtn, { backgroundColor: "#1A1A1A" }]} onPress={() => openTimePicker(idx, "lunchStart", existing)}>
                                <Text style={styles.timeBtnLabel}>Início</Text>
                                <Text style={styles.timeBtnValue}>{existing.lunchStart}</Text>
                              </Pressable>
                              <Text style={styles.timeSep}>→</Text>
                              <Pressable style={[styles.timeBtn, { backgroundColor: "#1A1A1A" }]} onPress={() => openTimePicker(idx, "lunchEnd", existing)}>
                                <Text style={styles.timeBtnLabel}>Fim</Text>
                                <Text style={styles.timeBtnValue}>{existing.lunchEnd}</Text>
                              </Pressable>
                              <Pressable
                                style={{ padding: 6, marginLeft: 4 }}
                                onPress={() => handleRemoveLunch(idx, existing)}
                              >
                                <IconSymbol name="xmark" size={12} color="#EF4444" />
                              </Pressable>
                            </View>
                          ) : (
                            <Pressable
                              style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: "#2A2A2A", borderStyle: "dashed", alignSelf: "flex-start" }}
                              onPress={() => {
                                // Define almoço padrão 12:00-13:00 e abre o picker para ajustar
                                upsertHoursMutation.mutate({
                                  barberId: selectedBarberId!, dayOfWeek: idx,
                                  isWorking: true,
                                  startTime: existing?.startTime ?? "09:00",
                                  endTime: existing?.endTime ?? "18:00",
                                  lunchStart: "12:00",
                                  lunchEnd: "13:00",
                                });
                              }}
                            >
                              <IconSymbol name="plus" size={12} color="#C9A84C" />
                              <Text style={{ color: "#C9A84C", fontSize: 11, fontWeight: "600" }}>Intervalo de almoço</Text>
                            </Pressable>
                          )}
                        </>
                      )}
                    </View>
                  </View>
                );
              })
            )}
          </>
        )}

        {/* ── ABA INTEGRAÇÕES ── */}
        {activeTab === "integracoes" && (
          <>
            <View style={styles.integrationCard}>
              <View style={styles.integrationHeader}>
                <View style={[styles.integrationIcon, { backgroundColor: "#32BCAD22" }]}>
                  <Text style={{ fontSize: 20 }}>Pix</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.integrationTitle}>Pagamento Pix</Text>
                  <Text style={styles.integrationSubtitle}>Chave para geração de QR Code</Text>
                </View>
              </View>
              <View style={styles.infoCard}>
                <IconSymbol name="info.circle.fill" size={16} color="#32BCAD" />
                <Text style={styles.infoText}>Informe a chave Pix da barbearia (CNPJ, CPF, e-mail ou telefone). Ela será usada para gerar o QR Code de pagamento.</Text>
              </View>
              <Text style={styles.fieldLabel}>Chave Pix</Text>
              <TextInput style={styles.input} value={shopPixKey} onChangeText={setShopPixKey} placeholder="00.000.000/0001-00 ou email@barbearia.com" placeholderTextColor="#555" autoCapitalize="none" autoCorrect={false} />
            </View>

            <View style={styles.divider} />

            <View style={styles.integrationCard}>
              <View style={styles.integrationHeader}>
                <View style={[styles.integrationIcon, { backgroundColor: "#009EE322" }]}>
                  <Text style={{ fontSize: 18, fontWeight: "800", color: "#009EE3" }}>MP</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.integrationTitle}>Mercado Pago</Text>
                  <Text style={styles.integrationSubtitle}>Checkout Pro e pagamentos online</Text>
                </View>
              </View>
              <View style={styles.infoCard}>
                <IconSymbol name="info.circle.fill" size={16} color="#2196F3" />
                <Text style={styles.infoText}>Acesse o Painel do Mercado Pago → Configurações → Credenciais para obter suas chaves.</Text>
              </View>
              {[
                { label: "Access Token", value: mpAccessToken, setter: setMpAccessToken, placeholder: "APP_USR-...", secure: true },
                { label: "Public Key", value: mpPublicKey, setter: setMpPublicKey, placeholder: "APP_USR-...", secure: false },
              ].map(f => (
                <View key={f.label} style={{ marginBottom: 14 }}>
                  <Text style={styles.fieldLabel}>{f.label}</Text>
                  <TextInput style={styles.input} value={f.value} onChangeText={f.setter} placeholder={f.placeholder} placeholderTextColor="#555" secureTextEntry={f.secure} autoCapitalize="none" autoCorrect={false} />
                </View>
              ))}
            </View>

            <Pressable style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.8 }]} onPress={handleSaveIntegracoes} disabled={updateSettingsMutation.isPending}>
              {updateSettingsMutation.isPending ? <ActivityIndicator color="#0A0A0A" /> : <Text style={styles.saveBtnText}>SALVAR INTEGRAÇÕES</Text>}
            </Pressable>
          </>
        )}
      </ScrollView>

      {/* Time Picker */}
      <TimePickerModal
        visible={showTimePicker}
        title={timePickerTarget?.field === "start" ? "Horário de Entrada" : "Horário de Saída"}
        value={timePickerTarget?.field === "start" ? (timePickerTarget?.existing?.startTime ?? "09:00") : (timePickerTarget?.existing?.endTime ?? "18:00")}
        onConfirm={handleTimeConfirm}
        onCancel={() => { setShowTimePicker(false); setTimePickerTarget(null); }}
      />

      {/* Modal Membro */}
      <Modal visible={showBarberModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ width: "100%" }}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{editingBarber ? "Editar Membro" : "Novo Membro"}</Text>
                <Pressable onPress={closeBarberModal}><IconSymbol name="xmark" size={22} color="#888880" /></Pressable>
              </View>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {[
                  { label: "Nome *", value: bName, setter: setBName, placeholder: "João Barbeiro", keyboard: "default" as const },
                  { label: "E-mail", value: bEmail, setter: setBEmail, placeholder: "joao@email.com", keyboard: "email-address" as const },
                  { label: "Telefone", value: bPhone, setter: handleBPhoneChange, placeholder: "(11) 99999-9999", keyboard: "phone-pad" as const },
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
  addBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "#C9A84C", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, gap: 6 },
  addBtnText: { color: "#0A0A0A", fontWeight: "700", fontSize: 14 },
  tabsScroll: { flexGrow: 0, marginBottom: 4 },
  tabsContent: { gap: 8, paddingVertical: 8, paddingHorizontal: 16 },
  tab: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: "#141414", borderWidth: 1, borderColor: "#2A2A2A" },
  tabActive: { backgroundColor: "#C9A84C", borderColor: "#C9A84C" },
  tabText: { fontSize: 13, color: "#888880", fontWeight: "600" },
  tabTextActive: { color: "#0A0A0A" },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#F5F5F0", marginBottom: 12 },
  fieldLabel: { fontSize: 13, color: "#888880", marginBottom: 6, fontWeight: "500" },
  input: { backgroundColor: "#141414", borderWidth: 1, borderColor: "#2A2A2A", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: "#F5F5F0" },
  divider: { height: 1, backgroundColor: "#2A2A2A", marginVertical: 20 },
  infoCard: { flexDirection: "row", gap: 8, backgroundColor: "#2196F322", borderRadius: 10, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: "#2196F344", alignItems: "flex-start" },
  infoText: { flex: 1, fontSize: 12, color: "#2196F3", lineHeight: 17 },
  saveBtn: { backgroundColor: "#C9A84C", borderRadius: 12, paddingVertical: 15, alignItems: "center", marginTop: 8 },
  saveBtnText: { color: "#0A0A0A", fontSize: 15, fontWeight: "800", letterSpacing: 1 },
  emptyCard: { alignItems: "center", paddingVertical: 60, gap: 10 },
  emptyText: { color: "#888880", fontSize: 16, fontWeight: "600" },
  emptySubtext: { color: "#555", fontSize: 13 },
  barberCard: { backgroundColor: "#141414", borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "#2A2A2A", flexDirection: "row", alignItems: "center", gap: 12 },
  barberAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#C9A84C22", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#C9A84C44" },
  barberAvatarText: { color: "#C9A84C", fontSize: 20, fontWeight: "700" },
  barberName: { fontSize: 15, fontWeight: "700", color: "#F5F5F0" },
  barberRole: { fontSize: 12, color: "#C9A84C", marginTop: 2 },
  barberEmail: { fontSize: 12, color: "#888880", marginTop: 2 },
  barberSpecialties: { fontSize: 11, color: "#555", marginTop: 2 },
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
  timeRow: { flexDirection: "row", alignItems: "center", marginTop: 10, gap: 8 },
  timeBtn: { flex: 1, backgroundColor: "#1A1A1A", borderWidth: 1, borderColor: "#C9A84C", borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, alignItems: "center" },
  timeBtnLabel: { fontSize: 10, color: "#888880", fontWeight: "600", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 2 },
  timeBtnValue: { fontSize: 20, fontWeight: "700", color: "#C9A84C", letterSpacing: 1 },
  timeSep: { fontSize: 18, color: "#555", fontWeight: "300" },
  integrationCard: { backgroundColor: "#141414", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: "#2A2A2A", marginBottom: 4 },
  integrationHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  integrationIcon: { width: 48, height: 48, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  integrationTitle: { fontSize: 16, fontWeight: "700", color: "#F5F5F0" },
  integrationSubtitle: { fontSize: 12, color: "#888880", marginTop: 2 },
  modalOverlay: { flex: 1, backgroundColor: "#000000AA", justifyContent: "flex-end" },
  modalCard: { backgroundColor: "#141414", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: "90%", borderWidth: 1, borderColor: "#2A2A2A" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: "700", color: "#F5F5F0" },
  roleRow: { flexDirection: "row", gap: 8, marginBottom: 16, flexWrap: "wrap" },
  roleChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: "#1E1E1E", borderWidth: 1, borderColor: "#2A2A2A" },
  roleChipActive: { backgroundColor: "#C9A84C22", borderColor: "#C9A84C" },
  roleChipText: { fontSize: 13, color: "#888880", fontWeight: "600" },
  roleChipTextActive: { color: "#C9A84C" },
  suggestionBox: { backgroundColor: "#1A1A1A", borderWidth: 1, borderColor: "#2A2A2A", borderRadius: 10, marginTop: 4, overflow: "hidden", zIndex: 100 },
  suggestionItem: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#2A2A2A" },
  suggestionText: { flex: 1, fontSize: 13, color: "#F5F5F0", lineHeight: 18 },
});
