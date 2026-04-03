import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useTabBarHeight } from "@/hooks/use-tab-bar-height";
import { useClientAuth } from "@/lib/client-auth-context";

const { width: SCREEN_W } = Dimensions.get("window");

// ─── Estrelas ─────────────────────────────────────────────────────────────────
function Stars({ rating, size = 13 }: { rating: number; size?: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Text key={s} style={{ fontSize: size, color: s <= Math.round(rating) ? "#EAB308" : "#374151" }}>★</Text>
      ))}
    </View>
  );
}

// ─── Card de serviço ──────────────────────────────────────────────────────────
// service já contém thumbnailUrl, avgRating e reviewCount do endpoint batch
function ServiceCard({ service, onPress }: { service: any; onPress: () => void }) {
  const firstImage = service.thumbnailUrl ? { url: service.thumbnailUrl } : null;
  const avgRating = (service.avgRating as number | null) ?? 0;
  const reviewCount = (service.reviewCount as number) ?? 0;

  return (
    <TouchableOpacity onPress={onPress} style={styles.card} activeOpacity={0.85}>
      {/* Imagem */}
      {firstImage ? (
        <Image source={{ uri: firstImage.url }} style={styles.cardImage} resizeMode="cover" />
      ) : (
        <View style={styles.cardImageFallback}>
          <Text style={styles.cardImageFallbackIcon}>✂️</Text>
        </View>
      )}

      {/* Gradiente inferior sobre a imagem */}
      <View style={styles.cardImageOverlay} />

      {/* Badge de preço sobre a imagem */}
      <View style={styles.priceBadge}>
        <Text style={styles.priceBadgeText}>R$ {parseFloat(service.price).toFixed(2)}</Text>
      </View>

      {/* Conteúdo */}
      <View style={styles.cardBody}>
        <Text style={styles.cardName}>{service.name}</Text>

        <View style={styles.cardMeta}>
          <Text style={styles.cardDuration}>⏱ {service.durationMinutes} min</Text>
          {reviewCount > 0 && (
            <View style={styles.cardRatingRow}>
              <Stars rating={avgRating} size={12} />
              <Text style={styles.cardRatingCount}>({reviewCount})</Text>
            </View>
          )}
        </View>

        {service.description ? (
          <Text style={styles.cardDesc} numberOfLines={2}>{service.description}</Text>
        ) : null}

        <View style={styles.cardFooter}>
          <Text style={styles.cardBookCta}>Agendar →</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Detalhe do serviço ───────────────────────────────────────────────────────
function ServiceDetail({ service, onClose, onBook, tenantId }: { service: any; onClose: () => void; onBook: () => void; tenantId?: number }) {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useTabBarHeight();
  const mediaQuery = trpc.services.media.list.useQuery({ serviceId: service.id });
  const reviewsQuery = trpc.reviews.byService.useQuery({ serviceId: service.id, tenantId: tenantId ?? null });
  const [expandDesc, setExpandDesc] = useState(false);
  const [selectedImg, setSelectedImg] = useState<string | null>(null);
  const images = mediaQuery.data?.filter((m: any) => m.type === "image") ?? [];
  const avgRating = reviewsQuery.data?.length
    ? reviewsQuery.data.reduce((s: number, r: any) => s + r.rating, 0) / reviewsQuery.data.length
    : 0;
  const reviewCount = reviewsQuery.data?.length ?? 0;

  // Fade-in de entrada
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 280, useNativeDriver: true }).start();
  }, []);

  return (
    <Animated.View style={[{ flex: 1, backgroundColor: "#000" }, { opacity: fadeAnim }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: tabBarHeight + 80 }}>

        {/* Galeria de imagens */}
        {images.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.detailGallery}>
            {images.map((img: any) => (
              <TouchableOpacity key={img.id} onPress={() => setSelectedImg(img.url)} activeOpacity={0.9}>
                <Image source={{ uri: img.url }} style={styles.detailGalleryImage} resizeMode="cover" />
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : (
          <View style={styles.detailImageFallback}>
            <Text style={{ fontSize: 64 }}>✂️</Text>
          </View>
        )}

        <View style={[styles.detailContent, { paddingTop: 20 }]}>
          {/* Voltar */}
          <TouchableOpacity onPress={onClose} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Voltar aos serviços</Text>
          </TouchableOpacity>

          {/* Nome e preço */}
          <View style={styles.detailHeader}>
            <Text style={styles.detailName}>{service.name}</Text>
            <View style={styles.detailPricePill}>
              <Text style={styles.detailPrice}>R$ {parseFloat(service.price).toFixed(2)}</Text>
            </View>
          </View>

          {/* Duração e avaliação */}
          <View style={styles.detailMeta}>
            <View style={styles.detailMetaItem}>
              <Text style={styles.detailMetaIcon}>⏱</Text>
              <Text style={styles.detailMetaText}>{service.durationMinutes} min</Text>
            </View>
            {reviewCount > 0 && (
              <View style={styles.detailMetaItem}>
                <Stars rating={Math.round(avgRating)} size={14} />
                <Text style={styles.detailMetaText}>{avgRating.toFixed(1)} ({reviewCount})</Text>
              </View>
            )}
          </View>

          {/* Descrição */}
          {service.description ? (
            <View style={styles.detailDescBox}>
              <Text style={styles.detailDescLabel}>Sobre este serviço</Text>
              <Text style={styles.detailDesc} numberOfLines={expandDesc ? undefined : 3}>
                {service.description}
              </Text>
              {service.description.length > 100 && (
                <TouchableOpacity onPress={() => setExpandDesc(!expandDesc)} style={{ marginTop: 6 }}>
                  <Text style={styles.detailDescToggle}>{expandDesc ? "Ver menos ▲" : "Ver mais ▼"}</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : null}

          {/* Avaliações */}
          {reviewCount > 0 && (
            <View style={styles.reviewsBox}>
              <Text style={styles.reviewsTitle}>Avaliações dos clientes</Text>
              {reviewsQuery.data!.slice(0, 5).map((r: any) => (
                <View key={r.id} style={styles.reviewItem}>
                  <Stars rating={r.rating} />
                  {r.comment ? <Text style={styles.reviewText}>{r.comment}</Text> : null}
                  <Text style={styles.reviewDate}>{new Date(r.createdAt).toLocaleDateString("pt-BR")}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Botão de agendar fixo */}
      <View style={[styles.bookBar, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity style={styles.bookBarButton} onPress={onBook} activeOpacity={0.85}>
          <Text style={styles.bookBarButtonText}>✂️  Agendar este serviço</Text>
        </TouchableOpacity>
      </View>

      {/* Lightbox */}
      <Modal visible={!!selectedImg} transparent animationType="fade" onRequestClose={() => setSelectedImg(null)}>
        <TouchableOpacity
          style={styles.lightboxBg}
          onPress={() => setSelectedImg(null)}
          activeOpacity={1}
        >
          {selectedImg && (
            <Image source={{ uri: selectedImg }} style={styles.lightboxImage} resizeMode="contain" />
          )}
          <Text style={styles.lightboxHint}>Toque para fechar</Text>
        </TouchableOpacity>
      </Modal>
    </Animated.View>
  );
}

// ─── Tela principal ───────────────────────────────────────────────────────────
export default function ClientServices() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useTabBarHeight();
  const [search, setSearch] = useState("");
  const [selectedService, setSelectedService] = useState<any>(null);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [explorerBannerDismissed, setExplorerBannerDismissed] = useState(false);

  const { client, isAuthenticated } = useClientAuth();
  const settingsQuery = trpc.settings.get.useQuery();
  const tenantId = (settingsQuery.data as any)?.tenantId ?? undefined;
  // Barbearia favorita do cliente
  const preferredTenantId = isAuthenticated ? (client?.preferredTenantId ?? null) : null;
  const preferredTenantQuery = trpc.clientAuth.getPreferredTenant.useQuery(
    { tenantId: preferredTenantId },
    { enabled: !!preferredTenantId }
  );
  const preferredTenantName = (preferredTenantQuery.data as any)?.name ?? null;
  // Mostrar banner apenas quando o tenantId atual é diferente da barbearia favorita
  const isExploringOtherShop = !!preferredTenantId && !!tenantId && preferredTenantId !== tenantId;
  const servicesQuery = trpc.services.listWithMediaAndRatings.useQuery({ activeOnly: true, tenantId });
  const categoriesQuery = trpc.categories.list.useQuery({ type: "service" });
  const services = servicesQuery.data ?? [];
  const categories = categoriesQuery.data ?? [];

  const filtered = services.filter((s: any) => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = selectedCategory === null || s.categoryId === selectedCategory;
    return matchSearch && matchCat;
  });

  // Fade-in de entrada
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 320, useNativeDriver: true }).start();
  }, []);

  if (selectedService) {
    return (
      <ScreenContainer containerClassName="bg-black" edges={["top", "left", "right"]}>
        <ServiceDetail
          service={selectedService}
          onClose={() => setSelectedService(null)}
          onBook={() => {
            router.push({ pathname: "/client/book" as any, params: { serviceId: selectedService.id } });
            setSelectedService(null);
          }}
          tenantId={tenantId}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer containerClassName="bg-black" edges={["left", "right"]}>
      <Animated.View style={[{ flex: 1 }, { opacity: fadeAnim }]}>

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
          <Text style={styles.headerTitle}>Nossos Serviços</Text>
          <Text style={styles.headerSubtitle}>Escolha e agende com um toque</Text>
        </View>        {/* ── Banner: explorando outra barbearia ────────────────────────────────────── */}
        {isExploringOtherShop && !explorerBannerDismissed && (
          <View style={{
            backgroundColor: "#1a1200",
            borderRadius: 10,
            marginHorizontal: 16,
            marginBottom: 8,
            padding: 12,
            borderWidth: 1,
            borderColor: "#C9A84C",
            flexDirection: "row",
            alignItems: "flex-start",
            gap: 10,
          }}>
            <Text style={{ fontSize: 18, lineHeight: 22 }}>⭐</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#EAB308", fontSize: 13, fontWeight: "700", marginBottom: 2 }}>
                Você já tem uma barbearia favorita!
              </Text>
              <Text style={{ color: "#9CA3AF", fontSize: 12, lineHeight: 17 }}>
                Sua barbearia favorita é <Text style={{ color: "#C9A84C", fontWeight: "600" }}>{preferredTenantName}</Text>. Deseja explorar outras unidades?
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setExplorerBannerDismissed(true)}
              style={{ padding: 4 }}
              activeOpacity={0.7}
            >
              <Text style={{ color: "#6B7280", fontSize: 16, lineHeight: 18 }}>✕</Text>
            </TouchableOpacity>
          </View>
        )}
        {/* ── Busca ──────────────────────────────────────────────────────────────────── */}
        <View style={styles.searchWrapper}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar serviço..."
            placeholderTextColor="#4B5563"
            style={styles.searchInput}
            returnKeyType="search"
          />
        </View>

        {/* ── Filtro por categoria ────────────────────────────────────────────── */}
        {categories.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesRow}
          >
            <TouchableOpacity
              onPress={() => setSelectedCategory(null)}
              style={[styles.categoryChip, selectedCategory === null && styles.categoryChipActive]}
              activeOpacity={0.8}
            >
              <Text style={[styles.categoryChipText, selectedCategory === null && styles.categoryChipTextActive]}>
                Todos
              </Text>
            </TouchableOpacity>
            {categories.map((cat: any) => (
              <TouchableOpacity
                key={cat.id}
                onPress={() => setSelectedCategory(cat.id === selectedCategory ? null : cat.id)}
                style={[styles.categoryChip, selectedCategory === cat.id && styles.categoryChipActive]}
                activeOpacity={0.8}
              >
                <Text style={[styles.categoryChipText, selectedCategory === cat.id && styles.categoryChipTextActive]}>
                  {cat.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* ── Lista ──────────────────────────────────────────────────────────── */}
        {servicesQuery.isLoading ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>Carregando serviços...</Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateIcon}>✂️</Text>
            <Text style={styles.emptyStateText}>Nenhum serviço encontrado</Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => (
              <ServiceCard service={item} onPress={() => setSelectedService(item)} />
            )}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: tabBarHeight + 16 }}
            showsVerticalScrollIndicator={false}
          />
        )}
      </Animated.View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerTitle: {
    color: "#EAB308",
    fontWeight: "800",
    fontSize: 26,
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    color: "#6B7280",
    fontSize: 14,
    marginTop: 2,
  },

  // ── Busca ────────────────────────────────────────────────────────────────────
  searchWrapper: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  searchInput: {
    backgroundColor: "#111827",
    color: "#fff",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: "#1F2937",
    fontSize: 15,
  },

  // ── Categorias ───────────────────────────────────────────────────────────────
  categoriesRow: {
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 16,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#1F2937",
  },
  categoryChipActive: {
    backgroundColor: "#1F1500",
    borderColor: "#EAB308",
  },
  categoryChipText: {
    color: "#6B7280",
    fontSize: 13,
    fontWeight: "600",
  },
  categoryChipTextActive: {
    color: "#EAB308",
  },

  // ── Card ─────────────────────────────────────────────────────────────────────
  card: {
    backgroundColor: "#111827",
    borderRadius: 18,
    overflow: "hidden",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#1F2937",
  },
  cardImage: {
    width: "100%",
    height: 170,
  },
  cardImageFallback: {
    width: "100%",
    height: 120,
    backgroundColor: "#1F2937",
    alignItems: "center",
    justifyContent: "center",
  },
  cardImageFallbackIcon: {
    fontSize: 44,
  },
  cardImageOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 170,
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  priceBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "#EAB308",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  priceBadgeText: {
    color: "#000",
    fontWeight: "800",
    fontSize: 14,
  },
  cardBody: {
    padding: 16,
    gap: 6,
  },
  cardName: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 17,
    lineHeight: 22,
  },
  cardMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  cardDuration: {
    color: "#9CA3AF",
    fontSize: 13,
  },
  cardRatingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  cardRatingCount: {
    color: "#9CA3AF",
    fontSize: 12,
  },
  cardDesc: {
    color: "#6B7280",
    fontSize: 13,
    lineHeight: 18,
  },
  cardFooter: {
    marginTop: 4,
    alignItems: "flex-end",
  },
  cardBookCta: {
    color: "#EAB308",
    fontWeight: "700",
    fontSize: 14,
  },

  // ── Estado vazio ─────────────────────────────────────────────────────────────
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  emptyStateIcon: {
    fontSize: 52,
  },
  emptyStateText: {
    color: "#6B7280",
    fontSize: 16,
  },

  // ── Detalhe ──────────────────────────────────────────────────────────────────
  detailGallery: {
    height: 260,
  },
  detailGalleryImage: {
    width: SCREEN_W * 0.85,
    height: 260,
    marginRight: 4,
  },
  detailImageFallback: {
    height: 200,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
  },
  detailContent: {
    paddingHorizontal: 20,
  },
  backButton: {
    marginBottom: 16,
  },
  backButtonText: {
    color: "#EAB308",
    fontSize: 14,
    fontWeight: "600",
  },
  detailHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 12,
  },
  detailName: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 22,
    flex: 1,
    lineHeight: 28,
  },
  detailPricePill: {
    backgroundColor: "#EAB308",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexShrink: 0,
  },
  detailPrice: {
    color: "#000",
    fontWeight: "800",
    fontSize: 16,
  },
  detailMeta: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 16,
  },
  detailMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  detailMetaIcon: {
    fontSize: 14,
  },
  detailMetaText: {
    color: "#9CA3AF",
    fontSize: 14,
  },
  detailDescBox: {
    backgroundColor: "#111827",
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#1F2937",
  },
  detailDescLabel: {
    color: "#EAB308",
    fontWeight: "700",
    fontSize: 13,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  detailDesc: {
    color: "#D1D5DB",
    fontSize: 15,
    lineHeight: 22,
  },
  detailDescToggle: {
    color: "#EAB308",
    fontSize: 13,
    fontWeight: "600",
  },
  reviewsBox: {
    marginBottom: 20,
  },
  reviewsTitle: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 17,
    marginBottom: 12,
  },
  reviewItem: {
    backgroundColor: "#111827",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#1F2937",
    gap: 6,
  },
  reviewText: {
    color: "#D1D5DB",
    fontSize: 14,
    lineHeight: 20,
    fontStyle: "italic",
  },
  reviewDate: {
    color: "#4B5563",
    fontSize: 12,
  },

  // ── Barra de agendamento ──────────────────────────────────────────────────────
  bookBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#000",
    borderTopWidth: 1,
    borderTopColor: "#1F2937",
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  bookBarButton: {
    backgroundColor: "#EAB308",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
  },
  bookBarButtonText: {
    color: "#000",
    fontWeight: "800",
    fontSize: 16,
    letterSpacing: 0.3,
  },

  // ── Lightbox ─────────────────────────────────────────────────────────────────
  lightboxBg: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
    alignItems: "center",
    justifyContent: "center",
  },
  lightboxImage: {
    width: "100%",
    height: "75%",
  },
  lightboxHint: {
    color: "rgba(255,255,255,0.5)",
    marginTop: 16,
    fontSize: 13,
  },
});
