import { Alert, Share } from "react-native";

export async function exportCsv(csvContent: string, filename: string): Promise<void> {
  try {
    await Share.share({
      message: csvContent,
      title: filename,
    });
  } catch (e: any) {
    Alert.alert("Erro ao exportar", e.message ?? "Não foi possível exportar.");
  }
}
