/**
 * Tela: Minha Página
 *
 * Configuração da página pública da barbearia em 3 blocos:
 *   1. Compartilhar — link + botões redesenhados + QR Code
 *   2. Aparência    — cor, estilo de texto, logo, banner, galeria + pré-visualização ao vivo
 *   3. Configurações extras — SEO simplificado (sem domínio personalizado)
 */
import React, { useState, useEffect, useRef } from "react";
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
  const font = FONT_STYLES.find((f) => f.id === fontStyleId) ?? FONT_STYLES[0];

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "#0A0A0A" }}>
        {/* Header do modal */}
        <View style={styles.previewHeader}>
          <Text style={styles.previewHeaderTitle}>Pré-visualização da Página</Text>
          <TouchableOpacity onPress={onClose} style={styles.previewCloseBtn}>
            <Text style={styles.previewCloseBtnText}>✕ Fechar</Text>
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Banner */}
          {bannerUrl ? (
            <Image source={{ uri: bannerUrl }} style={styles.previewBanner} resizeMode="cover" />
          ) : (
            <View style={[styles.previewBannerPlaceholder, { backgroundColor: primaryColor + "33" }]}>
              <Text style={{ color: primaryColor, fontSize: 13 }}>Sem imagem de capa</Text>
            </View>
          )}

          {/* Info da barbearia */}
          <View style={styles.previewInfoArea}>
            {logoUrl ? (
              <Image source={{ uri: logoUrl }} style={[styles.previewLogo, { borderColor: primaryColor }]} />
            ) : (
              <View style={[styles.previewLogoPlaceholder, { borderColor: primaryColor, backgroundColor: primaryColor + "22" }]}>
                <Text style={{ fontSize: 28 }}>💈</Text>
              </View>
            )}
            <Text
              style={[
                styles.previewShopName,
                { color: "#fff", fontFamily: font.fontFamily, fontWeight: font.fontWeight },
              ]}
            >
              {shopName || "Nome da Barbearia"}
            </Text>
            <View style={[styles.previewBadge, { backgroundColor: primaryColor + "22", borderColor: primaryColor + "55" }]}>
              <Text style={[styles.previewBadgeText, { color: primaryColor }]}>⭐ 5.0 · Aberto agora</Text>
            </View>
          </View>

          {/* Botão de agendar */}
          <View style={{ paddingHorizontal: 20, marginTop: 8 }}>
            <View style={[styles.previewBookBtn, { backgroundColor: primaryColor }]}>
              <Text style={[styles.previewBookBtnText, { fontFamily: font.fontFamily, fontWeight: font.fontWeight }]}>
                Agendar Agora
              </Text>
            </View>
          </View>

          {/* Serviços (mock) */}
          <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
            <Text style={[styles.previewSectionTitle, { color: "#fff", fontFamily: font.fontFamily, fontWeight: font.fontWeight }]}>
              Serviços
            </Text>
            {[
              { name: "Corte Masculino", price: "R$ 45,00", duration: "30 min" },
              { name: "Barba", price: "R$ 35,00", duration: "20 min" },
              { name: "Corte + Barba", price: "R$ 70,00", duration: "50 min" },
            ].map((svc) => (
              <View key={svc.name} style={styles.previewServiceCard}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.previewServiceName, { color: "#fff", fontFamily: font.fontFamily }]}>
                    {svc.name}
                  </Text>
                  <Text style={styles.previewServiceDuration}>⏱ {svc.duration}</Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 6 }}>
                  <Text style={[styles.previewServicePrice, { color: primaryColor }]}>{svc.price}</Text>
                  <View style={[styles.previewServiceBtn, { borderColor: primaryColor }]}>
                    <Text style={[styles.previewServiceBtnText, { color: primaryColor }]}>Agendar</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>

          {/* Galeria (se tiver fotos) */}
          {gallery.length > 0 && (
            <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
              <Text style={[styles.previewSectionTitle, { color: "#fff", fontFamily: font.fontFamily, fontWeight: font.fontWeight }]}>
                Galeria
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  {gallery.slice(0, 4).map((img, i) => (
                    <Image key={i} source={{ uri: img }} style={styles.previewGalleryImg} resizeMode="cover" />
                  ))}
                </View>
              </ScrollView>
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Tela principal ───────────────────────────────────────────────────────────
export default function PaginaClienteScreen() {
  const colors = useColors();
  const tabBarHeight = useTabBarHeight();
  const { barber } = useBarberAuth();
  const tenantId = barber?.tenantId ?? undefined;
  const utils = trpc.useUtils();

  // Queries
  const settingsQuery = trpc.settings.get.useQuery({ tenantId });
  const tenantQuery = trpc.onboarding.getById.useQuery(
    { id: tenantId ?? 0 },
    { enabled: !!tenantId }
  );

  const settings = settingsQuery.data;
  const tenant = tenantQuery.data;
  const slug = tenant?.slug ?? "";
  const shopName = (tenant as any)?.name ?? "";
  const apiBase = getApiBaseUrl();
  const publicUrl = slug ? `${apiBase}/pub/${slug}` : "";

  // QR Code — aponta para a página principal (não mais para /agendar)
  const qrQuery = trpc.settings.generateQr.useQuery(
    { url: publicUrl },
    { enabled: !!publicUrl }
  );
  const qrDataUrl = qrQuery.data?.qrDataUrl ?? "";

  // ── Estados: Aparência ──────────────────────────────────────────────────────
  const [primaryColor, setPrimaryColor] = useState("#C9A84C");
  const [customHex, setCustomHex] = useState("");
  const [fontStyleId, setFontStyleId] = useState("moderno");
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [gallery, setGallery] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(false);

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

  // ── Handlers ─────────────────────────────────────────────────────────────────
  async function handleCopy(text: string, label: string) {
    await Clipboard.setStringAsync(text);
    Alert.alert("Copiado!", `${label} copiado para a área de transferência.`);
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
      fontStyle: fontStyleId,
      bannerUrl: bannerUrl ?? null,
      logoUrl: logoUrl ?? null,
      galleryUrls: gallery.length > 0 ? JSON.stringify(gallery) : null,
      tenantId,
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
      tenantId,
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

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: tabBarHeight }}
        keyboardShouldPersistTaps="handled"
      >

        {/* ══════════════════════════════════════════════════════════════════
            BLOCO 1 — COMPARTILHAR
        ══════════════════════════════════════════════════════════════════ */}
        <SectionBlock
          icon="🔗"
          title="Compartilhar sua Página"
          subtitle="Envie este link para seus clientes agendarem online."
          colors={colors}
        >
          {publicUrl ? (
            <View>
              {/* Link da página */}
              <Text style={[styles.fieldLabel, { color: colors.muted }]}>Link da sua página</Text>
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

              {/* Botões de ação redesenhados */}
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
                  <View>
                    <Text style={styles.shareWhatsAppTitle}>WhatsApp</Text>
                    <Text style={styles.shareWhatsAppSub}>Enviar para clientes</Text>
                  </View>
                </Pressable>

                {/* Compartilhar */}
                <Pressable
                  style={({ pressed }) => [
                    styles.shareGenericBtn,
                    { borderColor: colors.border, backgroundColor: colors.background },
                    pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
                  ]}
                  onPress={handleShareLink}
                >
                  <Text style={styles.shareGenericIcon}>📤</Text>
                  <View>
                    <Text style={[styles.shareGenericTitle, { color: colors.foreground }]}>Compartilhar</Text>
                    <Text style={[styles.shareGenericSub, { color: colors.muted }]}>Outros apps</Text>
                  </View>
                </Pressable>
              </View>

              {/* QR Code */}
              <View style={[styles.qrContainer, { borderTopColor: colors.border }]}>
                <Text style={[styles.qrLabel, { color: colors.foreground }]}>QR Code da Barbearia</Text>
                <Text style={[styles.qrHint, { color: colors.muted }]}>
                  Imprima e coloque na barbearia para que os clientes acessem a página pelo celular.
                </Text>
                {qrDataUrl ? (
                  <View style={{ alignItems: "center", marginTop: 16 }}>
                    <View style={styles.qrImageWrapper}>
                      <Image
                        source={{ uri: qrDataUrl }}
                        style={styles.qrImage}
                        resizeMode="contain"
                      />
                    </View>
                    <Pressable
                      style={({ pressed }) => [styles.downloadQrBtn, pressed && { opacity: 0.75 }]}
                      onPress={handleDownloadQr}
                    >
                      <IconSymbol name="arrow.down.circle.fill" size={16} color="#C9A84C" />
                      <Text style={styles.downloadQrText}>Baixar QR Code</Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={styles.qrPlaceholder}>
                    <ActivityIndicator color="#C9A84C" size="small" />
                  </View>
                )}
              </View>
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
            BLOCO 2 — APARÊNCIA
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
              { borderColor: activeColor, backgroundColor: activeColor + "15" },
              pressed && { opacity: 0.8 },
            ]}
            onPress={() => setShowPreview(true)}
          >
            <Text style={styles.previewBtnIcon}>👁</Text>
            <Text style={[styles.previewBtnText, { color: activeColor }]}>
              Ver como ficará minha página
            </Text>
          </Pressable>

          {/* Miniatura de pré-visualização em tempo real */}
          <View style={[styles.livePreviewCard, { borderColor: activeColor + "44" }]}>
            <Text style={[styles.livePreviewLabel, { color: colors.muted }]}>Pré-visualização ao vivo</Text>
            {/* Hero miniatura */}
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
                    {
                      fontFamily: FONT_STYLES.find(f => f.id === fontStyleId)?.fontFamily,
                    },
                  ]}
                >
                  Agendar Horário
                </Text>
              </View>
            </View>
            {/* Rodapé com cor e estilo */}
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

          {/* ── Estilo de Texto ─────────────────────────────────────────── */}
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
                updateMutation.mutate({ logoUrl: url, tenantId } as any);
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
                tenantId,
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
            BLOCO 3 — CONFIGURAÇÕES EXTRAS (recolhido por padrão)
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

              {/* Aparência no Google e redes sociais */}
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

              {/* Imagem de compartilhamento — uploader direto */}
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
const styles = StyleSheet.create({
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
    marginBottom: 16,
  },
  urlText: { flex: 1, fontSize: 13, fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" },
  urlCopyBtn: { padding: 4 },

  // Botões de compartilhamento redesenhados
  shareButtonsRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  shareWhatsAppBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "#075E54",
  },
  shareWhatsAppIcon: { fontSize: 22 },
  shareWhatsAppTitle: { color: "#fff", fontWeight: "700", fontSize: 14 },
  shareWhatsAppSub: { color: "rgba(255,255,255,0.7)", fontSize: 11, marginTop: 1 },
  shareGenericBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  shareGenericIcon: { fontSize: 22 },
  shareGenericTitle: { fontWeight: "700", fontSize: 14 },
  shareGenericSub: { fontSize: 11, marginTop: 1 },

  // QR Code
  qrContainer: { borderTopWidth: 1, paddingTop: 16, marginTop: 4 },
  qrLabel: { fontSize: 14, fontWeight: "700", marginBottom: 6 },
  qrHint: { fontSize: 12, lineHeight: 17 },
  qrImageWrapper: {
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 18,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  qrImage: { width: 200, height: 200 },
  qrPlaceholder: { height: 200, alignItems: "center", justifyContent: "center" },
  downloadQrBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 14,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#C9A84C44",
    backgroundColor: "#C9A84C18",
  },
  downloadQrText: { fontSize: 13, fontWeight: "700", color: "#C9A84C" },

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
  colorPreview: { borderRadius: 12, borderWidth: 2, overflow: "hidden", marginBottom: 16 },
  colorPreviewHeader: { padding: 12 },
  colorPreviewTitle: { color: "#fff", fontWeight: "700", fontSize: 13 },
  colorPreviewBody: {
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  colorPreviewBtn: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 9 },
  colorPreviewBtnText: { color: "#0A0A0A", fontWeight: "800", fontSize: 13 },
  colorPreviewPrice: { fontSize: 20, fontWeight: "900" },

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
  livePreviewFooterText: {
    fontSize: 12,
  },

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

  // Preview Modal
  previewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#1F2937",
  },
  previewHeaderTitle: { color: "#fff", fontWeight: "700", fontSize: 16 },
  previewCloseBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#1F2937",
  },
  previewCloseBtnText: { color: "#9CA3AF", fontSize: 13, fontWeight: "600" },
  previewBanner: { width: "100%", height: 160 },
  previewBannerPlaceholder: {
    width: "100%",
    height: 160,
    alignItems: "center",
    justifyContent: "center",
  },
  previewInfoArea: { paddingHorizontal: 20, paddingTop: 20, alignItems: "center", gap: 10 },
  previewLogo: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
  },
  previewLogoPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  previewShopName: { fontSize: 26, textAlign: "center" },
  previewBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  previewBadgeText: { fontSize: 12, fontWeight: "600" },
  previewBookBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  previewBookBtnText: { color: "#0A0A0A", fontSize: 16 },
  previewSectionTitle: { fontSize: 18, marginBottom: 12 },
  previewServiceCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111827",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#1F2937",
  },
  previewServiceName: { fontSize: 15, fontWeight: "600", marginBottom: 3 },
  previewServiceDuration: { color: "#6B7280", fontSize: 12 },
  previewServicePrice: { fontSize: 15, fontWeight: "800" },
  previewServiceBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  previewServiceBtnText: { fontSize: 12, fontWeight: "700" },
  previewGalleryImg: { width: 120, height: 90, borderRadius: 10 },
});
