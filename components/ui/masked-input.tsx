import MaskInput, { Masks } from "react-native-mask-input";
import { StyleSheet, Text, View, type TextInputProps } from "react-native";
import { useColors } from "@/hooks/use-colors";

export type MaskType = "phone" | "cnpj" | "cpf" | "cep" | "date";

const MASK_MAP: Record<MaskType, (string | RegExp)[]> = {
  phone: Masks.BRL_PHONE,
  cnpj: Masks.BRL_CNPJ,
  cpf: Masks.BRL_CPF,
  cep: Masks.ZIP_CODE,
  date: [/\d/, /\d/, "/", /\d/, /\d/, "/", /\d/, /\d/, /\d/, /\d/],
};

interface MaskedInputProps extends Omit<TextInputProps, "onChangeText"> {
  mask: MaskType;
  label?: string;
  value: string;
  onChangeText: (masked: string, unmasked: string) => void;
  error?: string;
  containerStyle?: object;
}

export function MaskedInput({
  mask,
  label,
  value,
  onChangeText,
  error,
  containerStyle,
  style,
  ...props
}: MaskedInputProps) {
  const colors = useColors();

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Text style={[styles.label, { color: colors.muted }]}>{label}</Text>
      )}
      <MaskInput
        mask={MASK_MAP[mask]}
        value={value}
        onChangeText={onChangeText}
        keyboardType="numeric"
        placeholderTextColor={colors.muted}
        style={[
          styles.input,
          {
            backgroundColor: colors.surface,
            borderColor: error ? colors.error : colors.border,
            color: colors.foreground,
          },
          style,
        ]}
        {...props}
      />
      {error && (
        <Text style={[styles.error, { color: colors.error }]}>{error}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: "500",
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  error: {
    fontSize: 12,
  },
});
