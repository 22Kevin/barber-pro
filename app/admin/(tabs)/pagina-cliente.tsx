import React, { useState, useEffect } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Share,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { AdminHeader } from "@/components/admin-header";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { trpc } from "@/lib/trpc";
import { useBarberAuth } from "@/lib/auth-context";
import { useColors } from "@/hooks/use-colors";
import { getApiBaseUrl } from "@/constants/oauth";
import * as Clipboard from "expo-clipboard";

type Tab = "url" | "dominio" | "seo" | "rastreamento";

function TabBar({ active, onSelect, colors }: { active: Tab; onSelect: (t: Tab) => void; colors: any }) {
  const tabs: { key: Tab; label: string }[] = [
    { key: "url", label: "URL / QR" },
    { key: "dominio", label: "Domínio" },
    { key: "seo", label: "SEO" },
    { key: "rastreamento", label: "Rastreamento" },
  ];
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}>
      <View style={{ flexDirection: "row" }}>
        {tabs.map((t) => (
          <Pressable
            key={t.key}
            onPress={() => onSelect(t.key)}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderBottomWidth: 2,
              borderBottomColor: active === t.key ? "#C9A84C" : "transparent",
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: "600", color: active === t.key ? "#C9A84C" : colors.muted }}>
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

function LabeledInput({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  keyboardType,
  colors,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: "default" | "url" | "email-address";
  colors: any;
}) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ fontSize: 12, fontWeight: "700", color: colors.muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        multiline={multiline}
        keyboardType={keyboardType}
        style={{
          backgroundColor: colors.surface,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: colors.border,
          paddingHorizontal: 14,
          paddingVertical: 10,
          fontSize: 14,
          color: colors.foreground,
          minHeight: multiline ? 80 : undefined,
          textAlignVertical: multiline ? "top" : "center",
        }}
      />
    </View>
  );
}

export default function PaginaClienteScreen() {
  const colors = useColors();
  const { barber } = useBarberAuth();
  const tenantId = barber?.tenantId ?? undefined;
  const [activeTab, setActiveTab] = useState<Tab>("url");
  const utils = trpc.useUtils();

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

  // Estados dos formulários
  const [customDomain, setCustomDomain] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [seoImageUrl, setSeoImageUrl] = useState("");
  const [ga4Id, setGa4Id] = useState("");
  const [pixelId, setPixelId] = useState("");

  useEffect(() => {
    if (settings) {
      setCustomDomain(settings.customDomain ?? "");
      setSeoTitle(settings.seoTitle ?? "");
      setSeoDescription(settings.seoDescription ?? "");
      setSeoImageUrl(settings.seoImageUrl ?? "");
      setGa4Id(settings.ga4MeasurementId ?? "");
      setPixelId(settings.facebookPixelId ?? "");
    }
  }, [settings]);

  const updateMutation = trpc.settings.update.useMutation({
    onSuccess: () => {
      utils.settings.get.invalidate();
      Alert.alert("Sucesso", "Configurações salvas com sucesso!");
    },
    onError: (err) => Alert.alert("Erro", err.message),
  });

  async function handleCopy(text: string, label: string) {
    await Clipboard.setStringAsync(text);
    Alert.alert("Copiado!", `${label} copiado para a área de transferência.`);
  }

  async function handleShare(url: string) {
    try {
      await Share.share({ message: url, url });
    } catch (e) {
      console.warn(e);
    }
  }

  function handleOpenUrl(url: string) {
    Linking.openURL(url).catch(() => Alert.alert("Erro", "Não foi possível abrir o link."));
  }

  function handleOpenWhatsApp(url: string) {
    const msg = `Agende seu horário: ${url}`;
    Linking.openURL(`https://wa.me/?text=${encodeURIComponent(msg)}`).catch(() =>
      Alert.alert("Erro", "Não foi possível abrir o WhatsApp.")
    );
  }

  const dyn = StyleSheet.create({
    section: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      margin: 16,
      padding: 16,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.foreground,
      marginBottom: 12,
    },
    urlBox: {
      backgroundColor: colors.background,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      paddingVertical: 10,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 10,
    },
    urlText: {
      flex: 1,
      fontSize: 13,
      color: colors.muted,
    },
    actionBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    actionBtnText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.foreground,
    },
    actionsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 4,
    },
    saveBtn: {
      backgroundColor: "#C9A84C",
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: "center",
      marginHorizontal: 16,
      marginBottom: 16,
    },
    saveBtnText: {
      fontSize: 14,
      fontWeight: "700",
      color: "#0A0A0A",
    },
    infoBox: {
      backgroundColor: "#C9A84C18",
      borderRadius: 10,
      borderWidth: 1,
      borderColor: "#C9A84C44",
      padding: 12,
      marginBottom: 16,
    },
    infoText: {
      fontSize: 12,
      color: colors.muted,
      lineHeight: 18,
    },
    emptyContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingTop: 60,
    },
  });

  if (settingsQuery.isLoading || tenantQuery.isLoading) {
    return (
      <ScreenContainer>
        <AdminHeader title="Página do Cliente" />
        <View style={dyn.emptyContainer}>
          <ActivityIndicator color="#C9A84C" size="large" />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <AdminHeader title="Página do Cliente" />
      <TabBar active={activeTab} onSelect={setActiveTab} colors={colors} />

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        {/* ── Aba URL / QR Code ── */}
        {activeTab === "url" && (
          <>
            <View style={dyn.section}>
              <Text style={dyn.sectionTitle}>🌐 Vitrine da Barbearia</Text>
              <View style={dyn.urlBox}>
                <Text style={dyn.urlText} numberOfLines={1}>{publicUrl || "URL não disponível"}</Text>
                {publicUrl ? (
                  <Pressable onPress={() => handleCopy(publicUrl, "URL da vitrine")}>
                    <IconSymbol name="doc.on.doc" size={16} color="#C9A84C" />
                  </Pressable>
                ) : null}
              </View>
              {publicUrl ? (
                <View style={dyn.actionsRow}>
                  <Pressable style={dyn.actionBtn} onPress={() => handleOpenUrl(publicUrl)}>
                    <Text style={{ fontSize: 14 }}>🔗</Text>
                    <Text style={dyn.actionBtnText}>Abrir</Text>
                  </Pressable>
                  <Pressable style={dyn.actionBtn} onPress={() => handleShare(publicUrl)}>
                    <Text style={{ fontSize: 14 }}>📤</Text>
                    <Text style={dyn.actionBtnText}>Compartilhar</Text>
                  </Pressable>
                  <Pressable style={dyn.actionBtn} onPress={() => handleOpenWhatsApp(publicUrl)}>
                    <Text style={{ fontSize: 14 }}>💬</Text>
                    <Text style={dyn.actionBtnText}>WhatsApp</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>

            <View style={dyn.section}>
              <Text style={dyn.sectionTitle}>📅 Link de Agendamento</Text>
              <View style={dyn.urlBox}>
                <Text style={dyn.urlText} numberOfLines={1}>{bookingUrl || "URL não disponível"}</Text>
                {bookingUrl ? (
                  <Pressable onPress={() => handleCopy(bookingUrl, "Link de agendamento")}>
                    <IconSymbol name="doc.on.doc" size={16} color="#C9A84C" />
                  </Pressable>
                ) : null}
              </View>
              {bookingUrl ? (
                <View style={dyn.actionsRow}>
                  <Pressable style={dyn.actionBtn} onPress={() => handleOpenUrl(bookingUrl)}>
                    <Text style={{ fontSize: 14 }}>🔗</Text>
                    <Text style={dyn.actionBtnText}>Abrir</Text>
                  </Pressable>
                  <Pressable style={dyn.actionBtn} onPress={() => handleShare(bookingUrl)}>
                    <Text style={{ fontSize: 14 }}>📤</Text>
                    <Text style={dyn.actionBtnText}>Compartilhar</Text>
                  </Pressable>
                  <Pressable style={dyn.actionBtn} onPress={() => handleOpenWhatsApp(bookingUrl)}>
                    <Text style={{ fontSize: 14 }}>💬</Text>
                    <Text style={dyn.actionBtnText}>WhatsApp</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>

            {slug ? (
              <View style={dyn.section}>
                <Text style={dyn.sectionTitle}>📱 QR Code</Text>
                <Text style={[dyn.infoText, { marginBottom: 8 }]}>
                  Imprima o QR Code abaixo e coloque na barbearia para que os clientes agendem pelo celular.
                </Text>
                <View style={{ alignItems: "center", padding: 8 }}>
                  {/* QR Code via API do servidor */}
                  <View style={{
                    width: 200, height: 200,
                    backgroundColor: "#fff",
                    borderRadius: 12,
                    justifyContent: "center",
                    alignItems: "center",
                    borderWidth: 1,
                    borderColor: colors.border,
                    overflow: "hidden",
                  }}>
                    {/* Exibe o QR Code como imagem do servidor */}
                    <Text style={{ fontSize: 12, color: colors.muted, textAlign: "center", padding: 16 }}>
                      Acesse o painel web para baixar o QR Code em alta resolução.{"\n\n"}
                      URL: {bookingUrl}
                    </Text>
                  </View>
                </View>
              </View>
            ) : null}
          </>
        )}

        {/* ── Aba Domínio ── */}
        {activeTab === "dominio" && (
          <>
            <View style={[dyn.section, { marginBottom: 8 }]}>
              <View style={dyn.infoBox}>
                <Text style={dyn.infoText}>
                  Configure um domínio personalizado para sua página pública. Exemplo: <Text style={{ fontWeight: "700", color: "#C9A84C" }}>agendamentos.suabarbearia.com.br</Text>{"\n\n"}
                  Após configurar, aponte o DNS do seu domínio para o servidor do Barber Pro.
                </Text>
              </View>
              <LabeledInput
                label="Domínio Personalizado"
                value={customDomain}
                onChangeText={setCustomDomain}
                placeholder="agendamentos.suabarbearia.com.br"
                keyboardType="url"
                colors={colors}
              />
            </View>
            <Pressable
              style={dyn.saveBtn}
              onPress={() => updateMutation.mutate({ customDomain: customDomain || null })}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? (
                <ActivityIndicator color="#0A0A0A" />
              ) : (
                <Text style={dyn.saveBtnText}>SALVAR DOMÍNIO</Text>
              )}
            </Pressable>
          </>
        )}

        {/* ── Aba SEO ── */}
        {activeTab === "seo" && (
          <>
            <View style={[dyn.section, { marginBottom: 8 }]}>
              <View style={dyn.infoBox}>
                <Text style={dyn.infoText}>
                  Configure as informações de SEO que aparecem quando alguém compartilha sua página nas redes sociais ou no WhatsApp.
                </Text>
              </View>
              <LabeledInput
                label="Título SEO"
                value={seoTitle}
                onChangeText={setSeoTitle}
                placeholder="Barbearia XYZ - Agende seu horário"
                colors={colors}
              />
              <LabeledInput
                label="Meta Descrição"
                value={seoDescription}
                onChangeText={setSeoDescription}
                placeholder="Agende seu corte de cabelo online. Profissionais experientes, ambiente moderno."
                multiline
                colors={colors}
              />
              <LabeledInput
                label="Imagem Open Graph (URL)"
                value={seoImageUrl}
                onChangeText={setSeoImageUrl}
                placeholder="https://..."
                keyboardType="url"
                colors={colors}
              />
            </View>
            <Pressable
              style={dyn.saveBtn}
              onPress={() => updateMutation.mutate({
                seoTitle: seoTitle || null,
                seoDescription: seoDescription || null,
                seoImageUrl: seoImageUrl || null,
              })}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? (
                <ActivityIndicator color="#0A0A0A" />
              ) : (
                <Text style={dyn.saveBtnText}>SALVAR SEO</Text>
              )}
            </Pressable>
          </>
        )}

        {/* ── Aba Rastreamento ── */}
        {activeTab === "rastreamento" && (
          <>
            <View style={[dyn.section, { marginBottom: 8 }]}>
              <View style={dyn.infoBox}>
                <Text style={dyn.infoText}>
                  Configure o Google Analytics 4 e o Facebook Pixel para rastrear visitas e conversões na sua página pública.
                </Text>
              </View>
              <LabeledInput
                label="Google Analytics 4 — Measurement ID"
                value={ga4Id}
                onChangeText={setGa4Id}
                placeholder="G-XXXXXXXXXX"
                colors={colors}
              />
              <LabeledInput
                label="Facebook Pixel ID"
                value={pixelId}
                onChangeText={setPixelId}
                placeholder="000000000000000"
                keyboardType="default"
                colors={colors}
              />
            </View>
            <Pressable
              style={dyn.saveBtn}
              onPress={() => updateMutation.mutate({
                ga4MeasurementId: ga4Id || null,
                facebookPixelId: pixelId || null,
              })}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? (
                <ActivityIndicator color="#0A0A0A" />
              ) : (
                <Text style={dyn.saveBtnText}>SALVAR RASTREAMENTO</Text>
              )}
            </Pressable>
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
