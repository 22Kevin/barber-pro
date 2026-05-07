/**
 * Tela: Aparência da Página Pública
 *
 * Permite ao dono da barbearia personalizar:
 * - Cor primária (usada em botões, destaques e ícones da página pública)
 * - Banner/capa da página pública
 *
 * Acessível via Barbearia → aba Dados → botão "Aparência da Página Pública"
 */
import { useState, useEffect } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { trpc } from "@/lib/trpc";
import { SingleImageUploader } from "@/components/media-uploader";
import { useColors } from "@/hooks/use-colors";

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

export default function PageAppearanceScreen() {
  const colors = useColors();
  const styles = createStyles(colors);
  const router = useRouter();
  const utils = trpc.useUtils();

  const settingsQuery = trpc.settings.get.useQuery();
  const updateMutation = trpc.settings.update.useMutation({
    onSuccess: () => {
      utils.settings.get.invalidate();
      Alert.alert("Salvo!", "Aparência da página pública atualizada com sucesso.");
      router.back();
    },
    onError: (err) => Alert.alert("Erro", err.message),
  });

  const [primaryColor, setPrimaryColor] = useState("#C9A84C");
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [customColor, setCustomColor] = useState("");

  useEffect(() => {
    if (settingsQuery.data) {
      setPrimaryColor((settingsQuery.data as any).primaryColor ?? "#C9A84C");
      setBannerUrl((settingsQuery.data as any).bannerUrl ?? null);
    }
  }, [settingsQuery.data]);

  function handleSave() {
    const colorToSave = customColor.match(/^#[0-9A-Fa-f]{6}$/) ? customColor : primaryColor;
    updateMutation.mutate({ primaryColor: colorToSave, bannerUrl });
  }

  if (settingsQuery.isLoading) {
    return (
      <ScreenContainer>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color="#C9A84C" />
        </View>
      </ScreenContainer>
    );
  }

  const activeColor = customColor.match(/^#[0-9A-Fa-f]{6}$/) ? customColor : primaryColor;

  return (
    <ScreenContainer containerClassName="bg-background">
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]} onPress={() => router.back()}>
          <IconSymbol name="chevron.left" size={20} color="#C9A84C" />
        </Pressable>
        <Text style={styles.headerTitle}>Aparência da Página Pública</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        {/* Preview da cor */}
        <View style={[styles.previewCard, { borderColor: activeColor }]}>
          <View style={[styles.previewHeader, { backgroundColor: activeColor }]}>
            <Text style={styles.previewHeaderText}>Prévia da Cor Primária</Text>
          </View>
          <View style={styles.previewBody}>
            <View style={[styles.previewBtn, { backgroundColor: activeColor }]}>
              <Text style={styles.previewBtnText}>Agendar Agora</Text>
            </View>
            <Text style={[styles.previewPrice, { color: activeColor }]}>R$ 45,00</Text>
          </View>
        </View>

        {/* Cores predefinidas */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cor Primária</Text>
          <Text style={styles.sectionSub}>Usada em botões, preços e destaques da sua página pública.</Text>
          <View style={styles.colorGrid}>
            {PRESET_COLORS.map((c) => (
              <Pressable
                key={c.value}
                style={({ pressed }) => [
                  styles.colorChip,
                  { backgroundColor: c.value },
                  primaryColor === c.value && !customColor.match(/^#[0-9A-Fa-f]{6}$/) && styles.colorChipActive,
                  pressed && { opacity: 0.8 },
                ]}
                onPress={() => { setPrimaryColor(c.value); setCustomColor(""); }}
              >
                {primaryColor === c.value && !customColor.match(/^#[0-9A-Fa-f]{6}$/) && (
                  <IconSymbol name="checkmark" size={14} color="#fff" />
                )}
              </Pressable>
            ))}
          </View>

          {/* Cor personalizada */}
          <View style={styles.customColorRow}>
            <View style={[styles.customColorPreview, { backgroundColor: customColor.match(/^#[0-9A-Fa-f]{6}$/) ? customColor : "#2A2A2A" }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.customColorLabel}>Cor personalizada (hex)</Text>
              <View style={styles.customColorInput}>
                <Text style={styles.hashSymbol}>#</Text>
                <Text
                  style={styles.customColorText}
                  onPress={() => Alert.alert("Cor Hex", "Digite o código hexadecimal da cor (ex: C9A84C)")}
                >
                  {customColor.replace("#", "") || "ex: C9A84C"}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Banner */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Banner / Capa</Text>
          <Text style={styles.sectionSub}>Imagem exibida no topo da sua página pública. Recomendado: 1200×400px.</Text>
          <SingleImageUploader
            value={bannerUrl}
            onUpload={(url: string) => setBannerUrl(url)}
            imageType="gallery"
            label="Banner / Capa"
          />
          {bannerUrl && (
            <Pressable
              style={({ pressed }) => [styles.removeBtn, pressed && { opacity: 0.7 }]}
              onPress={() => setBannerUrl(null)}
            >
              <IconSymbol name="xmark.circle.fill" size={16} color="#F87171" />
              <Text style={styles.removeBtnText}>Remover banner</Text>
            </Pressable>
          )}
        </View>

        {/* Botão salvar */}
        <Pressable
          style={({ pressed }) => [styles.saveBtn, { backgroundColor: activeColor }, pressed && { opacity: 0.85 }]}
          onPress={handleSave}
          disabled={updateMutation.isPending}
        >
          {updateMutation.isPending ? (
            <ActivityIndicator color="#0A0A0A" size="small" />
          ) : (
            <Text style={styles.saveBtnText}>Salvar Aparência</Text>
          )}
        </Pressable>
      </ScrollView>
    </ScreenContainer>
  );
}

function createStyles(c: ReturnType<typeof import("@/hooks/use-colors").useColors>) {
  return StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: c.border },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.surface, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontWeight: "700", color: c.foreground },

  previewCard: { borderRadius: 16, borderWidth: 2, overflow: "hidden", marginBottom: 24 },
  previewHeader: { padding: 14 },
  previewHeaderText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  previewBody: { backgroundColor: c.surface, padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  previewBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10 },
  previewBtnText: { color: "#0A0A0A", fontWeight: "800", fontSize: 13 },
  previewPrice: { fontSize: 20, fontWeight: "900" },

  section: { backgroundColor: c.surface, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: c.border },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: c.foreground, marginBottom: 4 },
  sectionSub: { fontSize: 13, color: c.muted, marginBottom: 16, lineHeight: 18 },

  colorGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 16 },
  colorChip: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  colorChipActive: { borderWidth: 3, borderColor: "#fff" },

  customColorRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  customColorPreview: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: c.border },
  customColorLabel: { fontSize: 11, color: c.muted, marginBottom: 4 },
  customColorInput: { flexDirection: "row", alignItems: "center", backgroundColor: c.surface, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: c.border },
  hashSymbol: { color: c.muted, fontSize: 15, marginRight: 4 },
  customColorText: { color: c.foreground, fontSize: 15, flex: 1 },

  removeBtn: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 },
  removeBtnText: { color: "#F87171", fontSize: 13 },

  saveBtn: { borderRadius: 14, paddingVertical: 16, alignItems: "center", marginTop: 8 },
  saveBtnText: { color: "#0A0A0A", fontWeight: "800", fontSize: 16 },
});
}
