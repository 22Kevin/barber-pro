import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Image,
  Alert,
  Platform,
} from "react-native";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useClientAuth } from "@/lib/client-auth-context";

type NearbyTenant = {
  id: number;
  name: string;
  slug: string;
  address: string | null;
  city: string | null;
  state: string | null;
  latitude: number;
  longitude: number;
  logoUrl: string | null;
  distanceKm: number;
};

export default function ExploreScreen() {
  const router = useRouter();
  const { client: clientUser } = useClientAuth();
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [loading, setLoading] = useState(false);

  const nearbyQuery = trpc.onboarding.nearby.useQuery(
    { lat: coords?.lat ?? 0, lng: coords?.lng ?? 0 },
    { enabled: coords !== null }
  );

  const requestLocation = useCallback(async () => {
    setLoading(true);
    try {
      if (Platform.OS === "web") {
        if (!navigator.geolocation) {
          Alert.alert("Não disponível", "Geolocalização não suportada neste navegador.");
          setPermissionDenied(true);
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          },
          () => {
            setPermissionDenied(true);
            Alert.alert("Permissão negada", "Ative a localização no navegador para encontrar barbearias próximas.");
          }
        );
        return;
      }
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setPermissionDenied(true);
        Alert.alert(
          "Permissão negada",
          "Ative a permissão de localização nas configurações do dispositivo para encontrar barbearias próximas."
        );
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
    } catch (e) {
      Alert.alert("Erro", "Não foi possível obter sua localização. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSelectTenant = useCallback(
    (tenant: NearbyTenant) => {
      // Registrar lead de geolocalização se o cliente estiver autenticado
      if (clientUser?.id) {
        // Fire-and-forget — não bloqueia a navegação
        fetch("/api/trpc/orbit.registerLogin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientId: clientUser.id, tenantId: tenant.id, source: "geo" }),
        }).catch(() => {});
      }
      router.push(`/client/welcome/${tenant.slug}` as any);
    },
    [clientUser, router]
  );

  const renderItem = ({ item }: { item: NearbyTenant }) => (
    <TouchableOpacity style={styles.card} onPress={() => handleSelectTenant(item)} activeOpacity={0.8}>
      <View style={styles.cardLeft}>
        {item.logoUrl ? (
          <Image source={{ uri: item.logoUrl }} style={styles.logo} />
        ) : (
          <View style={styles.logoPlaceholder}>
            <Text style={styles.logoEmoji}>✂️</Text>
          </View>
        )}
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.shopName} numberOfLines={1}>{item.name}</Text>
        {item.address ? (
          <Text style={styles.address} numberOfLines={1}>
            {item.address}{item.city ? `, ${item.city}` : ""}
          </Text>
        ) : null}
        <View style={styles.distanceRow}>
          <Text style={styles.distanceBadge}>📍 {item.distanceKm} km</Text>
        </View>
      </View>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );

  return (
    <ScreenContainer containerClassName="bg-black" safeAreaClassName="bg-black">
      <View style={styles.header}>
        <Text style={styles.title}>Explorar</Text>
        <Text style={styles.subtitle}>Barbearias próximas de você</Text>
      </View>

      {!coords && !permissionDenied && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>📍</Text>
          <Text style={styles.emptyTitle}>Encontre barbearias perto de você</Text>
          <Text style={styles.emptyText}>
            Usamos sua localização para listar as melhores barbearias parceiras na sua região.
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={requestLocation} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#0A0A0A" />
            ) : (
              <Text style={styles.primaryBtnText}>Usar minha localização</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {permissionDenied && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>🚫</Text>
          <Text style={styles.emptyTitle}>Localização não disponível</Text>
          <Text style={styles.emptyText}>
            Ative a permissão de localização nas configurações do dispositivo e tente novamente.
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={requestLocation}>
            <Text style={styles.primaryBtnText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      )}

      {coords && (nearbyQuery.isLoading) && (
        <View style={styles.loadingState}>
          <ActivityIndicator color="#EAB308" size="large" />
          <Text style={styles.loadingText}>Buscando barbearias próximas…</Text>
        </View>
      )}

      {coords && !nearbyQuery.isLoading && nearbyQuery.data && nearbyQuery.data.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>🔍</Text>
          <Text style={styles.emptyTitle}>Nenhuma barbearia encontrada</Text>
          <Text style={styles.emptyText}>
            Não encontramos barbearias parceiras em um raio de 50 km da sua localização.
          </Text>
        </View>
      )}

      {coords && nearbyQuery.data && nearbyQuery.data.length > 0 && (
        <>
          <Text style={styles.resultsLabel}>
            {nearbyQuery.data.length} barbearia{nearbyQuery.data.length !== 1 ? "s" : ""} encontrada{nearbyQuery.data.length !== 1 ? "s" : ""}
          </Text>
          <FlatList
            data={nearbyQuery.data as NearbyTenant[]}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          />
        </>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#EAB308",
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 14,
    color: "#9CA3AF",
    marginTop: 2,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyEmoji: {
    fontSize: 52,
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#F9FAFB",
    textAlign: "center",
  },
  emptyText: {
    fontSize: 14,
    color: "#9CA3AF",
    textAlign: "center",
    lineHeight: 20,
  },
  primaryBtn: {
    marginTop: 8,
    backgroundColor: "#EAB308",
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
    minWidth: 220,
    alignItems: "center",
  },
  primaryBtnText: {
    color: "#0A0A0A",
    fontWeight: "700",
    fontSize: 15,
  },
  loadingState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  loadingText: {
    color: "#9CA3AF",
    fontSize: 14,
  },
  resultsLabel: {
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "600",
    paddingHorizontal: 20,
    paddingBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 10,
  },
  card: {
    backgroundColor: "#111827",
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#1F2937",
  },
  cardLeft: {
    marginRight: 14,
  },
  logo: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: "#1F2937",
  },
  logoPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: "#1F2937",
    alignItems: "center",
    justifyContent: "center",
  },
  logoEmoji: {
    fontSize: 24,
  },
  cardBody: {
    flex: 1,
    gap: 3,
  },
  shopName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#F9FAFB",
  },
  address: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  distanceRow: {
    flexDirection: "row",
    marginTop: 2,
  },
  distanceBadge: {
    fontSize: 12,
    color: "#EAB308",
    fontWeight: "600",
  },
  chevron: {
    fontSize: 22,
    color: "#4B5563",
    marginLeft: 8,
  },
});
