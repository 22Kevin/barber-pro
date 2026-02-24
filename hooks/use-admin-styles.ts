import { useMemo } from "react";
import { StyleSheet } from "react-native";
import { useColors } from "./use-colors";

/**
 * Hook que retorna estilos dinâmicos para o painel admin,
 * adaptando-se automaticamente ao tema claro/escuro.
 *
 * Uso:
 * ```tsx
 * const adminStyles = useAdminStyles();
 * <View style={adminStyles.card}>...</View>
 * ```
 */
export function useAdminStyles() {
  const colors = useColors();

  return useMemo(
    () =>
      StyleSheet.create({
        // Containers
        screen: {
          flex: 1,
          backgroundColor: colors.background,
        },
        card: {
          backgroundColor: colors.surface,
          borderRadius: 14,
          padding: 14,
          marginBottom: 10,
          borderWidth: 1,
          borderColor: colors.border,
        },
        cardLarge: {
          backgroundColor: colors.surface,
          borderRadius: 16,
          padding: 20,
          marginBottom: 12,
          borderWidth: 1,
          borderColor: colors.border,
        },
        modalCard: {
          backgroundColor: colors.surface,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          padding: 24,
          width: "100%",
          maxHeight: "90%",
          borderWidth: 1,
          borderColor: colors.border,
        },
        section: {
          backgroundColor: colors.surface,
          borderRadius: 12,
          padding: 16,
          marginBottom: 12,
          borderWidth: 1,
          borderColor: colors.border,
        },

        // Inputs
        input: {
          backgroundColor: colors.background,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 10,
          paddingHorizontal: 14,
          paddingVertical: 12,
          fontSize: 15,
          color: colors.foreground,
        },
        inputFocused: {
          backgroundColor: colors.background,
          borderWidth: 1,
          borderColor: colors.primary,
          borderRadius: 10,
          paddingHorizontal: 14,
          paddingVertical: 12,
          fontSize: 15,
          color: colors.foreground,
        },
        searchRow: {
          flexDirection: "row",
          alignItems: "center",
          marginHorizontal: 16,
          backgroundColor: colors.surface,
          borderRadius: 10,
          paddingHorizontal: 12,
          paddingVertical: 10,
          borderWidth: 1,
          borderColor: colors.border,
          gap: 8,
          marginBottom: 4,
        },

        // Texto
        title: {
          fontSize: 22,
          fontWeight: "700",
          color: colors.foreground,
        },
        subtitle: {
          fontSize: 16,
          fontWeight: "600",
          color: colors.foreground,
        },
        label: {
          fontSize: 13,
          color: colors.muted,
          marginBottom: 6,
          fontWeight: "500",
          letterSpacing: 0.5,
        },
        bodyText: {
          fontSize: 14,
          color: colors.foreground,
        },
        mutedText: {
          fontSize: 13,
          color: colors.muted,
        },

        // Chips e badges
        chip: {
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          backgroundColor: colors.background,
          borderRadius: 6,
          paddingHorizontal: 8,
          paddingVertical: 4,
        },
        chipPrimary: {
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          backgroundColor: colors.primary + "22",
          borderRadius: 6,
          paddingHorizontal: 8,
          paddingVertical: 4,
        },

        // Botões
        btnPrimary: {
          backgroundColor: colors.primary,
          borderRadius: 12,
          paddingVertical: 14,
          alignItems: "center",
          justifyContent: "center",
        },
        btnSecondary: {
          backgroundColor: colors.surface,
          borderRadius: 12,
          paddingVertical: 14,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 1,
          borderColor: colors.border,
        },
        btnDanger: {
          backgroundColor: colors.error + "22",
          borderRadius: 12,
          paddingVertical: 14,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 1,
          borderColor: colors.error + "44",
        },
        btnPrimaryText: {
          color: colors.background,
          fontSize: 15,
          fontWeight: "700",
          letterSpacing: 0.5,
        },
        btnSecondaryText: {
          color: colors.foreground,
          fontSize: 15,
          fontWeight: "600",
        },
        btnDangerText: {
          color: colors.error,
          fontSize: 15,
          fontWeight: "600",
        },

        // Separadores
        divider: {
          height: 1,
          backgroundColor: colors.border,
          marginVertical: 12,
        },

        // Ícone container
        iconBox: {
          width: 40,
          height: 40,
          borderRadius: 10,
          backgroundColor: colors.primary + "22",
          alignItems: "center",
          justifyContent: "center",
        },

        // Overlay de modal
        overlay: {
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.6)",
          justifyContent: "flex-end",
        },

        // Duration/Time picker button
        pickerButton: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: colors.background,
          borderWidth: 1,
          borderColor: colors.primary,
          borderRadius: 10,
          paddingHorizontal: 16,
          paddingVertical: 14,
          marginTop: 4,
        },

        // Header row
        headerRow: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 16,
          paddingVertical: 12,
        },
      }),
    [colors]
  );
}
