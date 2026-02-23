import { useRouter } from "expo-router";
import { useState } from "react";
import { FlatList, Image, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";

function StarRating({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Text key={s} style={{ fontSize: size, color: s <= rating ? "#EAB308" : "#374151" }}>★</Text>
      ))}
    </View>
  );
}

function ServiceCard({ service, onPress }: { service: any; onPress: () => void }) {
  const mediaQuery = trpc.services.media.list.useQuery({ serviceId: service.id });
  const reviewsQuery = trpc.reviews.byService.useQuery({ serviceId: service.id });
  const firstImage = mediaQuery.data?.find((m: any) => m.type === "image");
  const avgRating = reviewsQuery.data?.length
    ? reviewsQuery.data.reduce((s: number, r: any) => s + r.rating, 0) / reviewsQuery.data.length
    : 0;

  return (
    <TouchableOpacity
      onPress={onPress}
      style={{ backgroundColor: "#111827", borderRadius: 16, overflow: "hidden", marginBottom: 16, borderWidth: 1, borderColor: "#1F2937" }}
    >
      {firstImage ? (
        <Image source={{ uri: firstImage.url }} style={{ width: "100%", height: 160 }} resizeMode="cover" />
      ) : (
        <View style={{ width: "100%", height: 120, backgroundColor: "#1F2937", alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 40 }}>✂️</Text>
        </View>
      )}
      <View style={{ padding: 16 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16, flex: 1 }}>{service.name}</Text>
          <Text style={{ color: "#EAB308", fontWeight: "700", fontSize: 16 }}>R$ {parseFloat(service.price).toFixed(2)}</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 }}>
          <Text style={{ color: "#9CA3AF", fontSize: 13 }}>⏱ {service.durationMinutes} min</Text>
          {reviewsQuery.data && reviewsQuery.data.length > 0 && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <StarRating rating={Math.round(avgRating)} size={12} />
              <Text style={{ color: "#9CA3AF", fontSize: 12 }}>({reviewsQuery.data.length})</Text>
            </View>
          )}
        </View>
        {service.description ? (
          <Text style={{ color: "#6B7280", fontSize: 13, marginTop: 6 }} numberOfLines={2}>{service.description}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

function ServiceDetail({ service, onClose, onBook }: { service: any; onClose: () => void; onBook: () => void }) {
  const mediaQuery = trpc.services.media.list.useQuery({ serviceId: service.id });
  const reviewsQuery = trpc.reviews.byService.useQuery({ serviceId: service.id });
  const [expandDesc, setExpandDesc] = useState(false);
  const [selectedImg, setSelectedImg] = useState<string | null>(null);
  const images = mediaQuery.data?.filter((m: any) => m.type === "image") ?? [];
  const avgRating = reviewsQuery.data?.length
    ? reviewsQuery.data.reduce((s: number, r: any) => s + r.rating, 0) / reviewsQuery.data.length
    : 0;

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header image */}
        {images.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ height: 240 }}>
            {images.map((img: any) => (
              <TouchableOpacity key={img.id} onPress={() => setSelectedImg(img.url)}>
                <Image source={{ uri: img.url }} style={{ width: 300, height: 240, marginRight: 4 }} resizeMode="cover" />
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : (
          <View style={{ height: 180, backgroundColor: "#111827", alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 60 }}>✂️</Text>
          </View>
        )}

        <View style={{ padding: 20 }}>
          <TouchableOpacity onPress={onClose} style={{ marginBottom: 12 }}>
            <Text style={{ color: "#EAB308" }}>← Voltar</Text>
          </TouchableOpacity>

          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 22, flex: 1 }}>{service.name}</Text>
            <Text style={{ color: "#EAB308", fontWeight: "800", fontSize: 22 }}>R$ {parseFloat(service.price).toFixed(2)}</Text>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 8 }}>
            <Text style={{ color: "#9CA3AF" }}>⏱ {service.durationMinutes} min</Text>
            {reviewsQuery.data && reviewsQuery.data.length > 0 && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <StarRating rating={Math.round(avgRating)} />
                <Text style={{ color: "#9CA3AF", fontSize: 13 }}>{avgRating.toFixed(1)} ({reviewsQuery.data.length} avaliações)</Text>
              </View>
            )}
          </View>

          {service.description ? (
            <View style={{ marginTop: 16 }}>
              <Text style={{ color: "#D1D5DB", fontSize: 15, lineHeight: 22 }} numberOfLines={expandDesc ? undefined : 3}>
                {service.description}
              </Text>
              {service.description.length > 100 && (
                <TouchableOpacity onPress={() => setExpandDesc(!expandDesc)} style={{ marginTop: 4 }}>
                  <Text style={{ color: "#EAB308", fontSize: 14 }}>{expandDesc ? "Ver menos" : "Ver mais"}</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : null}

          {/* Avaliações */}
          {reviewsQuery.data && reviewsQuery.data.length > 0 && (
            <View style={{ marginTop: 24 }}>
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16, marginBottom: 12 }}>Avaliações</Text>
              {reviewsQuery.data.slice(0, 5).map((r: any) => (
                <View key={r.id} style={{ backgroundColor: "#111827", borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "#1F2937" }}>
                  <StarRating rating={r.rating} />
                  {r.comment ? <Text style={{ color: "#D1D5DB", fontSize: 14, marginTop: 6 }}>{r.comment}</Text> : null}
                  <Text style={{ color: "#6B7280", fontSize: 12, marginTop: 4 }}>{new Date(r.createdAt).toLocaleDateString("pt-BR")}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Book button */}
      <View style={{ padding: 20, paddingBottom: 32, backgroundColor: "#000", borderTopWidth: 1, borderTopColor: "#1F2937" }}>
        <TouchableOpacity
          style={{ backgroundColor: "#EAB308", borderRadius: 16, paddingVertical: 16, alignItems: "center" }}
          onPress={onBook}
        >
          <Text style={{ color: "#000", fontWeight: "700", fontSize: 16 }}>Agendar este serviço</Text>
        </TouchableOpacity>
      </View>

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

export default function ClientServices() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selectedService, setSelectedService] = useState<any>(null);
  const servicesQuery = trpc.services.list.useQuery({ activeOnly: true });
  const services = servicesQuery.data ?? [];
  const filtered = services.filter((s: any) => s.name.toLowerCase().includes(search.toLowerCase()));

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
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer containerClassName="bg-black">
      <View style={{ flex: 1 }}>
        <View style={{ padding: 20, paddingBottom: 12 }}>
          <Text style={{ color: "#fff", fontWeight: "800", fontSize: 24, marginBottom: 16 }}>Serviços</Text>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar serviço..."
            placeholderTextColor="#4B5563"
            style={{ backgroundColor: "#111827", color: "#fff", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#374151", fontSize: 15 }}
          />
        </View>

        {servicesQuery.isLoading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: "#9CA3AF" }}>Carregando serviços...</Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 48, marginBottom: 12 }}>✂️</Text>
            <Text style={{ color: "#9CA3AF", fontSize: 16 }}>Nenhum serviço encontrado</Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => (
              <ServiceCard service={item} onPress={() => setSelectedService(item)} />
            )}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </ScreenContainer>
  );
}
