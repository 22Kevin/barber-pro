import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { AdminHeader } from "@/components/admin-header";
import { AppAlert } from "@/components/app-alert";
import { trpc } from "@/lib/trpc";

let GoogleSignin: any = null;
let statusCodes: any = null;
try {
  const mod = require("@react-native-google-signin/google-signin");
  GoogleSignin = mod.GoogleSignin;
  statusCodes = mod.statusCodes;
} catch {}

const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "";
const IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "";
// Precisa dos DOIS escopos: calendar.events (gerenciar eventos) e
// calendar.app.created (criar o calendário dedicado "Barber Pro" em si).
// O fluxo web já pedia os dois (server/google-calendar.ts) - esse aqui
// (fluxo nativo do app) só pedia calendar.events, causando "insufficient
// authentication scopes" ao tentar criar o calendário.
const CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.app.created",
];

const GOLD = "#C9A84C";
const BG = "#0A0A0A";
const SURFACE = "#111111";
const BORDER = "#2A2A2A";
const MUTED = "#9BA1A6";
const TEXT = "#ECEDEE";
const GREEN = "#4ADE80";
const RED = "#F87171";

export default function IntegracoesScreen() {
  const [connecting, setConnecting] = useState(false);

  const statusQuery = trpc.barbers.googleCalendarStatus.useQuery();
  const connectMutation = trpc.barbers.connectGoogleCalendarNative.useMutation({
    onSuccess: () => {
      statusQuery.refetch();
      AppAlert.alert("Conectado!", "Sua Google Agenda foi conectada. Seus agendamentos vão aparecer automaticamente lá, num calendário chamado \"Barber Pro\".");
    },
    onError: (e) => AppAlert.alert("Erro ao conectar", e.message ?? "Tente novamente."),
  });
  const disconnectMutation = trpc.barbers.disconnectGoogleCalendar.useMutation({
    onSuccess: () => statusQuery.refetch(),
    onError: (e) => AppAlert.alert("Erro ao desconectar", e.message ?? "Tente novamente."),
  });
  const importMutation = trpc.barbers.importGoogleCalendarEvents.useMutation({
    onSuccess: (result) => {
      statusQuery.refetch();
      AppAlert.alert(
        "Importação concluída",
        `${result.imported} compromisso(s) importado(s) como bloqueio de horário${result.skipped > 0 ? ` (${result.skipped} já existiam ou não puderam ser importados)` : ""}.`
      );
    },
    onError: (e) => AppAlert.alert("Erro ao importar", e.message ?? "Tente novamente."),
  });

  async function handleConnect() {
    if (!GoogleSignin || !WEB_CLIENT_ID) {
      AppAlert.alert("Indisponível", "A integração com Google Agenda não está configurada neste app no momento.");
      return;
    }
    setConnecting(true);
    try {
      await GoogleSignin.hasPlayServices();
      // Configuração específica desta tela: pede acesso offline (necessário
      // para o servidor conseguir sincronizar mesmo com o app fechado) e o
      // escopo de Agenda. Isso NÃO afeta o login normal do app (que usa
      // offlineAccess:false e sem esse escopo, configurado separadamente
      // na tela de login).
      await GoogleSignin.configure({
        webClientId: WEB_CLIENT_ID,
        iosClientId: IOS_CLIENT_ID || undefined,
        offlineAccess: true,
        forceCodeForRefreshToken: true,
        scopes: CALENDAR_SCOPES,
      });
      const result = await GoogleSignin.signIn();
      const serverAuthCode = result?.data?.serverAuthCode ?? result?.serverAuthCode;
      if (!serverAuthCode) {
        throw new Error("O Google não retornou o código necessário. Tente novamente.");
      }
      await connectMutation.mutateAsync({ serverAuthCode });
    } catch (e: any) {
      if (e?.code !== statusCodes?.SIGN_IN_CANCELLED) {
        AppAlert.alert("Erro ao conectar", e?.message ?? "Falha ao conectar com o Google.");
      }
    } finally {
      setConnecting(false);
    }
  }

  function handleDisconnect() {
    AppAlert.alert(
      "Desconectar Google Agenda?",
      "Os agendamentos futuros deixam de ser sincronizados.",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Desconectar", style: "destructive", onPress: () => disconnectMutation.mutate() },
      ]
    );
  }

  function handleImport() {
    AppAlert.alert(
      "Importar compromissos existentes?",
      "Compromissos que você já tinha na sua agenda pessoal do Google (próximos 60 dias) viram bloqueios de horário no Barber Pro, para evitar que alguém agende em cima. Isso não afeta agendamentos de clientes já existentes.",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Importar", onPress: () => importMutation.mutate() },
      ]
    );
  }

  const status = statusQuery.data;
  const isConnected = !!status?.connected;
  const isLoading = statusQuery.isLoading || connecting || connectMutation.isPending || disconnectMutation.isPending || importMutation.isPending;

  return (
    <ScreenContainer containerClassName="bg-background" edges={["top", "left", "right"]}>
      <AdminHeader title="Integrações" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.iconBox}>
              <Text style={{ fontSize: 22 }}>📅</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Google Agenda</Text>
              <Text style={styles.cardDesc}>
                Seus agendamentos aparecem automaticamente na sua Google Agenda pessoal, num calendário dedicado "Barber Pro".
              </Text>
            </View>
          </View>

          {statusQuery.isLoading ? (
            <ActivityIndicator color={GOLD} style={{ marginVertical: 16 }} />
          ) : isConnected ? (
            <>
              <View style={styles.statusRow}>
                <View style={[styles.dot, { backgroundColor: GREEN }]} />
                <Text style={styles.statusText}>Conectado</Text>
                {status?.lastSyncAt ? (
                  <Text style={styles.statusMeta}>
                    Última sincronização: {new Date(status.lastSyncAt).toLocaleString("pt-BR")}
                  </Text>
                ) : null}
              </View>
              {status?.lastSyncError ? (
                <Text style={styles.errorText}>⚠️ Último erro: {status.lastSyncError}</Text>
              ) : null}

              <Pressable
                style={({ pressed }) => [styles.btnOutlineGold, pressed && { opacity: 0.8 }, { marginBottom: 10 }]}
                onPress={handleImport}
                disabled={isLoading}
              >
                {importMutation.isPending ? (
                  <ActivityIndicator color={GOLD} size="small" />
                ) : (
                  <Text style={styles.btnOutlineGoldText}>📥 Importar agendamentos existentes</Text>
                )}
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.btnOutlineDanger, pressed && { opacity: 0.8 }]}
                onPress={handleDisconnect}
                disabled={isLoading}
              >
                {disconnectMutation.isPending ? (
                  <ActivityIndicator color={RED} size="small" />
                ) : (
                  <Text style={styles.btnOutlineDangerText}>Desconectar</Text>
                )}
              </Pressable>
            </>
          ) : (
            <>
              <View style={styles.statusRow}>
                <View style={[styles.dot, { backgroundColor: MUTED }]} />
                <Text style={[styles.statusText, { color: MUTED }]}>Não conectado</Text>
              </View>
              <Pressable
                style={({ pressed }) => [styles.btnPrimary, pressed && { opacity: 0.85 }]}
                onPress={handleConnect}
                disabled={isLoading}
              >
                {connecting || connectMutation.isPending ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <ActivityIndicator color={BG} size="small" />
                    <Text style={styles.btnPrimaryText}>Conectando...</Text>
                  </View>
                ) : (
                  <Text style={styles.btnPrimaryText}>Conectar Google Agenda</Text>
                )}
              </Pressable>
            </>
          )}
        </View>

        <Text style={styles.footnote}>
          Bloqueios feitos direto na sua Google Agenda não voltam para o Barber Pro — a sincronização hoje funciona só em uma direção (Barber Pro → Google Agenda).
        </Text>

        <View style={{ height: 40 }} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, padding: 20 },
  card: { backgroundColor: SURFACE, borderRadius: 18, padding: 20, borderWidth: 1, borderColor: "rgba(201,168,76,0.2)" },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 14, marginBottom: 18 },
  iconBox: { width: 44, height: 44, borderRadius: 12, backgroundColor: "rgba(66,133,244,0.12)", alignItems: "center", justifyContent: "center" },
  cardTitle: { fontSize: 16, fontWeight: "800", color: TEXT, marginBottom: 4 },
  cardDesc: { fontSize: 13, color: MUTED, lineHeight: 18 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: BG, borderWidth: 1, borderColor: BORDER, borderRadius: 10, padding: 12, marginBottom: 12, flexWrap: "wrap" },
  dot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 13, fontWeight: "700", color: TEXT },
  statusMeta: { fontSize: 11, color: MUTED, marginLeft: "auto" },
  errorText: { fontSize: 12, color: RED, marginBottom: 12 },
  btnPrimary: { backgroundColor: GOLD, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  btnPrimaryText: { color: BG, fontSize: 14, fontWeight: "900" },
  btnOutlineGold: { borderWidth: 1, borderColor: "rgba(201,168,76,0.4)", borderRadius: 12, paddingVertical: 13, alignItems: "center" },
  btnOutlineGoldText: { color: GOLD, fontSize: 14, fontWeight: "700" },
  btnOutlineDanger: { borderWidth: 1, borderColor: "rgba(248,113,113,0.4)", borderRadius: 12, paddingVertical: 13, alignItems: "center" },
  btnOutlineDangerText: { color: RED, fontSize: 14, fontWeight: "700" },
  footnote: { fontSize: 12, color: MUTED, marginTop: 16, lineHeight: 17, paddingHorizontal: 4 },
});
