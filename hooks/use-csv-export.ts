/**
 * useCsvExport — utilitário para exportar dados como CSV no app mobile.
 * No mobile, usa Share para compartilhar o arquivo CSV.
 * Na web, faz download direto.
 */
import { Alert, Platform, Share } from "react-native";
import * as FileSystem from "expo-file-system/legacy";

export async function exportCsv(csvContent: string, filename: string): Promise<void> {
  try {
    if (Platform.OS === "web") {
      // Web: download direto
      const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      // Mobile: salva em arquivo temporário e compartilha
      const fileUri = `${FileSystem.cacheDirectory}${filename}`;
      await FileSystem.writeAsStringAsync(fileUri, "\uFEFF" + csvContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      await Share.share({
        url: fileUri,
        title: filename,
        message: `Exportação: ${filename}`,
      });
    }
  } catch (err: any) {
    Alert.alert("Erro ao exportar", err?.message ?? "Não foi possível exportar o arquivo.");
  }
}
