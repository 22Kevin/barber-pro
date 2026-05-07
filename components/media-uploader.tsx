import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  Image,
  ScrollView,
  Alert,
  ActivityIndicator,
  StyleSheet,
  Modal,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { trpc } from "@/lib/trpc";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";

interface MediaFile {
  id?: number;
  url: string;
  type: "image" | "video";
}

interface MediaUploaderProps {
  entityType: "service" | "product";
  entityId: number;
  existingMedia?: MediaFile[];
  onMediaChange?: (media: MediaFile[]) => void;
  maxItems?: number;
}

export function MediaUploader({
  entityType,
  entityId,
  existingMedia = [],
  onMediaChange,
  maxItems = 10,
}: MediaUploaderProps) {
  const colors = useColors();
  const styles = createStyles(colors);
  const [media, setMedia] = useState<MediaFile[]>(existingMedia);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const uploadMutation = trpc.upload.media.useMutation();

  const deleteMediaMutation = trpc.upload.media.useMutation();

  async function pickImage() {
    if (media.length >= maxItems) {
      Alert.alert("Limite atingido", `Máximo de ${maxItems} arquivos permitidos.`);
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permissão necessária", "Precisamos de acesso à galeria para fazer upload.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      if (!asset.base64) {
        Alert.alert("Erro", "Não foi possível ler o arquivo.");
        return;
      }
      setUploading(true);
      const isVideo = asset.type === "video";
      const mimeType = isVideo ? "video/mp4" : (asset.mimeType ?? "image/jpeg");
      uploadMutation.mutate(
        {
          entityType,
          entityId,
          fileBase64: asset.base64,
          mimeType,
          mediaType: isVideo ? "video" : "image",
          order: media.length,
        },
        {
          onSuccess: (data: any, variables: any) => {
            const newFile: MediaFile = { url: data.url, type: variables.mediaType };
            const updated = [...media, newFile];
            setMedia(updated);
            onMediaChange?.(updated);
            setUploading(false);
          },
          onError: (err: any) => {
            setUploading(false);
            Alert.alert("Erro no upload", err.message);
          },
        }
      );
    }
  }

  async function removeMedia(index: number) {
    Alert.alert("Remover mídia", "Deseja remover este arquivo?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Remover",
        style: "destructive",
        onPress: () => {
          const updated = media.filter((_, i) => i !== index);
          setMedia(updated);
          onMediaChange?.(updated);
        },
      },
    ]);
  }

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll}>
        {media.map((item, index) => (
          <Pressable key={index} onPress={() => setPreviewUrl(item.url)} style={styles.mediaItem}>
            <Image source={{ uri: item.url }} style={styles.thumbnail} resizeMode="cover" />
            {item.type === "video" && (
              <View style={styles.videoOverlay}>
                <Text style={styles.videoIcon}>▶</Text>
              </View>
            )}
            <Pressable style={styles.removeBtn} onPress={() => removeMedia(index)}>
              <Text style={styles.removeBtnText}>✕</Text>
            </Pressable>
          </Pressable>
        ))}

        {media.length < maxItems && (
          <Pressable
            style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.7 }]}
            onPress={pickImage}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator color="#C9A84C" />
            ) : (
              <>
                <Text style={styles.addIcon}>+</Text>
                <Text style={styles.addText}>Foto/Vídeo</Text>
              </>
            )}
          </Pressable>
        )}
      </ScrollView>

      {/* Preview Modal */}
      <Modal visible={!!previewUrl} transparent animationType="fade" onRequestClose={() => setPreviewUrl(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setPreviewUrl(null)}>
          <Image source={{ uri: previewUrl ?? "" }} style={styles.previewImage} resizeMode="contain" />
          <Pressable style={styles.closeBtn} onPress={() => setPreviewUrl(null)}>
            <Text style={styles.closeBtnText}>✕</Text>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// ─── Upload de Imagem Única (para logo/galeria da barbearia) ──────────────────
interface SingleImageUploaderProps {
  value?: string | null;
  onUpload: (url: string) => void;
  imageType: "logo" | "gallery";
  label?: string;
  size?: number;
}

export function SingleImageUploader({ value, onUpload, imageType, label = "Foto", size = 100 }: SingleImageUploaderProps) {
  const colors = useColors();
  const styles = createStyles(colors);
  const [uploading, setUploading] = useState(false);

  const uploadMutation = trpc.upload.shopImage.useMutation();

  async function pickImage() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permissão necessária", "Precisamos de acesso à galeria.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: imageType === "logo" ? [1, 1] : [4, 3],
      quality: 0.85,
      base64: true,
    });

    if (!result.canceled && result.assets[0]?.base64) {
      setUploading(true);
      const asset = result.assets[0];
      uploadMutation.mutate(
        {
          fileBase64: asset.base64!,
          mimeType: asset.mimeType ?? "image/jpeg",
          imageType,
        },
        {
          onSuccess: (data: any) => {
            onUpload(data.url);
            setUploading(false);
          },
          onError: (err: any) => {
            setUploading(false);
            Alert.alert("Erro no upload", err.message);
          },
        }
      );
    }
  }

  return (
    <Pressable
      style={({ pressed }) => [
        styles.singleUpload,
        { width: size, height: size, borderRadius: imageType === "logo" ? size / 2 : 12 },
        pressed && { opacity: 0.8 },
      ]}
      onPress={pickImage}
      disabled={uploading}
    >
      {uploading ? (
        <ActivityIndicator color="#C9A84C" />
      ) : value ? (
        <Image
          source={{ uri: value }}
          style={{ width: size, height: size, borderRadius: imageType === "logo" ? size / 2 : 12 }}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.singleUploadPlaceholder}>
          <Text style={styles.singleUploadIcon}>📷</Text>
          <Text style={styles.singleUploadLabel}>{label}</Text>
        </View>
      )}
      <View style={styles.editBadge}>
        <Text style={styles.editBadgeText}>✎</Text>
      </View>
    </Pressable>
  );
}

function createStyles(c: ReturnType<typeof import("@/hooks/use-colors").useColors>) {
  return StyleSheet.create({
  scroll: { marginVertical: 8 },
  mediaItem: { marginRight: 10, position: "relative" },
  thumbnail: { width: 90, height: 90, borderRadius: 10, backgroundColor: c.surface },
  videoOverlay: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.4)", borderRadius: 10,
  },
  videoIcon: { fontSize: 24, color: "#fff" },
  removeBtn: {
    position: "absolute", top: -6, right: -6,
    backgroundColor: "#EF4444", borderRadius: 10,
    width: 20, height: 20, alignItems: "center", justifyContent: "center",
  },
  removeBtnText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  addBtn: {
    width: 90, height: 90, borderRadius: 10,
    borderWidth: 1.5, borderColor: "#C9A84C44", borderStyle: "dashed",
    alignItems: "center", justifyContent: "center", backgroundColor: c.surface,
  },
  addIcon: { fontSize: 24, color: "#C9A84C" },
  addText: { fontSize: 10, color: c.muted, marginTop: 2 },
  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.95)",
    alignItems: "center", justifyContent: "center",
  },
  previewImage: { width: "95%", height: "80%" },
  closeBtn: {
    position: "absolute", top: 50, right: 20,
    backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 20,
    width: 40, height: 40, alignItems: "center", justifyContent: "center",
  },
  closeBtnText: { color: "#fff", fontSize: 18, fontWeight: "700" },
  singleUpload: {
    backgroundColor: c.surface, borderWidth: 1.5,
    borderColor: "#C9A84C44", borderStyle: "dashed",
    alignItems: "center", justifyContent: "center",
    overflow: "hidden",
  },
  singleUploadPlaceholder: { alignItems: "center", gap: 4 },
  singleUploadIcon: { fontSize: 22 },
  singleUploadLabel: { fontSize: 11, color: c.muted },
  editBadge: {
    position: "absolute", bottom: 4, right: 4,
    backgroundColor: "#C9A84C", borderRadius: 10,
    width: 20, height: 20, alignItems: "center", justifyContent: "center",
  },
  editBadgeText: { color: "#000", fontSize: 11, fontWeight: "700" },
});
}
