/**
 * Tela: Minha Página
 *
 * Configuração simplificada da página pública da barbearia em 3 blocos:
 *   1. Compartilhar — link + QR Code
 *   2. Aparência    — logo, cor, banner, galeria
 *   3. Avançado     — domínio, SEO, rastreamento (recolhido por padrão)
 */
import React, { useState, useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
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

// ─── Componente auxiliar: linha de URL copiável ───────────────────────────────
function UrlRow({
  label,
  url,
  colors,
  onCopy,
}: {
  label: string;
  url: string;
  colors: ReturnType<typeof useColors>;
  onCopy: () => void;
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={[styles.urlLabel, { color: colors.muted }]}>{label}</Text>
      <View style={[styles.urlBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
        <Text style={[styles.urlText, { color: colors.muted }]} numberOfLines={1}>
          {url}
        </Text>
        <Pressable
          style={({ pressed }) => [styles.urlCopyBtn, pressed && { opacity: 0.6 }]}
          onPress={onCopy}
        >
          <IconSymbol name="doc.on.doc" size={15} color="#C9A84C" />
        </Pressable>
      </View>
    </View>
  );
}

// ─── Componente auxiliar: campo de texto avançado ────────────────────────────
function AdvancedInput({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  colors,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={[styles.advLabel, { color: colors.muted }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        multiline={multiline}
        returnKeyType={multiline ? undefined : "done"}
        style={[
          styles.advInput,
          {
            backgroundColor: colors.background,
            borderColor: colors.border,
            color: colors.foreground,
            minHeight: multiline ? 72 : undefined,
            textAlignVertical: multiline ? "top" : "center",
          },
        ]}
      />
    </View>
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
  const settingsQuery = trpc.settings.get.useQuery();
  const tenantQuery = trpc.onboarding.getById.useQuery(
    { id: tenantId ?? 0 },
    { enabled: !!tenantId }
  );

  const settings = settingsQuery.data;
  const tenant = tenantQuery.data;
  const slug = tenant?.slug ?? "";
  const apiBase = getApiBaseUrl();
  const publicUrl = slug ? `${apiBase}/pub/${slug}` : "";
  const bookingUrl = slug ? `${apiBase}/pub/${slug}/agendar` : "";

  // QR Code
  const qrQuery = trpc.settings.generateQr.useQuery(
    { url: bookingUrl },
    { enabled: !!bookingUrl }
  );
  const qrDataUrl = qrQuery.data?.qrDataUrl ?? "";

  // ── Estados: Aparência ──────────────────────────────────────────────────────
  const [primaryColor, setPrimaryColor] = useState("#C9A84C");
  const [customHex, setCustomHex] = useState("");
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [gallery, setGallery] = useState<string[]>([]);

  // ── Estados: Avançado ───────────────────────────────────────────────────────
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customDomain, setCustomDomain] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [seoImageUrl, setSeoImageUrl] = useState("");
  const [ga4Id, setGa4Id] = useState("");
  const [pixelId, setPixelId] = useState("");

  // Preencher estados ao carregar
  useEffect(() => {
    if (settings) {
      setPrimaryColor((settings as any).primaryColor ?? "#C9A84C");
      setBannerUrl((settings as any).bannerUrl ?? null);
      setLogoUrl((settings as any).logoUrl ?? null);
      try {
        const g = (settings as any).galleryUrls ? JSON.parse((settings as any).galleryUrls) : [];
        setGallery(Array.isArray(g) ? g : []);
      } catch { setGallery([]); }
      setCustomDomain((settings as any).customDomain ?? "");
      setSeoTitle((settings as any).seoTitle ?? "");
      setSeoDescription((settings as any).seoDescription ?? "");
      setSeoImageUrl((settings as any).seoImageUrl ?? "");
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

  async function handleShareWhatsApp(url: string) {
    const msg = `Agende seu horário: ${url}`;
    Linking.openURL(`https://wa.me/?text=${encodeURIComponent(msg)}`).catch(() =>
      Alert.alert("Erro", "Não foi possível abrir o WhatsApp.")
    );
  }

  async function handleShareLink(url: string) {
    try {
      await Share.share({ message: url, url });
    } catch {}
  }

  async function handleDownloadQr() {
    if (!qrDataUrl) return;
    try {
      const base64 = qrDataUrl.replace(/^data:image\/png;base64,/, "");
      const fileUri = `${FileSystem.cacheDirectory}qrcode-agendamento.png`;
      await FileSystem.writeAsStringAsync(fileUri, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, { mimeType: "image/png", dialogTitle: "Salvar QR Code" });
      } else {
        Alert.alert("QR Code", "Arquivo salvo em: " + fileUri);
      }
    } catch (e) {
      Alert.alert("Erro", "Não foi possível baixar o QR Code.");
    }
  }

  function handleSaveAppearance() {
    updateMutation.mutate({
      primaryColor: activeColor,
      bannerUrl: bannerUrl ?? null,
      logoUrl: logoUrl ?? null,
      galleryUrls: gallery.length > 0 ? JSON.stringify(gallery) : null,
    });
    Alert.alert("Salvo!", "Aparência atualizada com sucesso.");
  }

  function handleSaveAdvanced() {
    updateMutation.mutate({
      customDomain: customDomain || null,
      seoTitle: seoTitle || null,
      seoDescription: seoDescription || null,
      seoImageUrl: seoImageUrl || null,
      ga4MeasurementId: ga4Id || null,
      facebookPixelId: pixelId || null,
    });
    Alert.alert("Salvo!", "Configurações avançadas salvas.");
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
          title="Compartilhar"
          subtitle="Envie o link para seus clientes agendarem online."
          colors={colors}
        >
          {publicUrl ? (
            <>
              <UrlRow
                label="Página da barbearia"
                url={publicUrl}
                colors={colors}
                onCopy={() => handleCopy(publicUrl, "Link da página")}
              />
              <UrlRow
                label="Link direto para agendamento"
                url={bookingUrl}
                colors={colors}
                onCopy={() => handleCopy(bookingUrl, "Link de agendamento")}
              />

              {/* Botões de ação */}
              <View style={styles.actionsRow}>
                <Pressable
                  style={({ pressed }) => [styles.actionBtn, { borderColor: colors.border, backgroundColor: colors.background }, pressed && { opacity: 0.7 }]}
                  onPress={() => handleShareWhatsApp(bookingUrl)}
                >
                  <Text style={styles.actionBtnEmoji}>💬</Text>
                  <Text style={[styles.actionBtnText, { color: colors.foreground }]}>WhatsApp</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.actionBtn, { borderColor: colors.border, backgroundColor: colors.background }, pressed && { opacity: 0.7 }]}
                  onPress={() => handleShareLink(bookingUrl)}
                >
                  <Text style={styles.actionBtnEmoji}>📤</Text>
                  <Text style={[styles.actionBtnText, { color: colors.foreground }]}>Compartilhar</Text>
                </Pressable>
              </View>

              {/* QR Code */}
              <View style={[styles.qrContainer, { borderTopColor: colors.border }]}>
                <Text style={[styles.qrLabel, { color: colors.muted }]}>QR Code de Agendamento</Text>
                <Text style={[styles.qrHint, { color: colors.muted }]}>
                  Imprima e coloque na barbearia para que os clientes agendem pelo celular.
                </Text>
                {qrDataUrl ? (
                  <View style={{ alignItems: "center", marginTop: 12 }}>
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
            </>
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
          {/* Preview da cor */}
          <View style={[styles.colorPreview, { borderColor: activeColor }]}>
            <View style={[styles.colorPreviewHeader, { backgroundColor: activeColor }]}>
              <Text style={styles.colorPreviewTitle}>Prévia da cor</Text>
            </View>
            <View style={[styles.colorPreviewBody, { backgroundColor: colors.background }]}>
              <View style={[styles.colorPreviewBtn, { backgroundColor: activeColor }]}>
                <Text style={styles.colorPreviewBtnText}>Agendar Agora</Text>
              </View>
              <Text style={[styles.colorPreviewPrice, { color: activeColor }]}>R$ 45,00</Text>
            </View>
          </View>

          {/* Paleta de cores */}
          <Text style={[styles.fieldLabel, { color: colors.muted }]}>Cor Principal</Text>
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

          {/* Logo */}
          <Text style={[styles.fieldLabel, { color: colors.muted, marginTop: 16 }]}>Logo da Barbearia</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <SingleImageUploader
              value={logoUrl}
              onUpload={(url) => {
                setLogoUrl(url);
                updateMutation.mutate({ logoUrl: url });
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
          <Text style={[styles.fieldLabel, { color: colors.muted }]}>Imagem de Capa (Banner)</Text>
          <Text style={[styles.uploadHint, { color: colors.muted, marginBottom: 8 }]}>
            Exibida no topo da página. Recomendado: 1200×400px.
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
          <Text style={[styles.fieldLabel, { color: colors.muted, marginTop: 16 }]}>Galeria de Fotos</Text>
          <Text style={[styles.uploadHint, { color: colors.muted, marginBottom: 8 }]}>
            Fotos do ambiente exibidas na página. Pressione e segure para reordenar.
          </Text>
          <SortableGallery
            images={gallery}
            onChange={(newGallery) => {
              setGallery(newGallery);
              updateMutation.mutate({
                galleryUrls: newGallery.length > 0 ? JSON.stringify(newGallery) : null,
              });
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
            BLOCO 3 — AVANÇADO (recolhido por padrão)
        ══════════════════════════════════════════════════════════════════ */}
        <View style={[styles.block, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Pressable
            style={({ pressed }) => [styles.advancedToggle, pressed && { opacity: 0.7 }]}
            onPress={() => setShowAdvanced((v) => !v)}
          >
            <View style={styles.blockHeader}>
              <Text style={styles.blockIcon}>⚙️</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.blockTitle, { color: colors.foreground }]}>Avançado</Text>
                <Text style={[styles.blockSubtitle, { color: colors.muted }]}>
                  Domínio personalizado, SEO e rastreamento.
                </Text>
              </View>
              <IconSymbol
                name={showAdvanced ? "chevron.up" : "chevron.down"}
                size={18}
                color={colors.muted}
              />
            </View>
          </Pressable>

          {showAdvanced && (
            <View style={{ paddingTop: 8 }}>
              {/* Domínio */}
              <Text style={[styles.advSectionTitle, { color: colors.foreground }]}>Domínio Personalizado</Text>
              <View style={[styles.infoBox, { backgroundColor: `${activeColor}18`, borderColor: `${activeColor}44` }]}>
                <Text style={[styles.infoText, { color: colors.muted }]}>
                  Configure um domínio próprio. Ex:{" "}
                  <Text style={{ fontWeight: "700", color: activeColor }}>agendamentos.suabarbearia.com.br</Text>
                  {"\n"}Após configurar, aponte o DNS do seu domínio para o servidor do Barber Pro.
                </Text>
              </View>
              <AdvancedInput
                label="Domínio"
                value={customDomain}
                onChangeText={setCustomDomain}
                placeholder="agendamentos.suabarbearia.com.br"
                colors={colors}
              />

              {/* SEO */}
              <Text style={[styles.advSectionTitle, { color: colors.foreground, marginTop: 8 }]}>SEO / Redes Sociais</Text>
              <AdvancedInput
                label="Título da Página"
                value={seoTitle}
                onChangeText={setSeoTitle}
                placeholder="Barbearia XYZ — Agende seu horário"
                colors={colors}
              />
              <AdvancedInput
                label="Descrição"
                value={seoDescription}
                onChangeText={setSeoDescription}
                placeholder="Agende seu corte de cabelo online. Profissionais experientes."
                multiline
                colors={colors}
              />
              <AdvancedInput
                label="Imagem para compartilhamento (URL)"
                value={seoImageUrl}
                onChangeText={setSeoImageUrl}
                placeholder="https://..."
                colors={colors}
              />

              {/* Rastreamento */}
              <Text style={[styles.advSectionTitle, { color: colors.foreground, marginTop: 8 }]}>Rastreamento</Text>
              <AdvancedInput
                label="Google Analytics 4 — Measurement ID"
                value={ga4Id}
                onChangeText={setGa4Id}
                placeholder="G-XXXXXXXXXX"
                colors={colors}
              />
              <AdvancedInput
                label="Facebook Pixel ID"
                value={pixelId}
                onChangeText={setPixelId}
                placeholder="000000000000000"
                colors={colors}
              />

              {/* Botão salvar avançado */}
              <Pressable
                style={({ pressed }) => [styles.saveBtn, { backgroundColor: activeColor }, pressed && { opacity: 0.85 }]}
                onPress={handleSaveAdvanced}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? (
                  <ActivityIndicator color="#0A0A0A" size="small" />
                ) : (
                  <Text style={styles.saveBtnText}>Salvar Configurações Avançadas</Text>
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
  urlLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 6 },
  urlBox: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  urlText: { flex: 1, fontSize: 13, fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" },
  urlCopyBtn: { padding: 4 },

  // Ações
  actionsRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
  },
  actionBtnEmoji: { fontSize: 16 },
  actionBtnText: { fontSize: 13, fontWeight: "600" },

  // QR Code
  qrContainer: { borderTopWidth: 1, paddingTop: 16, marginTop: 4 },
  qrLabel: { fontSize: 13, fontWeight: "700", marginBottom: 4 },
  qrHint: { fontSize: 12, lineHeight: 17 },
  qrImageWrapper: {
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  qrImage: { width: 200, height: 200 },
  qrPlaceholder: { height: 200, alignItems: "center", justifyContent: "center" },
  downloadQrBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#C9A84C44",
    backgroundColor: "#C9A84C18",
  },
  downloadQrText: { fontSize: 13, fontWeight: "600", color: "#C9A84C" },

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

  fieldLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 8 },
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

  uploadHint: { fontSize: 12, lineHeight: 17 },
  removeBtn: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  removeBtnText: { color: "#F87171", fontSize: 13 },

  saveBtn: { borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 16 },
  saveBtnText: { color: "#0A0A0A", fontWeight: "800", fontSize: 15 },

  // Avançado
  advancedToggle: { marginBottom: 0 },
  advSectionTitle: { fontSize: 14, fontWeight: "700", marginBottom: 10 },
  advLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 6 },
  advInput: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  infoBox: { borderRadius: 10, borderWidth: 1, padding: 12, marginBottom: 14 },
  infoText: { fontSize: 12, lineHeight: 18 },

  // Empty
  emptyBox: { borderRadius: 10, borderWidth: 1, padding: 16, alignItems: "center" },
  emptyText: { fontSize: 13, textAlign: "center", lineHeight: 18 },
});
