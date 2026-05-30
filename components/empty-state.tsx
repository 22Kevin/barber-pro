import { Pressable, StyleSheet, Text, View } from "react-native";
import { IconSymbol } from "@/components/ui/icon-symbol";

interface EmptyStateProps {
  emoji?: string;
  icon?: string;
  iconColor?: string;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  emoji,
  icon,
  iconColor = "#333",
  title,
  subtitle,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <View style={s.container}>
      {emoji ? (
        <Text style={s.emoji}>{emoji}</Text>
      ) : icon ? (
        <View style={[s.iconBox, { backgroundColor: iconColor + "18" }]}>
          <IconSymbol name={icon as any} size={36} color={iconColor} />
        </View>
      ) : null}
      <Text style={s.title}>{title}</Text>
      {subtitle && <Text style={s.subtitle}>{subtitle}</Text>}
      {actionLabel && onAction && (
        <Pressable
          style={({ pressed }) => [s.btn, pressed && { opacity: 0.8 }]}
          onPress={onAction}
        >
          <Text style={s.btnText}>{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1, alignItems: "center", justifyContent: "center",
    paddingVertical: 48, paddingHorizontal: 32,
  },
  emoji:    { fontSize: 52, marginBottom: 16 },
  iconBox:  { width: 72, height: 72, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  title:    { fontSize: 17, fontWeight: "700", color: "#E5E5E5", textAlign: "center", marginBottom: 8 },
  subtitle: { fontSize: 14, color: "#666", textAlign: "center", lineHeight: 20, marginBottom: 20 },
  btn: {
    backgroundColor: "#C9A84C22", borderWidth: 1, borderColor: "#C9A84C55",
    borderRadius: 12, paddingHorizontal: 20, paddingVertical: 11,
  },
  btnText: { fontSize: 14, color: "#C9A84C", fontWeight: "700" },
});
