import { useState, useEffect } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { AdminHeader } from "@/components/admin-header";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useThemeContext } from "@/lib/theme-provider";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {} from "react-native-safe-area-context";
import { useTabBarHeight } from "@/hooks/use-tab-bar-height";
import { useColors } from "@/hooks/use-colors";

type ThemeOption = "light" | "dark" | "system";

const THEME_OPTIONS: { key: ThemeOption; label: string; icon: string; description: string }[] = [
  { key: "light", label: "Claro", icon: "sun.max.fill", description: "Fundo branco, texto escuro" },
  { key: "dark", label: "Escuro", icon: "moon.fill", description: "Fundo escuro, texto claro" },
  { key: "system", label: "Sistema", icon: "gearshape.fill", description: "Segue a preferência do dispositivo" },
];

export default function SettingsScreen() {
  const colors = useColors();
  const styles = createStyles(colors);
  const tabBarHeight = useTabBarHeight();
  const { setColorScheme } = useThemeContext();
  const [themeOption, setThemeOption] = useState<ThemeOption>("system");

  useEffect(() => {
    AsyncStorage.getItem("@theme_preference").then((saved) => {
      if (saved === "light" || saved === "dark" || saved === "system") {
        setThemeOption(saved as ThemeOption);
      }
    });
  }, []);

  async function handleThemeChange(option: ThemeOption) {
    setThemeOption(option);
    await AsyncStorage.setItem("@theme_preference", option);
    const { Appearance } = await import("react-native");
    if (option === "system") {
      const sys = Appearance.getColorScheme() ?? "light";
      setColorScheme(sys as any);
    } else {
      setColorScheme(option as any);
    }
  }

  return (
    <ScreenContainer containerClassName="bg-background">
      <AdminHeader title="Configurações" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: tabBarHeight }}>

        {/* Aparência */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <IconSymbol name="paintbrush.fill" size={18} color="#C9A84C" />
            <Text style={styles.sectionTitle}>Aparência</Text>
          </View>
          <Text style={styles.sectionSubtitle}>Escolha o tema visual do painel administrativo.</Text>

          <View style={styles.themeGrid}>
            {THEME_OPTIONS.map((opt) => {
              const active = themeOption === opt.key;
              return (
                <Pressable
                  key={opt.key}
                  style={({ pressed }) => [styles.themeCard, active && styles.themeCardActive, pressed && { opacity: 0.8 }]}
                  onPress={() => handleThemeChange(opt.key)}
                >
                  <View style={[styles.themeIconBox, active && styles.themeIconBoxActive]}>
                    <IconSymbol name={opt.icon as any} size={22} color={active ? "#0A0A0A" : "#888880"} />
                  </View>
                  <Text style={[styles.themeLabel, active && styles.themeLabelActive]}>{opt.label}</Text>
                  <Text style={styles.themeDescription}>{opt.description}</Text>
                  {active && (
                    <View style={styles.themeCheck}>
                      <IconSymbol name="checkmark" size={12} color="#0A0A0A" />
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Versão */}
        <View style={styles.versionCard}>
          <IconSymbol name="info.circle.fill" size={16} color="#555" />
          <Text style={styles.versionText}>Barber Pro · Versão 3.6</Text>
        </View>

      </ScrollView>
    </ScreenContainer>
  );
}

function createStyles(c: ReturnType<typeof import("@/hooks/use-colors").useColors>) {
  return StyleSheet.create({
  section: { backgroundColor: c.surface, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: c.border },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: c.foreground },
  sectionSubtitle: { fontSize: 13, color: c.muted, marginBottom: 16, lineHeight: 18 },
  themeGrid: { gap: 10 },
  themeCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: c.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: c.border },
  themeCardActive: { backgroundColor: "#C9A84C", borderColor: "#C9A84C" },
  themeIconBox: { width: 40, height: 40, borderRadius: 10, backgroundColor: c.border, justifyContent: "center", alignItems: "center" },
  themeIconBoxActive: { backgroundColor: "#0A0A0A22" },
  themeLabel: { fontSize: 15, fontWeight: "700", color: c.foreground, flex: 1 },
  themeLabelActive: { color: "#0A0A0A" },
  themeDescription: { fontSize: 11, color: c.muted, position: "absolute", bottom: 10, right: 50, maxWidth: 120, textAlign: "right" },
  themeCheck: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#0A0A0A33", justifyContent: "center", alignItems: "center" },
  versionCard: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 20 },
  versionText: { fontSize: 12, color: "#444" },
});
}
