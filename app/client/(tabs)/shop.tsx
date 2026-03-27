import { useEffect, useRef, useState } from "react";
import {
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
const CARD_W = (SCREEN_W - 20 * 2 - 12) / 2; // 2 colunas com gap de 12

// ─── Card de produto ──────────────────────────────────────────────────────────
// product já contém thumbnailUrl do endpoint batch
function ProductCard({ product, onPress }: { product: any; onPress: () => void }) {
  const firstImage = product.thumbnailUrl ? { url: product.thumbnailUrl } : null;

  return (
    <TouchableOpacity onPress={onPress} style={[styles.card, { width: CARD_W }]} activeOpacity={0.85}>
      {/* Imagem */}
      {firstImage ? (
        <Image source={{ uri: firstImage.url }} style={styles.cardImage} resizeMode="cover" />
      ) : (
        <View style={styles.cardImageFallback}>
          <Text style={styles.cardImageFallbackIcon}>🧴</Text>
        </View>
      )}

      {/* Overlay escuro sobre a imagem */}
      <View style={styles.cardImageOverlay} />

      {/* Badge de preço */}
      <View style={styles.priceBadge}>
        <Text style={styles.priceBadgeText}>R$ {parseFloat(product.price).toFixed(2)}</Text>
      </View>

      {/* Badge de estoque */}
      {product.stock === 0 && (
        <View style={styles.outOfStockBadge}>
          <Text style={styles.outOfStockText}>Indisponível</Text>
        </View>
      )}

      {/* Conteúdo */}
      <View style={styles.cardBody}>
        <Text style={styles.cardName} numberOfLines={2}>{product.name}</Text>
        {product.stock > 0 ? (
          <Text style={styles.cardStock}>✓ Em estoque</Text>
        ) : (
          <Text style={styles.cardStockOut}>✗ Indisponível</Text>
        )}
        <View style={styles.cardFooter}>
          <Text style={styles.cardCta}>Ver detalhes →</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Detalhe do produto ───────────────────────────────────────────────────────
function ProductDetail({ product, onClose }: { product: any; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useTabBarHeight();
  const mediaQuery = trpc.products.media.list.useQuery({ productId: product.id });
  const [expandDesc, setExpandDesc] = useState(false);
  const [selectedImg, setSelectedImg] = useState<string | null>(null);
  const images = mediaQuery.data?.filter((m: any) => m.type === "image") ?? [];

  // Fade-in de entrada
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 280, useNativeDriver: true }).start();
  }, []);

  return (
    <Animated.View style={[{ flex: 1, backgroundColor: "#000" }, { opacity: fadeAnim }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: tabBarHeight + 32 }}>

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
            <Text style={{ fontSize: 72 }}>🧴</Text>
          </View>
        )}

        <View style={styles.detailContent}>
          {/* Voltar */}
          <TouchableOpacity onPress={onClose} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Voltar aos produtos</Text>
          </TouchableOpacity>

          {/* Nome e preço */}
          <View style={styles.detailHeader}>
            <Text style={styles.detailName}>{product.name}</Text>
            <View style={styles.detailPricePill}>
              <Text style={styles.detailPrice}>R$ {parseFloat(product.price).toFixed(2)}</Text>
            </View>
          </View>

          {/* Status de estoque */}
          <View style={styles.detailMeta}>
            <View style={styles.detailMetaItem}>
              {product.stock > 0 ? (
                <>
                  <Text style={styles.detailMetaIcon}>📦</Text>
                  <Text style={[styles.detailMetaText, { color: "#22C55E" }]}>
                    Em estoque ({product.stock} {product.stock === 1 ? "unidade" : "unidades"})
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.detailMetaIcon}>⛔</Text>
                  <Text style={[styles.detailMetaText, { color: "#EF4444" }]}>Produto indisponível</Text>
                </>
              )}
            </View>
            {product.category && (
              <View style={styles.detailMetaItem}>
                <Text style={styles.detailMetaIcon}>🏷️</Text>
                <Text style={styles.detailMetaText}>{product.category}</Text>
              </View>
            )}
          </View>

          {/* Descrição */}
          {product.description ? (
            <View style={styles.detailDescBox}>
              <Text style={styles.detailDescLabel}>Sobre este produto</Text>
              <Text style={styles.detailDesc} numberOfLines={expandDesc ? undefined : 3}>
                {product.description}
              </Text>
              {product.description.length > 100 && (
                <TouchableOpacity onPress={() => setExpandDesc(!expandDesc)} style={{ marginTop: 6 }}>
                  <Text style={styles.detailDescToggle}>{expandDesc ? "Ver menos ▲" : "Ver mais ▼"}</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : null}

          {/* Info de compra */}
          <View style={styles.infoBox}>
            <Text style={styles.infoBoxIcon}>🛒</Text>
            <Text style={styles.infoBoxText}>
              Para adquirir este produto, entre em contato com a barbearia ou compre presencialmente.
            </Text>
          </View>
        </View>
      </ScrollView>

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
export default function ClientShop() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useTabBarHeight();
  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);

  const { client } = useClientAuth();
  const tenantId = client?.tenantId ?? undefined;
  const productsQuery = trpc.products.listWithMedia.useQuery({ activeOnly: true, tenantId });
  const categoriesQuery = trpc.categories.list.useQuery({ type: "product" });
  const products = productsQuery.data ?? [];
  const categories = categoriesQuery.data ?? [];

  const filtered = products.filter((p: any) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = selectedCategory === null || p.categoryId === selectedCategory;
    return matchSearch && matchCat;
  });

  // Fade-in de entrada
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 320, useNativeDriver: true }).start();
  }, []);

  if (selectedProduct) {
    return (
      <ScreenContainer containerClassName="bg-black" edges={["top", "left", "right"]}>
        <ProductDetail product={selectedProduct} onClose={() => setSelectedProduct(null)} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer containerClassName="bg-black" edges={["left", "right"]}>
      <Animated.View style={[{ flex: 1 }, { opacity: fadeAnim }]}>

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
          <Text style={styles.headerTitle}>Nossa Loja</Text>
          <Text style={styles.headerSubtitle}>Produtos selecionados para você</Text>
        </View>

        {/* ── Busca ──────────────────────────────────────────────────────────── */}
        <View style={styles.searchWrapper}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar produto..."
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

        {/* ── Grid de produtos ────────────────────────────────────────────────── */}
        {productsQuery.isLoading ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>Carregando produtos...</Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateIcon}>🧴</Text>
            <Text style={styles.emptyStateText}>Nenhum produto encontrado</Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => String(item.id)}
            numColumns={2}
            columnWrapperStyle={styles.row}
            renderItem={({ item }) => (
              <ProductCard product={item} onPress={() => setSelectedProduct(item)} />
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

  // ── Grid ─────────────────────────────────────────────────────────────────────
  row: {
    gap: 12,
    marginBottom: 12,
  },

  // ── Card ─────────────────────────────────────────────────────────────────────
  card: {
    backgroundColor: "#111827",
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#1F2937",
  },
  cardImage: {
    width: "100%",
    height: 140,
  },
  cardImageFallback: {
    width: "100%",
    height: 110,
    backgroundColor: "#1F2937",
    alignItems: "center",
    justifyContent: "center",
  },
  cardImageFallbackIcon: {
    fontSize: 40,
  },
  cardImageOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 140,
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  priceBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "#EAB308",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  priceBadgeText: {
    color: "#000",
    fontWeight: "800",
    fontSize: 12,
  },
  outOfStockBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    backgroundColor: "rgba(239,68,68,0.85)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  outOfStockText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 11,
  },
  cardBody: {
    padding: 12,
    gap: 4,
  },
  cardName: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
    lineHeight: 19,
  },
  cardStock: {
    color: "#22C55E",
    fontSize: 12,
    fontWeight: "600",
  },
  cardStockOut: {
    color: "#EF4444",
    fontSize: 12,
    fontWeight: "600",
  },
  cardFooter: {
    marginTop: 4,
    alignItems: "flex-end",
  },
  cardCta: {
    color: "#EAB308",
    fontWeight: "700",
    fontSize: 13,
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
    paddingTop: 20,
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
    flexWrap: "wrap",
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
    marginTop: 6,
  },
  infoBox: {
    backgroundColor: "#111827",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1F2937",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 20,
  },
  infoBoxIcon: {
    fontSize: 20,
  },
  infoBoxText: {
    color: "#9CA3AF",
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
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
