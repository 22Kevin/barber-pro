import { useState } from "react";
import { FlatList, Image, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";

function ProductCard({ product, onPress }: { product: any; onPress: () => void }) {
  const mediaQuery = trpc.products.media.list.useQuery({ productId: product.id });
  const firstImage = mediaQuery.data?.find((m: any) => m.type === "image");

  return (
    <TouchableOpacity
      onPress={onPress}
      style={{ flex: 1, backgroundColor: "#111827", borderRadius: 16, overflow: "hidden", margin: 6, borderWidth: 1, borderColor: "#1F2937" }}
    >
      {firstImage ? (
        <Image source={{ uri: firstImage.url }} style={{ width: "100%", height: 140 }} resizeMode="cover" />
      ) : (
        <View style={{ width: "100%", height: 120, backgroundColor: "#1F2937", alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 36 }}>🧴</Text>
        </View>
      )}
      <View style={{ padding: 12 }}>
        <Text style={{ color: "#fff", fontWeight: "600", fontSize: 14 }} numberOfLines={2}>{product.name}</Text>
        <Text style={{ color: "#EAB308", fontWeight: "700", fontSize: 15, marginTop: 4 }}>R$ {parseFloat(product.price).toFixed(2)}</Text>
        {product.stock > 0 ? (
          <Text style={{ color: "#22C55E", fontSize: 11, marginTop: 2 }}>Em estoque</Text>
        ) : (
          <Text style={{ color: "#EF4444", fontSize: 11, marginTop: 2 }}>Indisponível</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

function ProductDetail({ product, onClose }: { product: any; onClose: () => void }) {
  const mediaQuery = trpc.products.media.list.useQuery({ productId: product.id });
  const [expandDesc, setExpandDesc] = useState(false);
  const [selectedImg, setSelectedImg] = useState<string | null>(null);
  const images = mediaQuery.data?.filter((m: any) => m.type === "image") ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {images.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ height: 260 }}>
            {images.map((img: any) => (
              <TouchableOpacity key={img.id} onPress={() => setSelectedImg(img.url)}>
                <Image source={{ uri: img.url }} style={{ width: 300, height: 260, marginRight: 4 }} resizeMode="cover" />
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : (
          <View style={{ height: 200, backgroundColor: "#111827", alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 72 }}>🧴</Text>
          </View>
        )}

        <View style={{ padding: 20 }}>
          <TouchableOpacity onPress={onClose} style={{ marginBottom: 12 }}>
            <Text style={{ color: "#EAB308" }}>← Voltar</Text>
          </TouchableOpacity>

          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 22, flex: 1 }}>{product.name}</Text>
            <Text style={{ color: "#EAB308", fontWeight: "800", fontSize: 22 }}>R$ {parseFloat(product.price).toFixed(2)}</Text>
          </View>

          <View style={{ marginTop: 8 }}>
            {product.stock > 0 ? (
              <Text style={{ color: "#22C55E", fontWeight: "600" }}>✓ Em estoque ({product.stock} unidades)</Text>
            ) : (
              <Text style={{ color: "#EF4444", fontWeight: "600" }}>✗ Produto indisponível</Text>
            )}
          </View>

          {product.description ? (
            <View style={{ marginTop: 16 }}>
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16, marginBottom: 8 }}>Descrição</Text>
              <Text style={{ color: "#D1D5DB", fontSize: 15, lineHeight: 22 }} numberOfLines={expandDesc ? undefined : 4}>
                {product.description}
              </Text>
              {product.description.length > 120 && (
                <TouchableOpacity onPress={() => setExpandDesc(!expandDesc)} style={{ marginTop: 6 }}>
                  <Text style={{ color: "#EAB308", fontSize: 14 }}>{expandDesc ? "Ver menos" : "Ver mais"}</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : null}

          {/* Info box */}
          <View style={{ backgroundColor: "#111827", borderRadius: 12, padding: 16, marginTop: 20, borderWidth: 1, borderColor: "#1F2937" }}>
            <Text style={{ color: "#9CA3AF", fontSize: 14, textAlign: "center" }}>
              Para comprar este produto, entre em contato com a barbearia ou adquira presencialmente.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Image zoom modal */}
      <Modal visible={!!selectedImg} transparent animationType="fade">
        <TouchableOpacity style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.95)", alignItems: "center", justifyContent: "center" }} onPress={() => setSelectedImg(null)}>
          {selectedImg && <Image source={{ uri: selectedImg }} style={{ width: "100%", height: "70%" }} resizeMode="contain" />}
          <Text style={{ color: "#fff", marginTop: 16, opacity: 0.6 }}>Toque para fechar</Text>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

export default function ClientShop() {
  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const productsQuery = trpc.products.list.useQuery({ activeOnly: true });
  const products = productsQuery.data ?? [];
  const filtered = products.filter((p: any) => p.name.toLowerCase().includes(search.toLowerCase()));

  if (selectedProduct) {
    return (
      <ScreenContainer containerClassName="bg-black" edges={["top", "left", "right"]}>
        <ProductDetail product={selectedProduct} onClose={() => setSelectedProduct(null)} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer containerClassName="bg-black">
      <View style={{ flex: 1 }}>
        <View style={{ padding: 20, paddingBottom: 12 }}>
          <Text style={{ color: "#fff", fontWeight: "800", fontSize: 24, marginBottom: 16 }}>Loja</Text>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar produto..."
            placeholderTextColor="#4B5563"
            style={{ backgroundColor: "#111827", color: "#fff", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#374151", fontSize: 15 }}
          />
        </View>

        {productsQuery.isLoading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: "#9CA3AF" }}>Carregando produtos...</Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 48, marginBottom: 12 }}>🧴</Text>
            <Text style={{ color: "#9CA3AF", fontSize: 16 }}>Nenhum produto encontrado</Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => String(item.id)}
            numColumns={2}
            renderItem={({ item }) => (
              <ProductCard product={item} onPress={() => setSelectedProduct(item)} />
            )}
            contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 100 }}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </ScreenContainer>
  );
}
