import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { applyPhoneMask, stripMask } from "@/hooks/use-mask";
import { ScreenContainer } from "@/components/screen-container";
import { DatePickerModal } from "@/components/date-picker-modal";
import { useClientAuth } from "@/lib/client-auth-context";
import { useThemeContext } from "@/lib/theme-provider";
import { useTabBarHeight } from "@/hooks/use-tab-bar-height";
import { trpc } from "@/lib/trpc";

type ProfileTab = "points" | "coupons" | "settings";
type ThemeOption = "light" | "dark" | "system";

function formatBirthDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}
function isBirthdayThisMonth(birthDate: string | null | undefined): boolean {
  if (!birthDate) return false;
  return parseInt(birthDate.split("-")[1], 10) === new Date().getMonth() + 1;
}
function isBirthdayToday(birthDate: string | null | undefined): boolean {
  if (!birthDate) return false;
  const today = new Date();
  const parts = birthDate.split("-");
  return parseInt(parts[1], 10) === today.getMonth() + 1 && parseInt(parts[2], 10) === today.getDate();
}

// ─── Aba Pontos ───────────────────────────────────────────────────────────────
function PointsTab({ clientId }: { clientId: number }) {
  const tabBarHeight = useTabBarHeight();
  const pointsHistory = trpc.pointsHistory.byClient.useQuery({ clientId });
  const rewardsQuery = trpc.loyalty.rewards.list.useQuery();
  const configQuery = trpc.loyalty.getConfig.useQuery();
  const { client } = useClientAuth();

  const typeColors: Record<string, string> = {
    earned: "#22C55E", redeemed: "#EF4444", expired: "#6B7280", adjusted: "#3B82F6",
  };
  const typeLabels: Record<string, string> = {
    earned: "+", redeemed: "-", expired: "-", adjusted: "±",
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: tabBarHeight + 24 }}>
      {/* Saldo de pontos */}
      <View style={styles.pointsCard}>
        <Text style={styles.pointsLabel}>Seus pontos</Text>
        <Text style={styles.pointsValue}>{client?.totalPoints ?? 0}</Text>
        <Text style={styles.pointsSubLabel}>pontos acumulados</Text>
        {configQuery.data?.isActive && (
          <Text style={styles.pointsHint}>
            Ganhe {configQuery.data.pointsPerService} pontos por serviço
          </Text>
        )}
      </View>

      {/* Recompensas */}
      {rewardsQuery.data && rewardsQuery.data.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recompensas disponíveis</Text>
          {rewardsQuery.data.map((reward: any) => {
            const canRedeem = (client?.totalPoints ?? 0) >= reward.pointsRequired;
            return (
              <View key={reward.id} style={[styles.rewardCard, canRedeem && styles.rewardCardActive]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rewardName}>{reward.name}</Text>
                  {reward.description ? <Text style={styles.rewardDesc}>{reward.description}</Text> : null}
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={[styles.rewardPts, { color: canRedeem ? "#EAB308" : "#6B7280" }]}>
                    {reward.pointsRequired} pts
                  </Text>
                  {canRedeem && <Text style={styles.rewardAvail}>Disponível!</Text>}
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Histórico de pontos */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Histórico de pontos</Text>
        {pointsHistory.isLoading ? (
          <Text style={styles.mutedText}>Carregando...</Text>
        ) : !pointsHistory.data || pointsHistory.data.length === 0 ? (
          <Text style={[styles.mutedText, { textAlign: "center", paddingVertical: 20 }]}>
            Nenhuma movimentação ainda
          </Text>
        ) : (
          pointsHistory.data.map((entry: any) => (
            <View key={entry.id} style={styles.historyRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.historyDesc}>{entry.description ?? "Pontos"}</Text>
                <Text style={styles.historyDate}>{new Date(entry.createdAt).toLocaleDateString("pt-BR")}</Text>
              </View>
              <Text style={[styles.historyPoints, { color: typeColors[entry.type] ?? "#fff" }]}>
                {typeLabels[entry.type]}{Math.abs(entry.points)}
              </Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

// ─── Aba Cupons ───────────────────────────────────────────────────────────────
function CouponsTab({ clientBirthDate }: { clientBirthDate?: string | null }) {
  const tabBarHeight = useTabBarHeight();
  const couponsQuery = trpc.coupons.list.useQuery();
  const birthdayCouponQuery = trpc.clientAuth.getBirthdayCoupon.useQuery(
    { birthDate: clientBirthDate ?? "" },
    { enabled: !!clientBirthDate }
  );
  const activeCoupons = couponsQuery.data?.filter((c: any) => c.isActive) ?? [];
  const birthdayCoupon = birthdayCouponQuery.data;
  const isThisMonth = isBirthdayThisMonth(clientBirthDate);
  const isToday = isBirthdayToday(clientBirthDate);

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: tabBarHeight + 24 }}>
      {/* Banner aniversário */}
      {clientBirthDate && isThisMonth && (
        <View style={styles.birthdayBanner}>
          <Text style={styles.birthdayTitle}>
            {isToday ? "🎂 Feliz Aniversário!" : "🎉 Mês do seu aniversário!"}
          </Text>
          <Text style={styles.birthdayText}>
            {isToday
              ? "Hoje é seu dia especial! Você tem um cupom exclusivo esperando por você."
              : "Você tem um cupom exclusivo de aniversário disponível este mês!"}
          </Text>
          {birthdayCoupon && (
            <View style={styles.couponCard}>
              <View style={styles.couponRow}>
                <Text style={styles.couponCode}>{birthdayCoupon.code}</Text>
                <View style={styles.discountBadge}>
                  <Text style={styles.discountText}>
                    {birthdayCoupon.discountType === "percent"
                      ? `${birthdayCoupon.discountValue}% OFF`
                      : `R$ ${parseFloat(birthdayCoupon.discountValue).toFixed(2)} OFF`}
                  </Text>
                </View>
              </View>
              {birthdayCoupon.description && (
                <Text style={styles.couponDesc}>{birthdayCoupon.description}</Text>
              )}
              <Text style={styles.couponValidity}>
                Válido até: {birthdayCoupon.validUntil
                  ? new Date(birthdayCoupon.validUntil + "T12:00:00").toLocaleDateString("pt-BR")
                  : "fim do mês"}
              </Text>
            </View>
          )}
        </View>
      )}

      <Text style={styles.mutedText}>Cupons disponíveis na barbearia</Text>
      <View style={{ height: 12 }} />

      {activeCoupons.length === 0 ? (
        <View style={{ alignItems: "center", paddingVertical: 40 }}>
          <Text style={{ fontSize: 44, marginBottom: 12 }}>🎟️</Text>
          <Text style={styles.mutedText}>Nenhum cupom disponível no momento</Text>
        </View>
      ) : (
        activeCoupons.map((coupon: any) => (
          <View key={coupon.id} style={[styles.couponCard, { marginBottom: 12 }]}>
            <View style={styles.couponRow}>
              <Text style={styles.couponCode}>{coupon.code}</Text>
              <View style={styles.discountBadge}>
                <Text style={styles.discountText}>
                  {coupon.discountType === "percent"
                    ? `${coupon.discountValue}% OFF`
                    : `R$ ${parseFloat(coupon.discountValue).toFixed(2)} OFF`}
                </Text>
              </View>
            </View>
            {coupon.description && <Text style={styles.couponDesc}>{coupon.description}</Text>}
            <View style={{ flexDirection: "row", gap: 16, marginTop: 8 }}>
              {coupon.validUntil && (
                <Text style={styles.couponValidity}>
                  Válido até: {new Date(coupon.validUntil + "T12:00:00").toLocaleDateString("pt-BR")}
                </Text>
              )}
              {coupon.minOrderValue && parseFloat(coupon.minOrderValue) > 0 && (
                <Text style={styles.couponValidity}>Mín: R$ {parseFloat(coupon.minOrderValue).toFixed(2)}</Text>
              )}
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

// ─── Aba Configurações ────────────────────────────────────────────────────────
function SettingsTab({ client, onUpdate }: { client: any; onUpdate: (data: any) => void }) {
  const tabBarHeight = useTabBarHeight();
  const [name, setName] = useState(client.name);
  const [phone, setPhone] = useState(applyPhoneMask(client.phone ?? ""));
  const [birthDate, setBirthDate] = useState<string | null>(client.birthDate ?? null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [themeOption, setThemeOption] = useState<ThemeOption>("system");
  const [reminderHours, setReminderHours] = useState<1 | 2 | 24>(1);
  const { setColorScheme } = useThemeContext();

  useEffect(() => {
    AsyncStorage.getItem("@theme_preference").then((saved) => {
      if (saved === "light" || saved === "dark" || saved === "system") setThemeOption(saved as ThemeOption);
    });
    AsyncStorage.getItem("@reminder_hours").then((saved) => {
      if (saved === "1" || saved === "2" || saved === "24") setReminderHours(Number(saved) as 1 | 2 | 24);
    });
  }, []);

  async function handleReminderChange(hours: 1 | 2 | 24) {
    setReminderHours(hours);
    await AsyncStorage.setItem("@reminder_hours", String(hours));
  }

  async function handleThemeChange(option: ThemeOption) {
    setThemeOption(option);
    await AsyncStorage.setItem("@theme_preference", option);
    if (option === "system") {
      const sys = require("react-native").Appearance.getColorScheme() ?? "dark";
      setColorScheme(sys as any);
    } else {
      setColorScheme(option as any);
    }
  }

  const updateMutation = trpc.clientAuth.updateProfile.useMutation({
    onSuccess: () => { onUpdate({ name, phone: stripMask(phone), birthDate }); Alert.alert("Sucesso", "Perfil atualizado!"); },
    onError: (err: any) => Alert.alert("Erro", err.message),
  });

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: tabBarHeight + 24 }}>
      {/* Aparência */}
      <Text style={styles.sectionTitle}>Aparência</Text>
      <View style={styles.themeRow}>
        {(["light", "dark", "system"] as ThemeOption[]).map((opt) => {
          const labels: Record<ThemeOption, string> = { light: "☀️ Claro", dark: "🌙 Escuro", system: "⚙️ Sistema" };
          const active = themeOption === opt;
          return (
            <TouchableOpacity
              key={opt}
              onPress={() => handleThemeChange(opt)}
              style={[styles.themeBtn, active && styles.themeBtnActive]}
              activeOpacity={0.8}
            >
              <Text style={[styles.themeBtnText, active && styles.themeBtnTextActive]}>{labels[opt]}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Notificações */}
      <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Lembrete de agendamento</Text>
      <Text style={{ color: "#6B7280", fontSize: 13, marginBottom: 10 }}>Com quanto tempo de antecedência você quer ser lembrado?</Text>
      <View style={styles.themeRow}>
        {([1, 2, 24] as (1 | 2 | 24)[]).map((h) => {
          const labels: Record<number, string> = { 1: "⏰ 1 hora", 2: "⏰ 2 horas", 24: "📅 1 dia" };
          const active = reminderHours === h;
          return (
            <TouchableOpacity
              key={h}
              onPress={() => handleReminderChange(h)}
              style={[styles.themeBtn, active && styles.themeBtnActive]}
              activeOpacity={0.8}
            >
              <Text style={[styles.themeBtnText, active && styles.themeBtnTextActive]}>{labels[h]}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Editar perfil */}
      <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Editar perfil</Text>
      <View style={styles.formGroup}>
        <Text style={styles.fieldLabel}>Nome</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          style={styles.input}
          placeholderTextColor="#4B5563"
        />
      </View>
      <View style={styles.formGroup}>
        <Text style={styles.fieldLabel}>Telefone / WhatsApp</Text>
        <TextInput
          value={phone}
          onChangeText={(t) => setPhone(applyPhoneMask(t))}
          keyboardType="phone-pad"
          style={styles.input}
          placeholderTextColor="#4B5563"
        />
      </View>
      <View style={styles.formGroup}>
        <Text style={styles.fieldLabel}>Data de Nascimento</Text>
        <TouchableOpacity
          onPress={() => setShowDatePicker(true)}
          style={[styles.input, { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }]}
          activeOpacity={0.8}
        >
          <Text style={{ color: birthDate ? "#fff" : "#4B5563", fontSize: 15 }}>
            {birthDate ? formatBirthDate(birthDate) : "Toque para selecionar"}
          </Text>
          <Text style={{ fontSize: 18 }}>🎂</Text>
        </TouchableOpacity>
        {birthDate && (
          <TouchableOpacity onPress={() => setBirthDate(null)} style={{ marginTop: 6, alignSelf: "flex-end" }}>
            <Text style={{ color: "#6B7280", fontSize: 12 }}>Remover data</Text>
          </TouchableOpacity>
        )}
        <Text style={{ color: "#6B7280", fontSize: 12, marginTop: 6 }}>
          Receba um cupom exclusivo no seu aniversário 🎉
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.saveButton, { opacity: updateMutation.isPending ? 0.7 : 1 }]}
        onPress={() => updateMutation.mutate({ clientId: client.id, name, phone: stripMask(phone), birthDate })}
        disabled={updateMutation.isPending}
        activeOpacity={0.85}
      >
        <Text style={styles.saveButtonText}>
          {updateMutation.isPending ? "Salvando..." : "Salvar alterações"}
        </Text>
      </TouchableOpacity>

      <DatePickerModal
        visible={showDatePicker}
        value={birthDate}
        onConfirm={(date) => { setBirthDate(date); setShowDatePicker(false); }}
        onCancel={() => setShowDatePicker(false)}
      />
    </ScrollView>
  );
}

// ─── Utilitário: converte URI local em base64 ────────────────────────────────
async function uriToBase64(uri: string): Promise<string> {
  const response = await fetch(uri);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Remove o prefixo "data:image/...;base64,"
      resolve(result.split(",")[1] ?? result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// ─── Tela principal ───────────────────────────────────────────────────────────
export default function ClientProfile() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { client, isAuthenticated, logout, updateClient } = useClientAuth();
  const [tab, setTab] = useState<ProfileTab>("points");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const uploadPhotoMutation = trpc.clientAuth.uploadPhoto.useMutation({
    onSuccess: (data) => {
      updateClient({ photoUrl: data.url });
      Alert.alert("Foto atualizada!", "Sua foto de perfil foi salva com sucesso.");
    },
    onError: (err: any) => Alert.alert("Erro", err.message ?? "Não foi possível salvar a foto."),
    onSettled: () => setUploadingPhoto(false),
  });

  async function handlePickProfilePhoto() {
    Alert.alert(
      "Foto de perfil",
      "Escolha de onde deseja selecionar a foto",
      [
        {
          text: "Câmera",
          onPress: async () => {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== "granted") {
              Alert.alert("Permissão necessária", "Precisamos de acesso à câmera.");
              return;
            }
            const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8 });
            if (!result.canceled && client) {
              setUploadingPhoto(true);
              const uri = result.assets[0].uri;
              const base64 = await uriToBase64(uri);
              uploadPhotoMutation.mutate({ clientId: client.id, fileBase64: base64, mimeType: result.assets[0].mimeType ?? "image/jpeg" });
            }
          },
        },
        {
          text: "Galeria",
          onPress: async () => {
            const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.8 });
            if (!result.canceled && client) {
              setUploadingPhoto(true);
              const uri = result.assets[0].uri;
              const base64 = await uriToBase64(uri);
              uploadPhotoMutation.mutate({ clientId: client.id, fileBase64: base64, mimeType: result.assets[0].mimeType ?? "image/jpeg" });
            }
          },
        },
        { text: "Cancelar", style: "cancel" },
      ]
    );
  }

  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 320, useNativeDriver: true }).start();
  }, []);

  // ── Não autenticado ──────────────────────────────────────────────────────
  if (!isAuthenticated || !client) {
    return (
      <ScreenContainer containerClassName="bg-black" edges={["left", "right"]}>
        <Animated.View style={[{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }, { opacity: fadeAnim }]}>
          <Text style={{ fontSize: 56, marginBottom: 16 }}>👤</Text>
          <Text style={styles.guestTitle}>Minha conta</Text>
          <Text style={styles.guestSubtitle}>
            Faça login para acessar seu perfil, pontos e cupons exclusivos.
          </Text>
          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => router.push("/client/login" as any)}
            activeOpacity={0.85}
          >
            <Text style={styles.loginButtonText}>Fazer login</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push("/client/register" as any)} style={{ marginTop: 14 }}>
            <Text style={{ color: "#EAB308", fontWeight: "600", fontSize: 14 }}>Criar conta gratuita</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer containerClassName="bg-black" edges={["left", "right"]}>
      <Animated.View style={[{ flex: 1 }, { opacity: fadeAnim }]}>

        {/* ── Header do perfil ────────────────────────────────────────────── */}
        <View style={[styles.profileHeader, { paddingTop: insets.top + 14 }]}>
          {/* Avatar com botão de editar foto */}
          <TouchableOpacity onPress={handlePickProfilePhoto} style={styles.avatarWrapper} activeOpacity={0.8}>
            {client.photoUrl ? (
              <Image source={{ uri: client.photoUrl }} style={styles.avatarPhoto} />
            ) : (
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarInitials}>
                  {client.name?.charAt(0).toUpperCase() ?? "?"}
                </Text>
              </View>
            )}
            <View style={styles.avatarEditBadge}>
              <Text style={{ fontSize: 10 }}>{uploadingPhoto ? "⏳" : "📷"}</Text>
            </View>
          </TouchableOpacity>

          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={styles.profileName}>{client.name}</Text>
              {isBirthdayToday(client.birthDate) && <Text style={{ fontSize: 18 }}>🎂</Text>}
            </View>
            <Text style={styles.profileEmail}>{client.email}</Text>
            {client.birthDate && (
              <Text style={styles.profileBirth}>🎂 {formatBirthDate(client.birthDate)}</Text>
            )}
          </View>

          <TouchableOpacity
            onPress={() => Alert.alert("Sair", "Deseja sair da sua conta?", [
              { text: "Cancelar" },
              { text: "Sair", style: "destructive", onPress: () => { logout(); router.replace("/client/index" as any); } },
            ])}
            style={styles.logoutBtn}
          >
            <Text style={styles.logoutText}>Sair</Text>
          </TouchableOpacity>
        </View>

        {/* Banner: adicionar data de nascimento */}
        {!client.birthDate && (
          <TouchableOpacity
            onPress={() => setTab("settings")}
            style={styles.birthdayBannerSmall}
            activeOpacity={0.8}
          >
            <Text style={{ fontSize: 20 }}>🎂</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.birthdayBannerTitle}>Adicione sua data de nascimento</Text>
              <Text style={styles.birthdayBannerSub}>Receba um cupom exclusivo no seu aniversário!</Text>
            </View>
            <Text style={{ color: "#EAB308", fontSize: 18 }}>›</Text>
          </TouchableOpacity>
        )}

        {/* ── Tabs ────────────────────────────────────────────────────────── */}
        <View style={styles.tabsWrapper}>
          <View style={styles.tabsTrack}>
            {([
              { key: "points",   label: "⭐ Pontos" },
              { key: "coupons",  label: isBirthdayThisMonth(client.birthDate) ? "🎂 Cupons" : "🎟️ Cupons" },
              { key: "settings", label: "⚙️ Perfil" },
            ] as const).map((t) => (
              <TouchableOpacity
                key={t.key}
                onPress={() => setTab(t.key)}
                style={[styles.tabBtn, tab === t.key && styles.tabBtnActive]}
                activeOpacity={0.8}
              >
                <Text style={[styles.tabBtnText, tab === t.key && styles.tabBtnTextActive]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {tab === "points"   && <PointsTab clientId={client.id} />}
        {tab === "coupons"  && <CouponsTab clientBirthDate={client.birthDate} />}
        {tab === "settings" && <SettingsTab client={client} onUpdate={(data) => updateClient(data)} />}
      </Animated.View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  // ── Guest ────────────────────────────────────────────────────────────────────
  guestTitle: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 22,
    textAlign: "center",
    marginBottom: 8,
  },
  guestSubtitle: {
    color: "#6B7280",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 28,
  },
  loginButton: {
    backgroundColor: "#EAB308",
    borderRadius: 16,
    paddingVertical: 15,
    paddingHorizontal: 40,
  },
  loginButtonText: {
    color: "#000",
    fontWeight: "800",
    fontSize: 16,
  },

  // ── Header do perfil ─────────────────────────────────────────────────────────
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 14,
  },
  avatarWrapper: {
    position: "relative",
    width: 52,
    height: 52,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#1F1500",
    borderWidth: 2,
    borderColor: "#EAB308",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarPhoto: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: "#EAB308",
  },
  avatarEditBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    backgroundColor: "#111827",
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#374151",
  },
  avatarInitials: {
    color: "#EAB308",
    fontWeight: "800",
    fontSize: 22,
  },
  profileName: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 18,
  },
  profileEmail: {
    color: "#9CA3AF",
    fontSize: 13,
    marginTop: 2,
  },
  profileBirth: {
    color: "#6B7280",
    fontSize: 12,
    marginTop: 2,
  },
  logoutBtn: {
    backgroundColor: "#1F2937",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  logoutText: {
    color: "#EF4444",
    fontSize: 13,
    fontWeight: "600",
  },

  // ── Banner aniversário pequeno ────────────────────────────────────────────────
  birthdayBannerSmall: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#1A1000",
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#EAB30844",
  },
  birthdayBannerTitle: {
    color: "#EAB308",
    fontWeight: "700",
    fontSize: 13,
  },
  birthdayBannerSub: {
    color: "#6B7280",
    fontSize: 12,
    marginTop: 2,
  },

  // ── Tabs ─────────────────────────────────────────────────────────────────────
  tabsWrapper: {
    paddingHorizontal: 20,
    marginBottom: 4,
  },
  tabsTrack: {
    flexDirection: "row",
    backgroundColor: "#111827",
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: "#1F2937",
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  tabBtnActive: {
    backgroundColor: "#EAB308",
  },
  tabBtnText: {
    color: "#6B7280",
    fontWeight: "600",
    fontSize: 12,
  },
  tabBtnTextActive: {
    color: "#000",
  },

  // ── Pontos ───────────────────────────────────────────────────────────────────
  pointsCard: {
    backgroundColor: "#111827",
    borderRadius: 20,
    padding: 24,
    margin: 20,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#EAB308",
  },
  pointsLabel: {
    color: "#9CA3AF",
    fontSize: 14,
    marginBottom: 4,
  },
  pointsValue: {
    color: "#EAB308",
    fontSize: 52,
    fontWeight: "800",
    lineHeight: 60,
  },
  pointsSubLabel: {
    color: "#9CA3AF",
    fontSize: 13,
  },
  pointsHint: {
    color: "#6B7280",
    fontSize: 12,
    marginTop: 8,
    textAlign: "center",
  },

  // ── Seção ────────────────────────────────────────────────────────────────────
  section: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    color: "#EAB308",
    fontWeight: "700",
    fontSize: 15,
    marginBottom: 12,
    letterSpacing: 0.3,
  },

  // ── Recompensas ──────────────────────────────────────────────────────────────
  rewardCard: {
    backgroundColor: "#111827",
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#1F2937",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rewardCardActive: {
    borderColor: "#EAB308",
  },
  rewardName: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  rewardDesc: {
    color: "#9CA3AF",
    fontSize: 13,
    marginTop: 2,
  },
  rewardPts: {
    fontWeight: "700",
    fontSize: 14,
  },
  rewardAvail: {
    color: "#22C55E",
    fontSize: 11,
    marginTop: 2,
  },

  // ── Histórico de pontos ───────────────────────────────────────────────────────
  historyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1F2937",
  },
  historyDesc: {
    color: "#fff",
    fontSize: 14,
  },
  historyDate: {
    color: "#6B7280",
    fontSize: 12,
    marginTop: 2,
  },
  historyPoints: {
    fontWeight: "700",
    fontSize: 16,
  },

  // ── Cupons ───────────────────────────────────────────────────────────────────
  birthdayBanner: {
    backgroundColor: "#1A1000",
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: "#EAB308",
  },
  birthdayTitle: {
    color: "#EAB308",
    fontWeight: "800",
    fontSize: 18,
    marginBottom: 4,
  },
  birthdayText: {
    color: "#D97706",
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 12,
  },
  couponCard: {
    backgroundColor: "#0A0A0A",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#EAB308",
    borderStyle: "dashed",
  },
  couponRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  couponCode: {
    color: "#EAB308",
    fontWeight: "800",
    fontSize: 22,
    letterSpacing: 2,
  },
  discountBadge: {
    backgroundColor: "#1F1500",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  discountText: {
    color: "#EAB308",
    fontWeight: "700",
    fontSize: 13,
  },
  couponDesc: {
    color: "#9CA3AF",
    fontSize: 13,
    marginTop: 6,
  },
  couponValidity: {
    color: "#6B7280",
    fontSize: 12,
    marginTop: 6,
  },

  // ── Configurações ─────────────────────────────────────────────────────────────
  themeRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  themeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#374151",
  },
  themeBtnActive: {
    backgroundColor: "#EAB308",
    borderColor: "#EAB308",
  },
  themeBtnText: {
    color: "#9CA3AF",
    fontWeight: "600",
    fontSize: 12,
  },
  themeBtnTextActive: {
    color: "#000",
  },
  formGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    color: "#9CA3AF",
    fontSize: 13,
    marginBottom: 6,
    fontWeight: "500",
  },
  input: {
    backgroundColor: "#111827",
    color: "#fff",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#1F2937",
    fontSize: 15,
  },
  saveButton: {
    backgroundColor: "#EAB308",
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 8,
  },
  saveButtonText: {
    color: "#000",
    fontWeight: "800",
    fontSize: 16,
  },
  mutedText: {
    color: "#6B7280",
    fontSize: 14,
  },
});
