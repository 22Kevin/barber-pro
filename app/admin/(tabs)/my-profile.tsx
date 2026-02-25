import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
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

/** Aplica máscara de telefone: (99) 99999-9999 ou (99) 9999-9999 */
function applyPhoneMask(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : "";
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export default function MyProfileScreen() {
  const { barber, logout, updateBarber } = useBarberAuth();
  const utils = trpc.useUtils();

  const [name, setName] = useState(barber?.name ?? "");
  const [phone, setPhone] = useState(applyPhoneMask(barber?.phone ?? ""));
  const [photoUrl, setPhotoUrl] = useState<string | null>(barber?.photoUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassSection, setShowPassSection] = useState(false);

  const uploadMutation = trpc.upload.profilePhoto.useMutation({
    onSuccess: (data: { url: string }) => {
      setPhotoUrl(data.url);
      setUploading(false);
    },
    onError: (e: any) => {
      setUploading(false);
      Alert.alert("Erro", "Não foi possível enviar a foto: " + e.message);
    },
  });

  const updateMutation = trpc.barbers.update.useMutation({
    onSuccess: () => {
      utils.barbers.list.invalidate();
      updateBarber({ name: name.trim(), phone: phone.replace(/\D/g, ""), photoUrl });
      Alert.alert("Sucesso", "Perfil atualizado com sucesso!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowPassSection(false);
    },
    onError: (e: any) => Alert.alert("Erro", e.message),
  });

  async function pickPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permissão necessária", "Permita o acesso à galeria para escolher uma foto.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      if (!asset.base64) { Alert.alert("Erro", "Não foi possível ler a imagem."); return; }
      setUploading(true);
      uploadMutation.mutate({
        fileBase64: asset.base64,
        mimeType: asset.mimeType ?? "image/jpeg",
      });
    }
  }

  async function takePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permissão necessária", "Permita o acesso à câmera para tirar uma foto.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      if (!asset.base64) { Alert.alert("Erro", "Não foi possível ler a imagem."); return; }
      setUploading(true);
      uploadMutation.mutate({
        fileBase64: asset.base64,
        mimeType: asset.mimeType ?? "image/jpeg",
      });
    }
  }

  function showPhotoOptions() {
    Alert.alert("Foto de Perfil", "Como deseja adicionar sua foto?", [
      { text: "Câmera", onPress: takePhoto },
      { text: "Galeria", onPress: pickPhoto },
      photoUrl ? { text: "Remover foto", style: "destructive", onPress: () => setPhotoUrl(null) } : null,
      { text: "Cancelar", style: "cancel" },
    ].filter(Boolean) as any[]);
  }

  function handleSave() {
    if (!name.trim()) { Alert.alert("Atenção", "O nome não pode estar vazio."); return; }
    if (showPassSection) {
      if (!newPassword || newPassword.length < 6) { Alert.alert("Atenção", "A nova senha deve ter pelo menos 6 caracteres."); return; }
      if (newPassword !== confirmPassword) { Alert.alert("Atenção", "As senhas não coincidem."); return; }
    }
    const data: any = { id: barber!.id, name: name.trim(), photoUrl: photoUrl ?? null };
    const rawPhone = phone.replace(/\D/g, "");
    if (rawPhone) data.phone = rawPhone;
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

          {/* Avatar com botão de editar */}
          <View style={styles.avatarSection}>
            <Pressable style={styles.avatarWrapper} onPress={showPhotoOptions}>
              {photoUrl ? (
                <Image source={{ uri: photoUrl }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarText}>{initials}</Text>
                </View>
              )}
              {uploading ? (
                <View style={styles.avatarOverlay}>
                  <ActivityIndicator color="#C9A84C" />
                </View>
              ) : (
                <View style={styles.avatarEditBadge}>
                  <IconSymbol name="camera.fill" size={12} color="#0A0A0A" />
                </View>
              )}
            </Pressable>
            <Text style={styles.roleBadge}>{roleLabel}</Text>
            {barber?.email ? <Text style={styles.emailText}>{barber.email}</Text> : null}
            <Text style={styles.photoHint}>Toque na foto para alterar</Text>
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
              onChangeText={(t) => setPhone(applyPhoneMask(t))}
              placeholder="(11) 99999-9999"
              placeholderTextColor="#555"
              keyboardType="phone-pad"
              maxLength={15}
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
          <Pressable style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.8 }]} onPress={handleSave} disabled={updateMutation.isPending || uploading}>
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
  avatarWrapper: { position: "relative", width: 96, height: 96 },
  avatarImage: { width: 96, height: 96, borderRadius: 48, borderWidth: 2, borderColor: "#C9A84C" },
  avatarPlaceholder: { width: 96, height: 96, borderRadius: 48, backgroundColor: "#C9A84C22", justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: "#C9A84C" },
  avatarText: { fontSize: 36, fontWeight: "800", color: "#C9A84C" },
  avatarOverlay: { position: "absolute", inset: 0, borderRadius: 48, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" },
  avatarEditBadge: { position: "absolute", bottom: 2, right: 2, width: 26, height: 26, borderRadius: 13, backgroundColor: "#C9A84C", justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: "#0A0A0A" },
  roleBadge: { backgroundColor: "#C9A84C22", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 4, borderWidth: 1, borderColor: "#C9A84C44", color: "#C9A84C", fontSize: 12, fontWeight: "700" },
  emailText: { fontSize: 13, color: "#888880" },
  photoHint: { fontSize: 11, color: "#555", marginTop: -2 },
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
