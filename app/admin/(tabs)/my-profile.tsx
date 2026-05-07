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
import MaskInput, { Masks } from "react-native-mask-input";
import { useTabBarHeight } from "@/hooks/use-tab-bar-height";
import { useColors } from "@/hooks/use-colors";

const ROLES: Record<string, string> = {
  super_admin: "Super Admin",
  barber: "Barbeiro",
  receptionist: "Recepcionista",
};



export default function MyProfileScreen() {
  const colors = useColors();
  const styles = createStyles(colors);
  const tabBarHeight = useTabBarHeight();
  const { barber, logout, updateBarber } = useBarberAuth();
  const utils = trpc.useUtils();

  const [name, setName] = useState(barber?.name ?? "");
  const [phone, setPhone] = useState(barber?.phone ?? "");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: tabBarHeight }} keyboardShouldPersistTaps="handled">

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
            <MaskInput
              mask={Masks.BRL_PHONE}
              style={styles.input}
              value={phone}
              onChangeText={(masked) => setPhone(masked)}
              placeholder="(11) 99999-9999"
              placeholderTextColor="#555"
              keyboardType="numeric"
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
                  <View style={[styles.input, { flexDirection: "row", alignItems: "center", paddingVertical: 0 }]}>
                    <TextInput style={{ flex: 1, color: "#F5F5F0", fontSize: 15, paddingVertical: 12 }} value={newPassword} onChangeText={setNewPassword} placeholder="Mínimo 6 caracteres" placeholderTextColor="#555" secureTextEntry={!showNewPassword} autoCapitalize="none" />
                    <Pressable onPress={() => setShowNewPassword((v) => !v)} hitSlop={8} style={{ paddingLeft: 8 }}>
                      <IconSymbol name={showNewPassword ? "eye.slash.fill" : "eye.fill"} size={18} color="#888" />
                    </Pressable>
                  </View>
                </View>
                <View>
                  <Text style={styles.fieldLabel}>Confirmar Nova Senha</Text>
                  <View style={[styles.input, { flexDirection: "row", alignItems: "center", paddingVertical: 0 }]}>
                    <TextInput style={{ flex: 1, color: "#F5F5F0", fontSize: 15, paddingVertical: 12 }} value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Repita a nova senha" placeholderTextColor="#555" secureTextEntry={!showConfirmPassword} autoCapitalize="none" />
                    <Pressable onPress={() => setShowConfirmPassword((v) => !v)} hitSlop={8} style={{ paddingLeft: 8 }}>
                      <IconSymbol name={showConfirmPassword ? "eye.slash.fill" : "eye.fill"} size={18} color="#888" />
                    </Pressable>
                  </View>
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

function createStyles(c: ReturnType<typeof import("@/hooks/use-colors").useColors>) {
  return StyleSheet.create({
  avatarSection: { alignItems: "center", paddingVertical: 24, gap: 8 },
  avatarWrapper: { position: "relative", width: 96, height: 96 },
  avatarImage: { width: 96, height: 96, borderRadius: 48, borderWidth: 2, borderColor: "#C9A84C" },
  avatarPlaceholder: { width: 96, height: 96, borderRadius: 48, backgroundColor: "#C9A84C22", justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: "#C9A84C" },
  avatarText: { fontSize: 36, fontWeight: "800", color: "#C9A84C" },
  avatarOverlay: { position: "absolute", inset: 0, borderRadius: 48, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" },
  avatarEditBadge: { position: "absolute", bottom: 2, right: 2, width: 26, height: 26, borderRadius: 13, backgroundColor: "#C9A84C", justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: "#0A0A0A" },
  roleBadge: { backgroundColor: "#C9A84C22", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 4, borderWidth: 1, borderColor: "#C9A84C44", color: "#C9A84C", fontSize: 12, fontWeight: "700" },
  emailText: { fontSize: 13, color: c.muted },
  photoHint: { fontSize: 11, color: c.muted, marginTop: -2 },
  card: { backgroundColor: c.surface, borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: c.border, gap: 4 },
  cardTitle: { fontSize: 15, fontWeight: "700", color: c.foreground, marginBottom: 12 },
  fieldLabel: { fontSize: 13, color: c.muted, marginBottom: 6, fontWeight: "500" },
  input: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: c.foreground, marginBottom: 4 },
  inputDisabled: { backgroundColor: "#111", borderWidth: 1, borderColor: c.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  inputDisabledText: { fontSize: 15, color: c.muted },
  hintText: { fontSize: 11, color: "#444", marginBottom: 4 },
  passwordToggle: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  saveBtn: { backgroundColor: "#C9A84C", borderRadius: 12, paddingVertical: 15, alignItems: "center", marginBottom: 12 },
  saveBtnText: { color: "#0A0A0A", fontSize: 15, fontWeight: "800", letterSpacing: 1 },
  logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: "#EF444444", backgroundColor: "#EF444411" },
  logoutText: { color: "#EF4444", fontSize: 15, fontWeight: "700" },
});
}
