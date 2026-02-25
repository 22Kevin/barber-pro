import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { AdminHeader } from "@/components/admin-header";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useBarberAuth } from "@/lib/auth-context";
import { trpc } from "@/lib/trpc";

const ROLES: Record<string, string> = {
  super_admin: "Super Admin",
  barber: "Barbeiro",
  receptionist: "Recepcionista",
};

export default function MyProfileScreen() {
  const { barber, logout } = useBarberAuth();
  const utils = trpc.useUtils();

  const [name, setName] = useState(barber?.name ?? "");
  const [phone, setPhone] = useState(barber?.phone ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassSection, setShowPassSection] = useState(false);

  const updateMutation = trpc.barbers.update.useMutation({
    onSuccess: () => {
      utils.barbers.list.invalidate();
      Alert.alert("Sucesso", "Perfil atualizado com sucesso!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowPassSection(false);
    },
    onError: (e: any) => Alert.alert("Erro", e.message),
  });

  function handleSave() {
    if (!name.trim()) { Alert.alert("Atenção", "O nome não pode estar vazio."); return; }
    if (showPassSection) {
      if (!newPassword || newPassword.length < 6) { Alert.alert("Atenção", "A nova senha deve ter pelo menos 6 caracteres."); return; }
      if (newPassword !== confirmPassword) { Alert.alert("Atenção", "As senhas não coincidem."); return; }
    }
    const data: any = { id: barber!.id, name: name.trim() };
    if (phone.trim()) data.phone = phone.trim();
    if (showPassSection && newPassword) data.password = newPassword;
    updateMutation.mutate(data);
  }

  const initials = (barber?.name ?? "?").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  const roleLabel = ROLES[barber?.role ?? ""] ?? barber?.role ?? "";

  return (
    <ScreenContainer containerClassName="bg-background">
      <AdminHeader title="Meu Perfil" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 80 }} keyboardShouldPersistTaps="handled">

          {/* Avatar */}
          <View style={styles.avatarSection}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <Text style={styles.roleBadge}>{roleLabel}</Text>
            {barber?.email ? <Text style={styles.emailText}>{barber.email}</Text> : null}
          </View>

          {/* Dados pessoais */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Dados Pessoais</Text>

            <Text style={styles.fieldLabel}>Nome completo</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Seu nome"
              placeholderTextColor="#555"
              autoCapitalize="words"
            />

            <Text style={styles.fieldLabel}>Telefone</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="(11) 99999-9999"
              placeholderTextColor="#555"
              keyboardType="phone-pad"
            />

            {barber?.email ? (
              <>
                <Text style={styles.fieldLabel}>E-mail</Text>
                <View style={styles.inputDisabled}>
                  <Text style={styles.inputDisabledText}>{barber.email}</Text>
                  <IconSymbol name="lock.fill" size={14} color="#555" />
                </View>
                <Text style={styles.hintText}>O e-mail não pode ser alterado por aqui.</Text>
              </>
            ) : null}
          </View>

          {/* Alterar senha */}
          <View style={styles.card}>
            <Pressable style={styles.passwordToggle} onPress={() => setShowPassSection(!showPassSection)}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <IconSymbol name="lock.fill" size={18} color="#C9A84C" />
                <Text style={styles.cardTitle}>Alterar Senha</Text>
              </View>
              <IconSymbol name={showPassSection ? "chevron.up" : "chevron.down"} size={16} color="#888880" />
            </Pressable>

            {showPassSection && (
              <View style={{ marginTop: 16, gap: 14 }}>
                <View>
                  <Text style={styles.fieldLabel}>Nova Senha</Text>
                  <TextInput style={styles.input} value={newPassword} onChangeText={setNewPassword} placeholder="Mínimo 6 caracteres" placeholderTextColor="#555" secureTextEntry autoCapitalize="none" />
                </View>
                <View>
                  <Text style={styles.fieldLabel}>Confirmar Nova Senha</Text>
                  <TextInput style={styles.input} value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Repita a nova senha" placeholderTextColor="#555" secureTextEntry autoCapitalize="none" />
                </View>
              </View>
            )}
          </View>

          {/* Botão salvar */}
          <Pressable style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.8 }]} onPress={handleSave} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? <ActivityIndicator color="#0A0A0A" /> : <Text style={styles.saveBtnText}>SALVAR ALTERAÇÕES</Text>}
          </Pressable>

          {/* Sair */}
          <Pressable
            style={({ pressed }) => [styles.logoutBtn, pressed && { opacity: 0.7 }]}
            onPress={() => Alert.alert("Sair", "Deseja realmente sair?", [
              { text: "Cancelar", style: "cancel" },
              { text: "Sair", style: "destructive", onPress: logout },
            ])}
          >
            <IconSymbol name="rectangle.portrait.and.arrow.right" size={18} color="#EF4444" />
            <Text style={styles.logoutText}>Sair da conta</Text>
          </Pressable>

        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  avatarSection: { alignItems: "center", paddingVertical: 24, gap: 8 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: "#C9A84C22", justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: "#C9A84C" },
  avatarText: { fontSize: 32, fontWeight: "800", color: "#C9A84C" },
  roleBadge: { backgroundColor: "#C9A84C22", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 4, borderWidth: 1, borderColor: "#C9A84C44", color: "#C9A84C", fontSize: 12, fontWeight: "700" },
  emailText: { fontSize: 13, color: "#888880" },
  card: { backgroundColor: "#141414", borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: "#2A2A2A", gap: 4 },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#F5F5F0", marginBottom: 12 },
  fieldLabel: { fontSize: 13, color: "#888880", marginBottom: 6, fontWeight: "500" },
  input: { backgroundColor: "#1A1A1A", borderWidth: 1, borderColor: "#2A2A2A", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: "#F5F5F0", marginBottom: 4 },
  inputDisabled: { backgroundColor: "#111", borderWidth: 1, borderColor: "#2A2A2A", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  inputDisabledText: { fontSize: 15, color: "#555" },
  hintText: { fontSize: 11, color: "#444", marginBottom: 4 },
  passwordToggle: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  saveBtn: { backgroundColor: "#C9A84C", borderRadius: 12, paddingVertical: 15, alignItems: "center", marginBottom: 12 },
  saveBtnText: { color: "#0A0A0A", fontSize: 15, fontWeight: "800", letterSpacing: 1 },
  logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: "#EF444444", backgroundColor: "#EF444411" },
  logoutText: { color: "#EF4444", fontSize: 15, fontWeight: "700" },
});
