/**
 * Tela: Minha Página
 *
 * 4 blocos bem organizados:
 *   1. Compartilhar — link + botões de compartilhamento + mensagem pronta
 *   2. QR Code      — QR Code da barbearia + baixar
 *   3. Aparência    — cor, estilo de texto, logo, banner, galeria + pré-visualização ao vivo
 *   4. Configurações Extras — título, descrição, imagem de compartilhamento, rastreamento
 */
import React, { useState, useEffect } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { ScreenContainer } from "@/components/screen-container";
import { AdminHeader } from "@/components/admin-header";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { trpc } from "@/lib/trpc";
import { useBarberAuth } from "@/lib/auth-context";
import { useBranch } from "@/components/BranchSelector";
import { useColors } from "@/hooks/use-colors";
import { getApiBaseUrl } from "@/constants/oauth";
import { SingleImageUploader } from "@/components/media-uploader";
import { SortableGallery } from "@/components/sortable-gallery";
import { useTabBarHeight } from "@/hooks/use-tab-bar-height";

// ─── Paleta de cores predefinidas ────────────────────────────────────────────
const PRESET_COLORS = [
  { label: "Dourado", value: "#C9A84C" },
  { label: "Azul", value: "#0A7EA4" },
  { label: "Verde", value: "#22C55E" },
  { label: "Vermelho", value: "#EF4444" },
  { label: "Roxo", value: "#8B5CF6" },
  { label: "Laranja", value: "#F97316" },
  { label: "Rosa", value: "#EC4899" },
  { label: "Cinza", value: "#6B7280" },
];
const BG_PRESET_COLORS = [
  { label: "Preto", value: "#0A0A0A" },
  { label: "Grafite", value: "#111827" },
  { label: "Azul Noite", value: "#1a1a2e" },
  { label: "Ardósia", value: "#0f172a" },
  { label: "Carvão", value: "#1c1c1c" },
  { label: "Zinco", value: "#18181b" },
  { label: "Índigo", value: "#1e1b4b" },
  { label: "Branco", value: "#ffffff" },
  { label: "Claro", value: "#f8f9fa" },
  { label: "Pérola", value: "#f1f5f9" },
];

// ─── Estilos de texto disponíveis ────────────────────────────────────────────
const FONT_STYLES = [
  {
    id: "moderno",
    label: "Moderno",
    description: "Limpo e contemporâneo",
    sample: "Barbearia",
    fontFamily: Platform.OS === "ios" ? "Helvetica Neue" : "sans-serif",
    fontWeight: "400" as const,
  },
  {
    id: "bold",
    label: "Bold",
    description: "Forte e impactante",
    sample: "Barbearia",
    fontFamily: Platform.OS === "ios" ? "Helvetica Neue" : "sans-serif",
    fontWeight: "900" as const,
  },
  {
    id: "classico",
    label: "Clássico",
    description: "Tradicional e elegante",
    sample: "Barbearia",
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
    fontWeight: "400" as const,
  },
  {
    id: "elegante",
    label: "Elegante",
    description: "Sofisticado e refinado",
    sample: "Barbearia",
    fontFamily: Platform.OS === "ios" ? "Palatino" : "serif",
    fontWeight: "700" as const,
  },
  {
    id: "minimalista",
    label: "Minimalista",
    description: "Fino e espaçado",
    sample: "Barbearia",
    fontFamily: Platform.OS === "ios" ? "Helvetica Neue" : "sans-serif",
    fontWeight: "200" as const,
  },
];

// ─── Componente auxiliar: bloco de seção ─────────────────────────────────────
function SectionBlock({
  icon,
  title,
  subtitle,
  children,
  colors,
}: {
  icon: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  colors: ReturnType<typeof useColors>;
}) {
  const styles = createStyles(colors);
  return (
    <View style={[styles.block, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.blockHeader}>
        <Text style={styles.blockIcon}>{icon}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.blockTitle, { color: colors.foreground }]}>{title}</Text>
          {subtitle ? (
            <Text style={[styles.blockSubtitle, { color: colors.muted }]}>{subtitle}</Text>
          ) : null}
        </View>
      </View>
      {children}
    </View>
  );
}

// ─── Componente auxiliar: campo de texto ────────────────────────────────────
function FieldInput({
  label,
  hint,
  value,
  onChangeText,
  placeholder,
  multiline,
  colors,
}: {
  label: string;
  hint?: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  colors: ReturnType<typeof useColors>;
}) {
  const styles = createStyles(colors);
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={[styles.fieldLabel, { color: colors.muted }]}>{label}</Text>
      {hint ? (
        <Text style={[styles.fieldHint, { color: colors.muted }]}>{hint}</Text>
      ) : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        multiline={multiline}
        returnKeyType={multiline ? undefined : "done"}
        style={[
          styles.fieldInputBox,
          {
            backgroundColor: colors.background,
            borderColor: colors.border,
            color: colors.foreground,
            minHeight: multiline ? 80 : undefined,
            textAlignVertical: multiline ? "top" : "center",
          },
        ]}
      />
    </View>
  );
}

// ─── Pré-visualização ao vivo da página ──────────────────────────────────────
function PagePreviewModal({
  visible,
  onClose,
  shopName,
  primaryColor,
  fontStyleId,
  logoUrl,
  bannerUrl,
  gallery,
}: {
  visible: boolean;
  onClose: () => void;
  shopName: string;
  primaryColor: string;
  fontStyleId: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  gallery: string[];
}) {
  const colors = useColors();
  const styles = createStyles(colors);
  const font = FONT_STYLES.find((f) => f.id === fontStyleId) ?? FONT_STYLES[0];
  const dim = primaryColor + "22";
  const dimBorder = primaryColor + "55";

  const MOCK_SERVICES = [
    { name: "Corte Masculino", price: "R$ 45,00", duration: "30 min", icon: "✂️" },
    { name: "Barba Completa", price: "R$ 35,00", duration: "20 min", icon: "🪒" },
    { name: "Corte + Barba", price: "R$ 70,00", duration: "50 min", icon: "💈" },
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.previewOverlay}>
        {/* Moldura de smartphone */}
        <View style={styles.previewPhoneFrame}>
          <View style={styles.previewNotch}>
            <View style={styles.previewNotchDot} />
          </View>
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} bounces={false}>
            {/* Hero com banner */}
            <View style={styles.previewHeroWrap}>
              {bannerUrl ? (
                <Image source={{ uri: bannerUrl }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
              ) : (
                <View style={[StyleSheet.absoluteFillObject, { backgroundColor: primaryColor + "33" }]} />
              )}
              <View style={styles.previewHeroGradient} />
              {logoUrl ? (
                <Image source={{ uri: logoUrl }} style={[styles.previewHeroLogo, { borderColor: primaryColor }]} resizeMode="cover" />
              ) : (
                <View style={[styles.previewHeroLogo, { borderColor: primaryColor, backgroundColor: dim, alignItems: "center", justifyContent: "center" }]}>
                  <Text style={{ fontSize: 22 }}>💈</Text>
                </View>
              )}
              <Text style={[styles.previewHeroName, { fontFamily: font.fontFamily, fontWeight: font.fontWeight }]}>
                {shopName || "Nome da Barbearia"}
              </Text>
              <View style={[styles.previewHeroBadge, { backgroundColor: dim, borderColor: dimBorder }]}>
                <Text style={[styles.previewHeroBadgeText, { color: primaryColor }]}>⭐ 5.0 · Aberto agora</Text>
              </View>
            </View>
            {/* Botão CTA */}
            <View style={{ paddingHorizontal: 14, marginTop: 12 }}>
              <View style={[styles.previewCtaBtn, { backgroundColor: primaryColor }]}>
                <Text style={[styles.previewCtaBtnText, { fontFamily: font.fontFamily }]}>Agendar Agora</Text>
              </View>
            </View>
            {/* Serviços */}
            <View style={{ paddingHorizontal: 14, marginTop: 18 }}>
              <Text style={[styles.previewSecTitle, { color: "#F0EEE8", fontFamily: font.fontFamily, fontWeight: font.fontWeight }]}>
                Serviços
              </Text>
              {MOCK_SERVICES.map((svc) => (
                <View key={svc.name} style={styles.previewSvcCard}>
                  <Text style={{ fontSize: 20 }}>{svc.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.previewSvcName, { fontFamily: font.fontFamily }]}>{svc.name}</Text>
                    <Text style={styles.previewSvcDur}>⏱ {svc.duration}</Text>
                  </View>
                  <Text style={[styles.previewSvcPrice, { color: primaryColor }]}>{svc.price}</Text>
                </View>
              ))}
            </View>
            {/* Galeria */}
            {gallery.length > 0 && (
              <View style={{ paddingHorizontal: 14, marginTop: 18 }}>
                <Text style={[styles.previewSecTitle, { color: "#F0EEE8", fontFamily: font.fontFamily, fontWeight: font.fontWeight }]}>
                  Galeria
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {gallery.slice(0, 5).map((img, i) => (
                      <Image key={i} source={{ uri: img }} style={styles.previewGalleryImg} resizeMode="cover" />
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}
            <View style={{ height: 32 }} />
          </ScrollView>
        </View>
        {/* Etiqueta de estilo e cor */}
        <View style={styles.previewMetaRow}>
          <View style={[styles.previewMetaDot, { backgroundColor: primaryColor }]} />
          <Text style={styles.previewMetaText}>
            {font.label} · {primaryColor.toUpperCase()}
          </Text>
        </View>
        {/* Botão fechar */}
        <TouchableOpacity style={[styles.previewCloseCircle, { borderColor: primaryColor }]} onPress={onClose}>
          <Text style={[styles.previewCloseCircleText, { color: primaryColor }]}>✕ Fechar</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

// ─── Tela principal ───────────────────────────────────────────────────────────
export default function PaginaClienteScreen() {
  const colors = useColors();
  const styles = createStyles(colors);
  const tabBarHeight = useTabBarHeight();
  const { barber } = useBarberAuth();
  const { current } = useBranch();
  const activeTenantId = current?.id ?? barber?.tenantId ?? undefined;
  const utils = trpc.useUtils();

  // Queries
  const settingsQuery = trpc.settings.get.useQuery({ tenantId: activeTenantId });
  const tenantQuery = trpc.onboarding.getById.useQuery(
    { id: activeTenantId ?? 0 },
    { enabled: !!activeTenantId }
  );

  const settings = settingsQuery.data;
  const tenant = tenantQuery.data;
  const slug = tenant?.slug ?? "";
  const shopName = (tenant as any)?.name ?? "";
  const apiBase = getApiBaseUrl();
  const publicUrl = slug ? `${apiBase}/pub/${slug}` : "";

  // QR Code
  const qrQuery = trpc.settings.generateQr.useQuery(
    { url: publicUrl },
    { enabled: !!publicUrl }
  );
  const qrDataUrl = qrQuery.data?.qrDataUrl ?? "";

  // ── Estados: Aparência ──────────────────────────────────────────────────────
  const [primaryColor, setPrimaryColor] = useState("#C9A84C");
  const [bgColor, setBgColor] = useState("#0A0A0A");
  const [customBgHex, setCustomBgHex] = useState("");
  const [customHex, setCustomHex] = useState("");
  const [fontStyleId, setFontStyleId] = useState("moderno");
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [gallery, setGallery] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  // ── Estados: Compartilhar ───────────────────────────────────────────────────
  const [showMensagemPronta, setShowMensagemPronta] = useState(false);

  // ── Estados: Configurações Extras ──────────────────────────────────────────
  const [showExtras, setShowExtras] = useState(false);
  const [pageTitle, setPageTitle] = useState("");
  const [pageDescription, setPageDescription] = useState("");
  const [ogImageUrl, setOgImageUrl] = useState("");
  const [ga4Id, setGa4Id] = useState("");
  const [pixelId, setPixelId] = useState("");

  // Preencher estados ao carregar
  useEffect(() => {
    if (settings) {
      setPrimaryColor((settings as any).primaryColor ?? "#C9A84C");
      const savedBg = (settings as any).backgroundColor ?? "#0A0A0A";
      setBgColor(savedBg);
      const BG_PRESETS = ["#0A0A0A","#111827","#1a1a2e","#0f172a","#1c1c1c","#18181b","#1e1b4b","#ffffff","#f8f9fa","#f1f5f9"];
      if (!BG_PRESETS.includes(savedBg)) setCustomBgHex(savedBg.replace("#",""));
      setFontStyleId((settings as any).fontStyle ?? "moderno");
      setBannerUrl((settings as any).bannerUrl ?? null);
      setLogoUrl((settings as any).logoUrl ?? null);
      try {
        const g = (settings as any).galleryUrls ? JSON.parse((settings as any).galleryUrls) : [];
        setGallery(Array.isArray(g) ? g : []);
      } catch { setGallery([]); }
      setPageTitle((settings as any).seoTitle ?? "");
      setPageDescription((settings as any).seoDescription ?? "");
      setOgImageUrl((settings as any).seoImageUrl ?? "");
      setGa4Id((settings as any).ga4MeasurementId ?? "");
      setPixelId((settings as any).facebookPixelId ?? "");
    }
  }, [settings]);

  // Mutation de update
  const updateMutation = trpc.settings.update.useMutation({
    onSuccess: () => utils.settings.get.invalidate(),
    onError: (err) => Alert.alert("Erro", err.message),
  });

  // ── Cor ativa ───────────────────────────────────────────────────────────────
  const isValidHex = /^#[0-9A-Fa-f]{6}$/.test(customHex.startsWith("#") ? customHex : `#${customHex}`);
  const activeColor = isValidHex ? (customHex.startsWith("#") ? customHex : `#${customHex}`) : primaryColor;
  const isValidBgHex = /^#[0-9A-Fa-f]{6}$/.test(customBgHex.startsWith("#") ? customBgHex : `#${customBgHex}`);
  const activeBgColor = isValidBgHex ? (customBgHex.startsWith("#") ? customBgHex : `#${customBgHex}`) : bgColor;

  // ── Handlers ─────────────────────────────────────────────────────────────────
  async function handleCopy(text: string, label?: string) {
    await Clipboard.setStringAsync(text);
    Alert.alert("Copiado!", `${label ?? "Link"} copiado para a área de transferência.`);
  }

  async function handleShareWhatsApp() {
    const msg = `Olá! Agende seu horário na nossa barbearia pelo link abaixo:\n${publicUrl}`;
    Linking.openURL(`https://wa.me/?text=${encodeURIComponent(msg)}`).catch(() =>
      Alert.alert("Erro", "Não foi possível abrir o WhatsApp.")
    );
  }

  async function handleShareLink() {
    try {
      await Share.share({
        message: `Agende seu horário: ${publicUrl}`,
        url: publicUrl,
        title: "Agendar na Barbearia",
      });
    } catch {}
  }

  async function handleShareFacebook() {
    const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(publicUrl)}`;
    Linking.openURL(fbUrl).catch(() => Alert.alert("Erro", "Não foi possível abrir o Facebook."));
  }

  async function handleDownloadQr() {
    if (!qrDataUrl) return;
    try {
      const base64 = qrDataUrl.replace(/^data:image\/png;base64,/, "");
      const fileUri = `${FileSystem.cacheDirectory}qrcode-barbearia.png`;
      await FileSystem.writeAsStringAsync(fileUri, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, { mimeType: "image/png", dialogTitle: "Salvar QR Code" });
      } else {
        Alert.alert("QR Code", "Arquivo salvo em: " + fileUri);
      }
    } catch {
      Alert.alert("Erro", "Não foi possível baixar o QR Code.");
    }
  }

  function handleSaveAppearance() {
    updateMutation.mutate({
      primaryColor: activeColor,
      backgroundColor: activeBgColor,
      fontStyle: fontStyleId,
      bannerUrl: bannerUrl ?? null,
      logoUrl: logoUrl ?? null,
      galleryUrls: gallery.length > 0 ? JSON.stringify(gallery) : null,
      tenantId: activeTenantId,
    } as any);
    Alert.alert("Salvo!", "Aparência atualizada com sucesso.");
  }

  function handleSaveExtras() {
    updateMutation.mutate({
      seoTitle: pageTitle || null,
      seoDescription: pageDescription || null,
      seoImageUrl: ogImageUrl || null,
      ga4MeasurementId: ga4Id || null,
      facebookPixelId: pixelId || null,
      tenantId: activeTenantId,
    } as any);
    Alert.alert("Salvo!", "Configurações salvas com sucesso.");
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (settingsQuery.isLoading || tenantQuery.isLoading) {
    return (
      <ScreenContainer>
        <AdminHeader title="Minha Página" />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color="#C9A84C" size="large" />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <AdminHeader title="Minha Página" />

      {/* Modal de pré-visualização */}
      <PagePreviewModal
        visible={showPreview}
        onClose={() => setShowPreview(false)}
        shopName={shopName}
        primaryColor={activeColor}
        fontStyleId={fontStyleId}
        logoUrl={logoUrl}
        bannerUrl={bannerUrl}
        gallery={gallery}
      />

      {/* Modal Mensagem Pronta */}
      <Modal visible={showMensagemPronta} transparent animationType="fade" onRequestClose={() => setShowMensagemPronta(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Mensagem Pronta</Text>
            <Text style={[styles.modalSubtitle, { color: colors.muted }]}>
              Copie e envie para seus clientes:
            </Text>
            <View style={[styles.modalTextBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Text style={[styles.modalText, { color: colors.foreground }]}>
                {`Olá! Agora você pode agendar seu horário online diretamente pelo nosso site! É rápido e fácil.\n\n💇 Agende agora: ${publicUrl}\n\n📅 Escolha o dia e horário que preferir\n✅ Confirmação instantânea\n\nTe esperamos!`}
              </Text>
            </View>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
              <Pressable
                style={({ pressed }) => [styles.modalBtnPrimary, { backgroundColor: "#C9A84C", opacity: pressed ? 0.8 : 1 }]}
                onPress={async () => {
                  await Clipboard.setStringAsync(
                    `Olá! Agora você pode agendar seu horário online diretamente pelo nosso site! É rápido e fácil.\n\n💇 Agende agora: ${publicUrl}\n\n📅 Escolha o dia e horário que preferir\n✅ Confirmação instantânea\n\nTe esperamos!`
                  );
                  Alert.alert("Copiado!", "Mensagem copiada para a área de transferência.");
                  setShowMensagemPronta(false);
                }}
              >
                <Text style={styles.modalBtnPrimaryText}>Copiar</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.modalBtnSecondary, { borderColor: colors.border, opacity: pressed ? 0.8 : 1 }]}
                onPress={() => setShowMensagemPronta(false)}
              >
                <Text style={[styles.modalBtnSecondaryText, { color: colors.muted }]}>Fechar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: tabBarHeight }}
        keyboardShouldPersistTaps="handled"
      >

        {/* ══════════════════════════════════════════════════════════════════
            BLOCO 1 — COMPARTILHAR SUA PÁGINA
        ══════════════════════════════════════════════════════════════════ */}
        <SectionBlock
          icon="🔗"
          title="Compartilhar sua Página"
          subtitle="Envie este link para seus clientes agendarem online."
          colors={colors}
        >
          {publicUrl ? (
            <View>
              {/* Link da página principal */}
              <Text style={[styles.fieldLabel, { color: colors.muted }]}>Página principal da barbearia</Text>
              <View style={[styles.urlBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Text style={[styles.urlText, { color: colors.muted }]} numberOfLines={1}>
                  {publicUrl}
                </Text>
                <Pressable
                  style={({ pressed }) => [styles.urlCopyBtn, pressed && { opacity: 0.6 }]}
                  onPress={() => handleCopy(publicUrl, "Link da página")}
                >
                  <IconSymbol name="doc.on.doc" size={15} color="#C9A84C" />
                </Pressable>
              </View>

              {/* Link direto para agendamento */}
              <Text style={[styles.fieldLabel, { color: colors.muted, marginTop: 10 }]}>Link direto para agendamento</Text>
              <View style={[styles.urlBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Text style={[styles.urlText, { color: colors.muted }]} numberOfLines={1}>
                  {publicUrl}/agendar
                </Text>
                <Pressable
                  style={({ pressed }) => [styles.urlCopyBtn, pressed && { opacity: 0.6 }]}
                  onPress={() => handleCopy(`${publicUrl}/agendar`, "Link de agendamento")}
                >
                  <IconSymbol name="doc.on.doc" size={15} color="#C9A84C" />
                </Pressable>
              </View>

              {/* Botões de compartilhamento */}
              <View style={styles.shareButtonsRow}>
                {/* WhatsApp */}
                <Pressable
                  style={({ pressed }) => [
                    styles.shareWhatsAppBtn,
                    pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
                  ]}
                  onPress={handleShareWhatsApp}
                >
                  <Text style={styles.shareWhatsAppIcon}>💬</Text>
                  <View style={styles.shareWhatsAppTextWrap}>
                    <Text style={styles.shareWhatsAppTitle} numberOfLines={1}>WhatsApp</Text>
                    <Text style={styles.shareWhatsAppSub} numberOfLines={1}>Enviar para clientes</Text>
                  </View>
                </Pressable>

                {/* Facebook */}
                <Pressable
                  style={({ pressed }) => [{
                    flex: 1,
                    flexDirection: "row" as const,
                    alignItems: "center" as const,
                    gap: 8,
                    paddingVertical: 12,
                    paddingHorizontal: 14,
                    borderRadius: 12,
                    backgroundColor: "#1877F2",
                    opacity: pressed ? 0.85 : 1,
                    transform: pressed ? [{ scale: 0.97 }] : [],
                  }]}
                  onPress={handleShareFacebook}
                >
                  <Text style={{ fontSize: 18 }}>👤</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: "#fff" }} numberOfLines={1}>Facebook</Text>
                    <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.8)" }} numberOfLines={1}>Compartilhar página</Text>
                  </View>
                </Pressable>
              </View>

              {/* Botão Compartilhar link */}
              <Pressable
                style={({ pressed }) => [styles.shareGenericFullBtn, { borderColor: colors.border, backgroundColor: colors.background }, pressed && { opacity: 0.75 }]}
                onPress={handleShareLink}
              >
                <Text style={{ fontSize: 16 }}>📤</Text>
                <Text style={[styles.shareGenericFullText, { color: colors.foreground }]}>Compartilhar link</Text>
              </Pressable>

              {/* Botão Mensagem Pronta */}
              <Pressable
                style={({ pressed }) => [styles.shareGenericFullBtn, { borderColor: colors.border, backgroundColor: colors.background }, pressed && { opacity: 0.75 }]}
                onPress={() => setShowMensagemPronta(true)}
              >
                <Text style={{ fontSize: 16 }}>📝</Text>
                <Text style={[styles.shareGenericFullText, { color: colors.foreground }]}>Mensagem pronta</Text>
              </Pressable>

              {/* Botão Abrir minha página */}
              <Pressable
                style={({ pressed }) => [styles.openPageBtn, { borderColor: "#C9A84C", backgroundColor: "#C9A84C18" }, pressed && { opacity: 0.75 }]}
                onPress={() => Linking.openURL(publicUrl).catch(() => Alert.alert("Erro", "Não foi possível abrir a página."))}
              >
                <Text style={{ fontSize: 16 }}>🌐</Text>
                <Text style={[styles.openPageBtnText, { color: "#C9A84C" }]}>Abrir minha página</Text>
                <Text style={{ fontSize: 12, color: "#C9A84C", opacity: 0.7 }}>↗</Text>
              </Pressable>
            </View>
          ) : (
            <View style={[styles.emptyBox, { borderColor: colors.border }]}>
              <Text style={[styles.emptyText, { color: colors.muted }]}>
                URL não disponível. Verifique as configurações da barbearia.
              </Text>
            </View>
          )}
        </SectionBlock>

        {/* ══════════════════════════════════════════════════════════════════
            BLOCO 2 — QR CODE DA BARBEARIA
        ══════════════════════════════════════════════════════════════════ */}
        <SectionBlock
          icon="📱"
          title="QR Code da Barbearia"
          subtitle="Imprima e coloque na barbearia para que os clientes acessem a página pelo celular."
          colors={colors}
        >
          {qrDataUrl ? (
            <View style={{ alignItems: "center" }}>
              <View style={styles.qrImageWrapper}>
                <Image
                  source={{ uri: qrDataUrl }}
                  style={styles.qrImage}
                  resizeMode="contain"
                />
              </View>
              <View style={styles.qrBtnsRow}>
                <Pressable
                  style={({ pressed }) => [styles.qrActionBtn, { borderColor: "#C9A84C44", backgroundColor: "#C9A84C18" }, pressed && { opacity: 0.75 }]}
                  onPress={handleDownloadQr}
                >
                  <IconSymbol name="arrow.down.circle.fill" size={16} color="#C9A84C" />
                  <Text style={[styles.qrActionBtnText, { color: "#C9A84C" }]}>Baixar QR Code</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.qrActionBtn, { borderColor: "#25D36644", backgroundColor: "#25D36618" }, pressed && { opacity: 0.75 }]}
                  onPress={async () => {
                    const shopName = barber?.name ?? "nossa barbearia";
                    const msg = `✂️ Agende agora na ${shopName}!\n\n👇 Acesse pelo link ou QR Code:\n${publicUrl}\n\n📲 É rápido, fácil e sem precisar ligar!`;
                    try {
                      await Share.share({ message: msg, title: `Agendar em ${shopName}` });
                    } catch {}
                  }}
                >
                  <Text style={{ fontSize: 14 }}>💬</Text>
                  <Text style={[styles.qrActionBtnText, { color: "#25D366" }]}>Enviar no WhatsApp</Text>
                </Pressable>
              </View>
            </View>
          ) : publicUrl ? (
            <View style={styles.qrPlaceholder}>
              <ActivityIndicator color="#C9A84C" size="small" />
              <Text style={[{ fontSize: 12, marginTop: 8 }, { color: colors.muted }]}>Gerando QR Code...</Text>
            </View>
          ) : (
            <View style={[styles.emptyBox, { borderColor: colors.border }]}>
              <Text style={[styles.emptyText, { color: colors.muted }]}>
                Configure a URL da barbearia para gerar o QR Code.
              </Text>
            </View>
          )}
        </SectionBlock>

        {/* ══════════════════════════════════════════════════════════════════
            BLOCO 3 — APARÊNCIA
        ══════════════════════════════════════════════════════════════════ */}
        <SectionBlock
          icon="🎨"
          title="Aparência"
          subtitle="Personalize o visual da sua página de agendamentos."
          colors={colors}
        >
          {/* Botão de pré-visualização */}
          <Pressable
            style={({ pressed }) => [
              styles.previewBtn,
              { borderColor: "#C9A84C", backgroundColor: "#C9A84C18" },
              pressed && { opacity: 0.8 },
            ]}
            onPress={() => setShowPreview(true)}
          >
            <Text style={styles.previewBtnIcon}>👁</Text>
            <Text style={[styles.previewBtnText, { color: "#C9A84C" }]}>
              Ver como ficará minha página
            </Text>
          </Pressable>

          {/* Miniatura de pré-visualização em tempo real */}
          <View style={[styles.livePreviewCard, { borderColor: activeColor + "44" }]}>
            <Text style={[styles.livePreviewLabel, { color: colors.muted }]}>Pré-visualização ao vivo</Text>
            <View style={[styles.livePreviewHero, { backgroundColor: "#0A0A0A" }]}>
              {bannerUrl ? (
                <Image source={{ uri: bannerUrl }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
              ) : null}
              <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "#00000088" }]} />
              {logoUrl ? (
                <Image
                  source={{ uri: logoUrl }}
                  style={[styles.livePreviewLogo, { borderColor: activeColor }]}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.livePreviewLogo, { borderColor: activeColor, backgroundColor: activeColor + "33", alignItems: "center", justifyContent: "center" }]}>
                  <Text style={{ fontSize: 18 }}>✂️</Text>
                </View>
              )}
              <Text
                style={[
                  styles.livePreviewShopName,
                  {
                    color: "#F0EEE8",
                    fontFamily: FONT_STYLES.find(f => f.id === fontStyleId)?.fontFamily,
                    fontWeight: FONT_STYLES.find(f => f.id === fontStyleId)?.fontWeight,
                  },
                ]}
                numberOfLines={1}
              >
                {shopName || "Sua Barbearia"}
              </Text>
              <View style={[styles.livePreviewCta, { backgroundColor: activeColor }]}>
                <Text
                  style={[
                    styles.livePreviewCtaText,
                    { fontFamily: FONT_STYLES.find(f => f.id === fontStyleId)?.fontFamily },
                  ]}
                >
                  Agendar Horário
                </Text>
              </View>
            </View>
            <View style={[styles.livePreviewFooter, { backgroundColor: colors.surface }]}>
              <View style={[styles.livePreviewColorDot, { backgroundColor: activeColor }]} />
              <Text style={[styles.livePreviewFooterText, { color: colors.muted }]}>
                {FONT_STYLES.find(f => f.id === fontStyleId)?.label ?? "Moderno"} · {activeColor.toUpperCase()}
              </Text>
            </View>
          </View>

          {/* Paleta de cores */}
          <Text style={[styles.sectionFieldLabel, { color: colors.muted }]}>Cor Principal</Text>
          <View style={styles.colorGrid}>
            {PRESET_COLORS.map((c) => (
              <Pressable
                key={c.value}
                style={({ pressed }) => [
                  styles.colorChip,
                  { backgroundColor: c.value },
                  primaryColor === c.value && !isValidHex && styles.colorChipActive,
                  pressed && { opacity: 0.8 },
                ]}
                onPress={() => { setPrimaryColor(c.value); setCustomHex(""); }}
              >
                {primaryColor === c.value && !isValidHex && (
                  <IconSymbol name="checkmark" size={14} color="#fff" />
                )}
              </Pressable>
            ))}
          </View>

          {/* Cor personalizada */}
          <View style={styles.hexRow}>
            <View style={[styles.hexPreview, { backgroundColor: isValidHex ? activeColor : colors.border }]} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.hexLabel, { color: colors.muted }]}>Cor personalizada (hex)</Text>
              <View style={[styles.hexInputWrapper, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Text style={[styles.hexHash, { color: colors.muted }]}>#</Text>
                <TextInput
                  value={customHex.replace("#", "")}
                  onChangeText={(v) => setCustomHex(v.startsWith("#") ? v : `#${v}`)}
                  placeholder="C9A84C"
                  placeholderTextColor={colors.muted}
                  maxLength={7}
                  autoCapitalize="characters"
                  returnKeyType="done"
                  style={[styles.hexInput, { color: colors.foreground }]}
                />
              </View>
            </View>
          </View>

          {/* Cor de Fundo */}
          <Text style={[styles.sectionFieldLabel, { color: colors.muted, marginTop: 16 }]}>Cor de Fundo da Página</Text>
          <Text style={[styles.fieldHint, { color: colors.muted, marginBottom: 12 }]}>
            Escolha a cor de fundo da sua página pública.
          </Text>
          <View style={styles.colorGrid}>
            {BG_PRESET_COLORS.map((c) => (
              <Pressable
                key={c.value}
                style={({ pressed }) => [
                  styles.colorChip,
                  { backgroundColor: c.value, borderWidth: bgColor === c.value ? 2 : 1, borderColor: bgColor === c.value ? activeColor : colors.border },
                  pressed && { opacity: 0.8 },
                ]}
                onPress={() => setBgColor(c.value)}
              >
                {bgColor === c.value && (
                  <IconSymbol name="checkmark" size={14} color={c.value === "#ffffff" || c.value === "#f8f9fa" || c.value === "#f1f5f9" ? "#111" : "#fff"} />
                )}
              </Pressable>
            ))}
          </View>

          {/* Cor de fundo personalizada */}
          <View style={styles.hexRow}>
            <View style={[styles.hexPreview, { backgroundColor: isValidBgHex ? activeBgColor : colors.border }]} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.hexLabel, { color: colors.muted }]}>Cor personalizada (hex)</Text>
              <View style={[styles.hexInputWrapper, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Text style={[styles.hexHash, { color: colors.muted }]}>#</Text>
                <TextInput
                  value={customBgHex.replace("#", "")}
                  onChangeText={(v) => { setCustomBgHex(v.startsWith("#") ? v : `#${v}`); }}
                  placeholder="0A0A0A"
                  placeholderTextColor={colors.muted}
                  maxLength={7}
                  autoCapitalize="characters"
                  returnKeyType="done"
                  style={[styles.hexInput, { color: colors.foreground }]}
                />
              </View>
            </View>
          </View>

          {/* Estilo de Texto */}
          <Text style={[styles.sectionFieldLabel, { color: colors.muted, marginTop: 8 }]}>
            Estilo de Texto
          </Text>
          <Text style={[styles.fieldHint, { color: colors.muted, marginBottom: 12 }]}>
            Escolha como os textos aparecem na sua página.
          </Text>
          <View style={{ gap: 10, marginBottom: 16 }}>
            {FONT_STYLES.map((font) => {
              const isActive = fontStyleId === font.id;
              return (
                <Pressable
                  key={font.id}
                  style={({ pressed }) => [
                    styles.fontStyleCard,
                    {
                      backgroundColor: isActive ? activeColor + "18" : colors.background,
                      borderColor: isActive ? activeColor : colors.border,
                    },
                    pressed && { opacity: 0.8 },
                  ]}
                  onPress={() => setFontStyleId(font.id)}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.fontStyleSample,
                        {
                          color: isActive ? activeColor : colors.foreground,
                          fontFamily: font.fontFamily,
                          fontWeight: font.fontWeight,
                        },
                      ]}
                    >
                      {font.sample}
                    </Text>
                    <Text style={[styles.fontStyleDesc, { color: colors.muted }]}>
                      {font.description}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 4 }}>
                    <Text style={[styles.fontStyleName, { color: isActive ? activeColor : colors.muted }]}>
                      {font.label}
                    </Text>
                    {isActive && (
                      <View style={[styles.fontStyleActiveBadge, { backgroundColor: activeColor }]}>
                        <Text style={styles.fontStyleActiveBadgeText}>✓ Ativo</Text>
                      </View>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>

          {/* Logo */}
          <Text style={[styles.sectionFieldLabel, { color: colors.muted }]}>Logo da Barbearia</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <SingleImageUploader
              value={logoUrl}
              onUpload={(url) => {
                setLogoUrl(url);
                updateMutation.mutate({ logoUrl: url, tenantId: activeTenantId } as any);
              }}
              imageType="logo"
              label="Logo"
              size={80}
            />
            <Text style={[styles.uploadHint, { color: colors.muted }]}>
              Imagem quadrada.{"\n"}Recomendado: 400×400px.
            </Text>
          </View>

          {/* Banner */}
          <Text style={[styles.sectionFieldLabel, { color: colors.muted }]}>Imagem de Capa (Banner)</Text>
          <Text style={[styles.uploadHint, { color: colors.muted, marginBottom: 8 }]}>
            Aparece no topo da sua página. Recomendado: 1200×400px.
          </Text>
          <SingleImageUploader
            value={bannerUrl}
            onUpload={(url) => setBannerUrl(url)}
            imageType="gallery"
            label="Banner"
            size={120}
          />
          {bannerUrl ? (
            <Pressable
              style={({ pressed }) => [styles.removeBtn, pressed && { opacity: 0.7 }]}
              onPress={() => setBannerUrl(null)}
            >
              <IconSymbol name="xmark.circle.fill" size={15} color="#F87171" />
              <Text style={styles.removeBtnText}>Remover banner</Text>
            </Pressable>
          ) : null}

          {/* Galeria */}
          <Text style={[styles.sectionFieldLabel, { color: colors.muted, marginTop: 16 }]}>Galeria de Fotos</Text>
          <Text style={[styles.uploadHint, { color: colors.muted, marginBottom: 8 }]}>
            Fotos do ambiente exibidas na página. Pressione e segure para reordenar.
          </Text>
          <SortableGallery
            images={gallery}
            onChange={(newGallery) => {
              setGallery(newGallery);
              updateMutation.mutate({
                galleryUrls: newGallery.length > 0 ? JSON.stringify(newGallery) : null,
                tenantId: activeTenantId,
              } as any);
            }}
            maxImages={8}
          />

          {/* Botão salvar aparência */}
          <Pressable
            style={({ pressed }) => [styles.saveBtn, { backgroundColor: activeColor }, pressed && { opacity: 0.85 }]}
            onPress={handleSaveAppearance}
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? (
              <ActivityIndicator color="#0A0A0A" size="small" />
            ) : (
              <Text style={styles.saveBtnText}>Salvar Aparência</Text>
            )}
          </Pressable>
        </SectionBlock>

        {/* ══════════════════════════════════════════════════════════════════
            BLOCO 4 — CONFIGURAÇÕES EXTRAS (recolhido por padrão)
        ══════════════════════════════════════════════════════════════════ */}
        <View style={[styles.block, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Pressable
            style={({ pressed }) => [styles.advancedToggle, pressed && { opacity: 0.7 }]}
            onPress={() => setShowExtras((v) => !v)}
          >
            <View style={styles.blockHeader}>
              <Text style={styles.blockIcon}>⚙️</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.blockTitle, { color: colors.foreground }]}>Configurações Extras</Text>
                <Text style={[styles.blockSubtitle, { color: colors.muted }]}>
                  Título, descrição, imagem de compartilhamento e rastreamento.
                </Text>
              </View>
              <IconSymbol
                name={showExtras ? "chevron.up" : "chevron.down"}
                size={18}
                color={colors.muted}
              />
            </View>
          </Pressable>

          {showExtras && (
            <View style={{ paddingTop: 8 }}>
              {/* Como aparece no Google e redes sociais */}
              <Text style={[styles.extrasGroupTitle, { color: colors.foreground }]}>
                Como aparece no Google e redes sociais
              </Text>
              <Text style={[styles.extrasGroupHint, { color: colors.muted }]}>
                Quando alguém pesquisar sua barbearia no Google ou compartilhar o link, essas informações aparecem.
              </Text>

              <FieldInput
                label="Título da Página"
                hint="Ex: Barbearia XYZ — Agende seu horário"
                value={pageTitle}
                onChangeText={setPageTitle}
                placeholder="Barbearia XYZ — Agende seu horário"
                colors={colors}
              />
              <FieldInput
                label="Descrição"
                hint="Texto curto que aparece abaixo do título no Google."
                value={pageDescription}
                onChangeText={setPageDescription}
                placeholder="Agende seu corte de cabelo online. Profissionais experientes."
                multiline
                colors={colors}
              />

              {/* Imagem de compartilhamento */}
              <View style={{ marginBottom: 16 }}>
                <Text style={[styles.fieldLabel, { color: colors.muted }]}>Imagem de Compartilhamento</Text>
                <Text style={[styles.fieldHint, { color: colors.muted }]}>
                  Quando alguém compartilha o link da sua página no WhatsApp ou Instagram, essa imagem aparece como miniatura. Escolha uma foto bonita da sua barbearia.
                </Text>
                {ogImageUrl ? (
                  <View style={{ gap: 10 }}>
                    <Image
                      source={{ uri: ogImageUrl }}
                      style={styles.ogImagePreview}
                      resizeMode="cover"
                    />
                    <View style={{ flexDirection: "row", gap: 10 }}>
                      <SingleImageUploader
                        value={null}
                        onUpload={(url) => setOgImageUrl(url)}
                        imageType="gallery"
                        label="Trocar imagem"
                        size={44}
                      />
                      <Pressable
                        style={({ pressed }) => [styles.removeBtn, pressed && { opacity: 0.7 }]}
                        onPress={() => setOgImageUrl("")}
                      >
                        <IconSymbol name="xmark.circle.fill" size={15} color="#F87171" />
                        <Text style={styles.removeBtnText}>Remover imagem</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <SingleImageUploader
                    value={null}
                    onUpload={(url) => setOgImageUrl(url)}
                    imageType="gallery"
                    label="Escolher imagem"
                    size={100}
                  />
                )}
              </View>

              {/* Rastreamento */}
              <Text style={[styles.extrasGroupTitle, { color: colors.foreground, marginTop: 8 }]}>
                Rastreamento de Visitas
              </Text>
              <Text style={[styles.extrasGroupHint, { color: colors.muted }]}>
                Ferramentas para acompanhar quantas pessoas visitam sua página. Opcional — só preencha se souber usar.
              </Text>

              <FieldInput
                label="Google Analytics (ID de medição)"
                hint="Começa com G- . Ex: G-XXXXXXXXXX"
                value={ga4Id}
                onChangeText={setGa4Id}
                placeholder="G-XXXXXXXXXX"
                colors={colors}
              />
              <FieldInput
                label="Facebook Pixel (ID)"
                hint="Número de 15 dígitos do seu Pixel do Facebook."
                value={pixelId}
                onChangeText={setPixelId}
                placeholder="000000000000000"
                colors={colors}
              />

              {/* Botão salvar extras */}
              <Pressable
                style={({ pressed }) => [styles.saveBtn, { backgroundColor: activeColor }, pressed && { opacity: 0.85 }]}
                onPress={handleSaveExtras}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? (
                  <ActivityIndicator color="#0A0A0A" size="small" />
                ) : (
                  <Text style={styles.saveBtnText}>Salvar Configurações</Text>
                )}
              </Pressable>
            </View>
          )}
        </View>

      </ScrollView>
    </ScreenContainer>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
function createStyles(c: ReturnType<typeof import("@/hooks/use-colors").useColors>) {
  return StyleSheet.create({
    block: {
      borderRadius: 16,
      borderWidth: 1,
      padding: 16,
      marginBottom: 16,
    },
    blockHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      marginBottom: 16,
    },
    blockIcon: { fontSize: 22, marginTop: 1 },
    blockTitle: { fontSize: 16, fontWeight: "700", marginBottom: 2 },
    blockSubtitle: { fontSize: 13, lineHeight: 18 },

    // URL
    fieldLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 6 },
    fieldHint: { fontSize: 12, lineHeight: 17, marginBottom: 6 },
    sectionFieldLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 8 },
    urlBox: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 10,
      borderWidth: 1,
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 8,
      marginBottom: 4,
    },
    urlText: { flex: 1, fontSize: 13, fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" },
    urlCopyBtn: { padding: 4 },

    // Botões de compartilhamento
    shareButtonsRow: { flexDirection: "row", gap: 10, marginTop: 14, marginBottom: 10 },
    shareWhatsAppBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 14,
      borderRadius: 12,
      backgroundColor: "#075E54",
      overflow: "hidden",
    },
    shareWhatsAppIcon: { fontSize: 20, flexShrink: 0 },
    shareWhatsAppTextWrap: { flex: 1, minWidth: 0 },
    shareWhatsAppTitle: { color: "#fff", fontWeight: "700", fontSize: 13 },
    shareWhatsAppSub: { color: "rgba(255,255,255,0.7)", fontSize: 11, marginTop: 1 },

    // Botões genéricos largura total
    shareGenericFullBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 12,
      borderWidth: 1.5,
      marginBottom: 10,
    },
    shareGenericFullText: { fontSize: 14, fontWeight: "600" },

    // Botão abrir página
    openPageBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 12,
      borderWidth: 1.5,
      marginTop: 4,
    },
    openPageBtnText: { fontSize: 14, fontWeight: "700" },

    // QR Code
    qrImageWrapper: {
      backgroundColor: "#fff",
      padding: 14,
      borderRadius: 18,
      shadowColor: "#000",
      shadowOpacity: 0.1,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
      marginBottom: 16,
    },
    qrImage: { width: 200, height: 200 },
    qrPlaceholder: { height: 200, alignItems: "center", justifyContent: "center" },
    qrBtnsRow: { flexDirection: "row", gap: 10 },
    qrActionBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
    },
    qrActionBtnText: { fontSize: 13, fontWeight: "700" },

    // Botão de pré-visualização
    previewBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1.5,
      marginBottom: 16,
      justifyContent: "center",
    },
    previewBtnIcon: { fontSize: 18 },
    previewBtnText: { fontWeight: "700", fontSize: 14 },

    // Aparência
    colorGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 16 },
    colorChip: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
    colorChipActive: { borderWidth: 3, borderColor: "#fff" },

    hexRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
    hexPreview: { width: 44, height: 44, borderRadius: 22, borderWidth: 1 },
    hexLabel: { fontSize: 11, marginBottom: 4 },
    hexInputWrapper: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 10,
      borderWidth: 1,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    hexHash: { fontSize: 15, marginRight: 4 },
    hexInput: { flex: 1, fontSize: 15 },

    // Estilo de texto
    fontStyleCard: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderRadius: 12,
      borderWidth: 1.5,
      gap: 12,
    },
    fontStyleSample: { fontSize: 20, marginBottom: 2 },
    fontStyleDesc: { fontSize: 12 },
    fontStyleName: { fontSize: 12, fontWeight: "700" },
    fontStyleActiveBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
    fontStyleActiveBadgeText: { color: "#0A0A0A", fontSize: 11, fontWeight: "800" },

    uploadHint: { fontSize: 12, lineHeight: 17 },
    removeBtn: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
    removeBtnText: { color: "#F87171", fontSize: 13 },

    // Live preview miniatura
    livePreviewCard: {
      borderRadius: 16,
      borderWidth: 1.5,
      overflow: "hidden",
      marginBottom: 20,
    },
    livePreviewLabel: {
      fontSize: 11,
      fontWeight: "600",
      letterSpacing: 0.8,
      textTransform: "uppercase",
      paddingHorizontal: 14,
      paddingTop: 10,
      paddingBottom: 6,
    },
    livePreviewHero: {
      height: 160,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
      gap: 6,
    },
    livePreviewLogo: {
      width: 44,
      height: 44,
      borderRadius: 12,
      borderWidth: 2,
    },
    livePreviewShopName: {
      fontSize: 16,
      color: "#F0EEE8",
      textAlign: "center",
      paddingHorizontal: 16,
    },
    livePreviewCta: {
      paddingHorizontal: 18,
      paddingVertical: 8,
      borderRadius: 20,
    },
    livePreviewCtaText: {
      color: "#0A0A0A",
      fontWeight: "800",
      fontSize: 12,
    },
    livePreviewFooter: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    livePreviewColorDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
    },
    livePreviewFooterText: { fontSize: 12 },

    saveBtn: { borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 16 },
    saveBtnText: { color: "#0A0A0A", fontWeight: "800", fontSize: 15 },

    // Avançado / Extras
    advancedToggle: { marginBottom: 0 },
    extrasGroupTitle: { fontSize: 14, fontWeight: "700", marginBottom: 6 },
    extrasGroupHint: { fontSize: 12, lineHeight: 17, marginBottom: 14 },
    fieldInputBox: {
      borderRadius: 10,
      borderWidth: 1,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
    },

    // OG Image preview
    ogImagePreview: {
      width: "100%",
      height: 160,
      borderRadius: 12,
      borderWidth: 1,
    },

    // Empty
    emptyBox: { borderRadius: 10, borderWidth: 1, padding: 16, alignItems: "center" },
    emptyText: { fontSize: 13, textAlign: "center", lineHeight: 18 },

    // Modal Mensagem Pronta
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.6)",
      justifyContent: "center",
      alignItems: "center",
      padding: 24,
    },
    modalCard: {
      width: "100%",
      maxWidth: 400,
      borderRadius: 16,
      padding: 20,
    },
    modalTitle: { fontSize: 16, fontWeight: "700", marginBottom: 8 },
    modalSubtitle: { fontSize: 13, marginBottom: 14, lineHeight: 20 },
    modalTextBox: {
      borderRadius: 10,
      padding: 14,
      borderWidth: 1,
      marginBottom: 16,
    },
    modalText: { fontSize: 13, lineHeight: 20 },
    modalBtnPrimary: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 10,
      alignItems: "center",
    },
    modalBtnPrimaryText: { color: "#0A0A0A", fontWeight: "700", fontSize: 14 },
    modalBtnSecondary: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 10,
      borderWidth: 1,
      alignItems: "center",
    },
    modalBtnSecondaryText: { fontSize: 14 },

    // Preview Modal
    previewOverlay: {
      flex: 1,
      backgroundColor: "#000000CC",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 24,
    },
    previewPhoneFrame: {
      width: 280,
      height: 520,
      backgroundColor: "#0A0A0A",
      borderRadius: 36,
      overflow: "hidden",
      borderWidth: 3,
      borderColor: c.border,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.6,
      shadowRadius: 24,
      elevation: 20,
    },
    previewNotch: {
      height: 22,
      backgroundColor: "#0A0A0A",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 10,
    },
    previewNotchDot: {
      width: 60,
      height: 6,
      borderRadius: 3,
      backgroundColor: c.border,
    },
    previewHeroWrap: {
      height: 160,
      alignItems: "center",
      justifyContent: "flex-end",
      paddingBottom: 14,
      overflow: "hidden",
      gap: 4,
    },
    previewHeroGradient: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "#00000077",
    },
    previewHeroLogo: {
      width: 52,
      height: 52,
      borderRadius: 14,
      borderWidth: 2,
    },
    previewHeroName: {
      color: "#F0EEE8",
      fontSize: 16,
      textAlign: "center",
      paddingHorizontal: 12,
    },
    previewHeroBadge: {
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 12,
      borderWidth: 1,
    },
    previewHeroBadgeText: { fontSize: 10, fontWeight: "700" },
    previewCtaBtn: {
      borderRadius: 10,
      paddingVertical: 11,
      alignItems: "center",
    },
    previewCtaBtnText: { color: "#0A0A0A", fontWeight: "800", fontSize: 13 },
    previewSecTitle: { fontSize: 13, fontWeight: "800", marginBottom: 8 },
    previewSvcCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: c.surface,
      borderRadius: 10,
      padding: 10,
      marginBottom: 7,
      gap: 8,
      borderWidth: 1,
      borderColor: c.border,
    },
    previewSvcName: { color: "#F0EEE8", fontSize: 12, fontWeight: "600", marginBottom: 2 },
    previewSvcDur: { color: c.muted, fontSize: 10 },
    previewSvcPrice: { fontSize: 12, fontWeight: "800" },
    previewGalleryImg: { width: 80, height: 60, borderRadius: 8 },
    previewMetaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 14,
    },
    previewMetaDot: { width: 10, height: 10, borderRadius: 5 },
    previewMetaText: { color: "#9CA3AF", fontSize: 12, fontWeight: "600" },
    previewCloseCircle: {
      marginTop: 14,
      paddingHorizontal: 24,
      paddingVertical: 10,
      borderRadius: 20,
      borderWidth: 1.5,
    },
    previewCloseCircleText: { fontWeight: "700", fontSize: 14 },
  });
}
