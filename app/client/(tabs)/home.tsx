import { useRouter } from "expo-router";
import { FlatList, Image, ImageBackground, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Svg, { Defs, LinearGradient, Path, Rect, Stop, Circle } from "react-native-svg";
import { ScreenContainer } from "@/components/screen-container";
import { useClientAuth } from "@/lib/client-auth-context";
import { trpc } from "@/lib/trpc";

// ─── Ícone do Instagram (gradiente oficial) ───────────────────────────────────
function InstagramIcon({ size = 28 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Defs>
        <LinearGradient id="ig1" x1="0%" y1="100%" x2="100%" y2="0%">
          <Stop offset="0%" stopColor="#FFDC80" />
          <Stop offset="25%" stopColor="#FCAF45" />
          <Stop offset="50%" stopColor="#F77737" />
          <Stop offset="75%" stopColor="#F56040" />
          <Stop offset="100%" stopColor="#833AB4" />
        </LinearGradient>
      </Defs>
      <Rect x="2" y="2" width="20" height="20" rx="5.5" ry="5.5" fill="url(#ig1)" />
      <Circle cx="12" cy="12" r="4.5" fill="none" stroke="white" strokeWidth="1.8" />
      <Circle cx="17.5" cy="6.5" r="1.2" fill="white" />
    </Svg>
  );
}

// ─── Ícone do Google Maps (pin colorido) ─────────────────────────────────────
function MapsIcon({ size = 28 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
        fill="#EA4335"
      />
      <Circle cx="12" cy="9" r="2.5" fill="white" />
    </Svg>
  );
}

// ─── Componente de estrelas ───────────────────────────────────────────────────
function StarRating({ rating, count }: { rating: number; count: number }) {
  const stars = [1, 2, 3, 4, 5];
  return (
    <View style={styles.starRow}>
      {stars.map((s) => (
        <Text key={s} style={[styles.star, { color: s <= Math.round(rating) ? "#EAB308" : "#374151" }]}>
          ★
        </Text>
      ))}
      <Text style={styles.starLabel}>{rating.toFixed(1)} ({count})</Text>
    </View>
  );
}

export default function ClientHome() {
  const router = useRouter();
  const { client, isAuthenticated } = useClientAuth();

  const servicesQuery = trpc.services.listWithMediaAndRatings.useQuery({ activeOnly: true });
  const productsQuery = trpc.products.listWithMedia.useQuery({ activeOnly: true });
  const settingsQuery = trpc.settings.get.useQuery();

  const featuredServices = (servicesQuery.data ?? []).slice(0, 8);
  const featuredProducts = (productsQuery.data ?? []).slice(0, 8);

  const settings = settingsQuery.data as any;
  const shopName = settings?.shopName ?? "Barber Pro";
  const shopInstagram = settings?.instagram ?? null;
  const shopGoogleMapsUrl = settings?.googleMapsUrl ?? null;
  const heroImageUrl = settings?.logoUrl ?? null;

  function openInstagram() {
    if (!shopInstagram) return;
    const handle = shopInstagram.replace(/^@/, "");
    const appUrl = `instagram://user?username=${handle}`;
    const webUrl = `https://instagram.com/${handle}`;
    Linking.canOpenURL(appUrl).then((supported) => {
      Linking.openURL(supported ? appUrl : webUrl);
    });
  }

  function openGoogleMaps() {
    if (!shopGoogleMapsUrl) return;
    Linking.openURL(shopGoogleMapsUrl);
  }

  return (
    <ScreenContainer containerClassName="bg-black">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.shopName}>{shopName.toUpperCase()}</Text>
            <Text style={styles.greeting}>
              {isAuthenticated ? `Olá, ${client?.name.split(" ")[0]}! 👋` : "Bem-vindo!"}
            </Text>
          </View>
          {isAuthenticated && (
            <View style={styles.pointsBadge}>
              <Text style={styles.pointsText}>⭐ {client?.totalPoints ?? 0} pts</Text>
            </View>
          )}
        </View>

        {/* ── Banner de agendamento com hero image ────────────────────────── */}
        <View style={styles.bookingBannerWrapper}>
          {heroImageUrl ? (
            <ImageBackground
              source={{ uri: heroImageUrl }}
              style={styles.bookingBannerBg}
              imageStyle={styles.bookingBannerBgImage}
            >
              {/* Overlay escuro para legibilidade */}
              <View style={styles.bookingBannerOverlay} />
              <View style={styles.bookingBannerContent}>
                <Text style={styles.bookingTitle}>Agende seu horário</Text>
                <Text style={styles.bookingSubtitle}>Escolha seu barbeiro, data e horário preferido</Text>
                <TouchableOpacity
                  style={styles.bookingButton}
                  onPress={() => router.push("/client/book" as any)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.bookingButtonText}>Agendar agora ✂️</Text>
                </TouchableOpacity>
              </View>
            </ImageBackground>
          ) : (
            <View style={[styles.bookingBannerBg, styles.bookingBannerFallback]}>
              <View style={styles.bookingBannerContent}>
                <Text style={styles.bookingTitle}>Agende seu horário</Text>
                <Text style={styles.bookingSubtitle}>Escolha seu barbeiro, data e horário preferido</Text>
                <TouchableOpacity
                  style={styles.bookingButton}
                  onPress={() => router.push("/client/book" as any)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.bookingButtonText}>Agendar agora ✂️</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* ── Login CTA para não autenticados ────────────────────────────── */}
        {!isAuthenticated && (
          <View style={styles.loyaltyCta}>
            <Text style={styles.loyaltyTitle}>⭐ Programa de Fidelidade</Text>
            <Text style={styles.loyaltySubtitle}>
              Crie sua conta e acumule pontos a cada visita para ganhar recompensas exclusivas!
            </Text>
            <View style={styles.loyaltyButtons}>
              <TouchableOpacity
                style={styles.loyaltyButtonPrimary}
                onPress={() => router.push("/client/register" as any)}
                activeOpacity={0.8}
              >
                <Text style={styles.loyaltyButtonPrimaryText}>Criar conta</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.loyaltyButtonSecondary}
                onPress={() => router.push("/client/login" as any)}
                activeOpacity={0.8}
              >
                <Text style={styles.loyaltyButtonSecondaryText}>Entrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Serviços em destaque ────────────────────────────────────────── */}
        {featuredServices.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Nossos Serviços</Text>
              <TouchableOpacity onPress={() => router.push("/client/(tabs)/services" as any)}>
                <Text style={styles.seeAll}>Ver todos →</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={featuredServices}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
              keyExtractor={(item: any) => String(item.id)}
              renderItem={({ item: svc }: { item: any }) => (
                <TouchableOpacity
                  onPress={() => router.push({ pathname: "/client/book" as any, params: { serviceId: svc.id } })}
                  style={styles.serviceCard}
                  activeOpacity={0.8}
                >
                  {svc.thumbnailUrl ? (
                    <Image
                      source={{ uri: svc.thumbnailUrl }}
                      style={styles.serviceCardImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.serviceCardPlaceholder}>
                      <Text style={{ fontSize: 38 }}>✂️</Text>
                    </View>
                  )}
                  <View style={styles.serviceCardInfo}>
                    <Text style={styles.serviceCardName} numberOfLines={1}>{svc.name}</Text>
                    {/* Estrelas de avaliação */}
                    {svc.avgRating !== null && svc.reviewCount > 0 ? (
                      <StarRating rating={svc.avgRating} count={svc.reviewCount} />
                    ) : (
                      <Text style={styles.noReviews}>Sem avaliações</Text>
                    )}
                    <View style={styles.serviceCardFooter}>
                      <Text style={styles.serviceCardPrice}>R$ {parseFloat(svc.price).toFixed(2)}</Text>
                      <Text style={styles.serviceCardDuration}>⏱ {svc.durationMinutes} min</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              )}
            />
          </View>
        )}

        {/* ── Produtos em destaque (scroll horizontal) ────────────────────── */}
        {featuredProducts.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Produtos</Text>
              <TouchableOpacity onPress={() => router.push("/client/(tabs)/shop" as any)}>
                <Text style={styles.seeAll}>Ver todos →</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={featuredProducts}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
              keyExtractor={(item: any) => String(item.id)}
              renderItem={({ item: prod }: { item: any }) => (
                <TouchableOpacity
                  onPress={() => router.push("/client/(tabs)/shop" as any)}
                  style={styles.productCard}
                  activeOpacity={0.8}
                >
                  {prod.thumbnailUrl ? (
                    <Image
                      source={{ uri: prod.thumbnailUrl }}
                      style={styles.productCardImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.productCardPlaceholder}>
                      <Text style={{ fontSize: 34 }}>🧴</Text>
                    </View>
                  )}
                  <View style={styles.productCardInfo}>
                    <Text style={styles.productCardName} numberOfLines={2}>{prod.name}</Text>
                    <Text style={styles.productCardPrice}>R$ {parseFloat(prod.price).toFixed(2)}</Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          </View>
        )}

        {/* ── Nos encontre (Instagram + Google Maps) ─────────────────────── */}
        {(shopInstagram || shopGoogleMapsUrl) && (
          <View style={styles.findUsSection}>
            <Text style={styles.sectionTitle}>Nos encontre</Text>
            <View style={styles.findUsRow}>
              {shopInstagram && (
                <TouchableOpacity
                  onPress={openInstagram}
                  style={styles.findUsCardInstagram}
                  activeOpacity={0.8}
                >
                  <InstagramIcon size={26} />
                  <View style={styles.findUsCardText}>
                    <Text style={styles.findUsCardTitle}>Instagram</Text>
                    <Text style={styles.findUsCardHandle} numberOfLines={1}>
                      {shopInstagram.startsWith("@") ? shopInstagram : `@${shopInstagram}`}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
              {shopGoogleMapsUrl && (
                <TouchableOpacity
                  onPress={openGoogleMaps}
                  style={styles.findUsCardMaps}
                  activeOpacity={0.8}
                >
                  <MapsIcon size={26} />
                  <View style={styles.findUsCardText}>
                    <Text style={styles.findUsCardTitle}>Como chegar</Text>
                    <Text style={styles.findUsCardHandle}>Google Maps</Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  // Header
  header: {
    padding: 20,
    paddingBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  shopName: {
    color: "#EAB308",
    fontWeight: "800",
    fontSize: 22,
    letterSpacing: 2,
  },
  greeting: {
    color: "#9CA3AF",
    fontSize: 14,
    marginTop: 2,
  },
  pointsBadge: {
    backgroundColor: "#1F1500",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#EAB308",
  },
  pointsText: {
    color: "#EAB308",
    fontWeight: "700",
    fontSize: 13,
  },

  // Booking banner
  bookingBannerWrapper: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#EAB308",
  },
  bookingBannerBg: {
    minHeight: 160,
    justifyContent: "flex-end",
  },
  bookingBannerBgImage: {
    borderRadius: 20,
    opacity: 0.55,
  },
  bookingBannerFallback: {
    backgroundColor: "#111827",
  },
  bookingBannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.52)",
    borderRadius: 20,
  },
  bookingBannerContent: {
    padding: 20,
  },
  bookingTitle: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 20,
    marginBottom: 6,
  },
  bookingSubtitle: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 13,
    marginBottom: 16,
  },
  bookingButton: {
    backgroundColor: "#EAB308",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignSelf: "flex-start",
  },
  bookingButtonText: {
    color: "#000",
    fontWeight: "700",
    fontSize: 14,
  },

  // Loyalty CTA
  loyaltyCta: {
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: "#0f1a0f",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#22C55E",
  },
  loyaltyTitle: {
    color: "#22C55E",
    fontWeight: "700",
    fontSize: 15,
    marginBottom: 4,
  },
  loyaltySubtitle: {
    color: "#9CA3AF",
    fontSize: 13,
    marginBottom: 12,
  },
  loyaltyButtons: {
    flexDirection: "row",
    gap: 10,
  },
  loyaltyButtonPrimary: {
    flex: 1,
    backgroundColor: "#22C55E",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  loyaltyButtonPrimaryText: {
    color: "#000",
    fontWeight: "700",
    fontSize: 13,
  },
  loyaltyButtonSecondary: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#374151",
  },
  loyaltyButtonSecondaryText: {
    color: "#9CA3AF",
    fontSize: 13,
  },

  // Sections
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 18,
  },
  seeAll: {
    color: "#EAB308",
    fontSize: 14,
  },

  // Service card
  serviceCard: {
    width: 168,
    backgroundColor: "#111827",
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#1F2937",
  },
  serviceCardImage: {
    width: "100%",
    height: 108,
  },
  serviceCardPlaceholder: {
    width: "100%",
    height: 108,
    backgroundColor: "#1F2937",
    alignItems: "center",
    justifyContent: "center",
  },
  serviceCardInfo: {
    padding: 12,
    gap: 4,
  },
  serviceCardName: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
    lineHeight: 18,
  },
  starRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 1,
    marginTop: 2,
  },
  star: {
    fontSize: 13,
    lineHeight: 16,
  },
  starLabel: {
    color: "#9CA3AF",
    fontSize: 11,
    marginLeft: 3,
  },
  noReviews: {
    color: "#4B5563",
    fontSize: 11,
    marginTop: 2,
  },
  serviceCardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  serviceCardPrice: {
    color: "#EAB308",
    fontWeight: "700",
    fontSize: 14,
  },
  serviceCardDuration: {
    color: "#6B7280",
    fontSize: 11,
  },

  // Product card (horizontal)
  productCard: {
    width: 150,
    backgroundColor: "#111827",
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#1F2937",
  },
  productCardImage: {
    width: "100%",
    height: 110,
  },
  productCardPlaceholder: {
    width: "100%",
    height: 110,
    backgroundColor: "#1F2937",
    alignItems: "center",
    justifyContent: "center",
  },
  productCardInfo: {
    padding: 10,
  },
  productCardName: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 13,
    lineHeight: 18,
  },
  productCardPrice: {
    color: "#EAB308",
    fontWeight: "700",
    fontSize: 13,
    marginTop: 4,
  },

  // Find us
  findUsSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
    gap: 12,
  },
  findUsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
  },
  findUsCardInstagram: {
    flex: 1,
    backgroundColor: "#1a0a1a",
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "#7C3AED",
  },
  findUsCardMaps: {
    flex: 1,
    backgroundColor: "#0a1a0a",
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "#16A34A",
  },
  findUsCardText: {
    flex: 1,
  },
  findUsCardTitle: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
  },
  findUsCardHandle: {
    color: "#9CA3AF",
    fontSize: 11,
    marginTop: 2,
  },
});
