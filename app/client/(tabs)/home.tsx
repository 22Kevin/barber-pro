import { useEffect, useRef, useState } from "react";
import { useRouter } from "expo-router";
import {
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
  Linking,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenContainer } from "@/components/screen-container";
import { useClientAuth } from "@/lib/client-auth-context";
import { trpc } from "@/lib/trpc";
import { useTabBarHeight } from "@/hooks/use-tab-bar-height";

const { width: SCREEN_W } = Dimensions.get("window");
const CAROUSEL_H = 220;

// ─── Ícone Instagram ──────────────────────────────────────────────────────────
function InstagramIcon({ size = 26 }: { size?: number }) {
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

// ─── Ícone Google Maps ────────────────────────────────────────────────────────
function MapsIcon({ size = 26 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#EA4335" />
      <Circle cx="12" cy="9" r="2.5" fill="white" />
    </Svg>
  );
}

// ─── Ícone WhatsApp ───────────────────────────────────────────────────────────
function WhatsAppIcon({ size = 26 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="12" cy="12" r="11" fill="#25D366" />
      <Path
        d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"
        fill="white"
      />
    </Svg>
  );
}

// ─── Estrelas ─────────────────────────────────────────────────────────────────
function Stars({ rating }: { rating: number }) {
  return (
    <View style={styles.starsRow}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Text key={s} style={{ fontSize: 13, color: s <= Math.round(rating) ? "#EAB308" : "#374151" }}>★</Text>
      ))}
    </View>
  );
}

// ─── Carrossel de fotos ───────────────────────────────────────────────────────
const SLIDE_DURATION = 4000;
function PhotoCarousel({ images }: { images: string[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxVisible, setLightboxVisible] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const flatRef = useRef<FlatList>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  // Progresso da barra: 0 → 1 em SLIDE_DURATION ms
  const progressAnim = useRef(new Animated.Value(0)).current;
  const progressRef = useRef<ReturnType<typeof Animated.timing> | null>(null);

  function startProgress() {
    progressAnim.setValue(0);
    progressRef.current = Animated.timing(progressAnim, {
      toValue: 1,
      duration: SLIDE_DURATION,
      useNativeDriver: false,
    });
    progressRef.current.start();
  }

  function pauseProgress() {
    progressRef.current?.stop();
  }

  function resetProgress() {
    progressRef.current?.stop();
    progressAnim.setValue(0);
  }

  // Auto-play: avança slide a cada 4s com fade suave
  useEffect(() => {
    if (images.length <= 1 || isPaused) return;
    startProgress();
    const timer = setInterval(() => {
      setActiveIndex(prev => {
        const next = (prev + 1) % images.length;
        Animated.timing(fadeAnim, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => {
          flatRef.current?.scrollToIndex({ index: next, animated: false });
          Animated.timing(fadeAnim, { toValue: 1, duration: 320, useNativeDriver: true }).start();
        });
        return next;
      });
      startProgress();
    }, SLIDE_DURATION);
    return () => { clearInterval(timer); resetProgress(); };
  }, [images.length, isPaused]);;

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
    setActiveIndex(idx);
  }

  function openLightbox(i: number) {
    setLightboxIndex(i);
    setLightboxVisible(true);
  }

  if (!images.length) {
    return (
      <View style={styles.carouselEmpty}>
        <Text style={styles.carouselEmptyText}>✂️</Text>
        <Text style={styles.carouselEmptyLabel}>Nenhuma foto cadastrada</Text>
      </View>
    );
  }

  return (
    <View style={styles.carouselWrapper}>
      <Animated.View style={{ opacity: fadeAnim }}>
        <FlatList
          ref={flatRef}
          data={images}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          scrollEnabled={true}
          onScrollBeginDrag={() => { setIsPaused(true); pauseProgress(); }}
          onScrollEndDrag={() => setTimeout(() => { setIsPaused(false); }, 3000)}
          keyExtractor={(_, i) => String(i)}
          renderItem={({ item, index }) => (
            <TouchableOpacity
              activeOpacity={0.92}
              onPress={() => openLightbox(index)}
              style={styles.carouselSlide}
            >
              <Image source={{ uri: item }} style={styles.carouselImage} resizeMode="cover" />
              {/* Gradiente inferior */}
              <View style={styles.carouselGradient} />
            </TouchableOpacity>
          )}
        />
      </Animated.View>
      {/* Barra de progresso animada */}
      {images.length > 1 && (
        <View style={styles.progressBarContainer}>
          {images.map((_, i) => (
            <View key={i} style={styles.progressBarTrack}>
              {i === activeIndex ? (
                <Animated.View
                  style={[
                    styles.progressBarFill,
                    { width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) },
                  ]}
                />
              ) : (
                <View style={[styles.progressBarFill, { width: i < activeIndex ? "100%" : "0%" }]} />
              )}
            </View>
          ))}
        </View>
      )}

      {/* Lightbox */}
      <Modal visible={lightboxVisible} transparent animationType="fade" onRequestClose={() => setLightboxVisible(false)}>
        <View style={styles.lightboxBg}>
          <TouchableOpacity style={styles.lightboxClose} onPress={() => setLightboxVisible(false)}>
            <Text style={styles.lightboxCloseText}>✕</Text>
          </TouchableOpacity>
          <FlatList
            data={images}
            horizontal
            pagingEnabled
            initialScrollIndex={lightboxIndex}
            getItemLayout={(_, index) => ({ length: SCREEN_W, offset: SCREEN_W * index, index })}
            showsHorizontalScrollIndicator={false}
            keyExtractor={(_, i) => String(i)}
            renderItem={({ item }) => (
              <View style={styles.lightboxSlide}>
                <Image source={{ uri: item }} style={styles.lightboxImage} resizeMode="contain" />
              </View>
            )}
          />
        </View>
      </Modal>
    </View>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function ClientHome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useTabBarHeight();
  const { client, isAuthenticated } = useClientAuth();
  const [pendingReviewAppt, setPendingReviewAppt] = useState<any>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");

  // Animações de entrada
  const headerFade = useRef(new Animated.Value(0)).current;
  const headerSlide = useRef(new Animated.Value(-12)).current;
  const carouselFade = useRef(new Animated.Value(0)).current;
  const carouselSlide = useRef(new Animated.Value(20)).current;
  const contentFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(headerFade, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(headerSlide, { toValue: 0, duration: 350, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(carouselFade, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(carouselSlide, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]),
      Animated.timing(contentFade, { toValue: 1, duration: 280, useNativeDriver: true }),
    ]).start();
  }, []);

  const settingsQuery = trpc.settings.get.useQuery();
  const openStatusQuery = trpc.settings.openStatus.useQuery(undefined, { refetchInterval: 60_000 });
  const shopTenantId = (settingsQuery.data as any)?.tenantId ?? undefined;
  // ── Barbearia favorita do cliente ──────────────────────────────────────────
  const preferredTenantId = isAuthenticated ? (client?.preferredTenantId ?? null) : null;
  const preferredTenantQuery = trpc.clientAuth.getPreferredTenant.useQuery(
    { tenantId: preferredTenantId },
    { enabled: !!preferredTenantId }
  );
  const preferredSettingsQuery = trpc.settings.getByTenant.useQuery(
    { tenantId: preferredTenantId ?? 0 },
    { enabled: !!preferredTenantId }
  );
  const recentReviewsQuery = trpc.reviews.recent.useQuery({ limit: 5, tenantId: shopTenantId });
  const nextAppointmentQuery = trpc.appointments.nextByClient.useQuery(
    { clientId: client?.id ?? 0 },
    { enabled: isAuthenticated && !!client?.id, refetchInterval: 120_000 }
  );
  const nextAppt = nextAppointmentQuery.data as any ?? null;
  const cancelApptMutation = trpc.appointments.update.useMutation({
    onSuccess: () => nextAppointmentQuery.refetch(),
  });
  const clientAppointmentsQuery = trpc.clients.appointments.useQuery(
    { clientId: client?.id ?? 0 },
    { enabled: isAuthenticated && !!client?.id }
  );
  const createReviewMutation = trpc.reviews.create.useMutation({
    onSuccess: () => {
      Alert.alert("⭐ Obrigado!", "Sua avaliação foi enviada!");
      setPendingReviewAppt(null);
      setReviewRating(5);
      setReviewComment("");
    },
    onError: (err: any) => Alert.alert("Erro", err.message),
  });
  // Detectar agendamentos concluídos recentes sem avaliação
  useEffect(() => {
    if (!isAuthenticated || !client?.id || !clientAppointmentsQuery.data) return;
    const checkPendingReview = async () => {
      try {
        const dismissed = await AsyncStorage.getItem("dismissed_reviews");
        const dismissedIds: number[] = dismissed ? JSON.parse(dismissed) : [];
        const nowBrasilia = new Date(Date.now() - 3 * 60 * 60 * 1000);
        const yesterday = new Date(nowBrasilia.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const completed = (clientAppointmentsQuery.data as any[]).find((a: any) =>
          a.status === "completed" &&
          a.date >= yesterday &&
          !dismissedIds.includes(a.id)
        );
        if (completed) setPendingReviewAppt(completed);
      } catch { /* ignore */ }
    };
    checkPendingReview();
  }, [isAuthenticated, client?.id, clientAppointmentsQuery.data]);
  async function dismissReview(id: number) {
    try {
      const dismissed = await AsyncStorage.getItem("dismissed_reviews");
      const ids: number[] = dismissed ? JSON.parse(dismissed) : [];
      await AsyncStorage.setItem("dismissed_reviews", JSON.stringify([...ids, id]));
    } catch { /* ignore */ }
    setPendingReviewAppt(null);
  }

  const settings = settingsQuery.data as any;
  // Quando o cliente tem barbearia favorita, usa os dados dela no header
  const preferredTenant = preferredTenantQuery.data as any;
  const preferredSettings = preferredSettingsQuery.data as any;
  const hasPreferred = !!preferredTenantId && !!preferredTenant;
  const shopName = hasPreferred
    ? (preferredTenant?.name ?? preferredSettings?.shopName ?? "Barber Pro")
    : (settings?.shopName ?? "Barber Pro");
  const shopLogoUrl = hasPreferred
    ? (preferredTenant?.logoUrl ?? preferredSettings?.logoUrl ?? null)
    : (settings?.logoUrl ?? null);
  const shopInstagram = settings?.instagram ?? null;
  const shopWhatsapp = settings?.whatsapp ?? null;
  const shopGoogleMapsUrl = settings?.googleMapsUrl ?? null;
  const galleryImages: string[] = (() => {
    try { return settings?.galleryUrls ? JSON.parse(settings.galleryUrls) : []; } catch { return []; }
  })();

  const openStatus = openStatusQuery.data;
  const recentReviews = recentReviewsQuery.data ?? [];

  function openInstagram() {
    if (!shopInstagram) return;
    const handle = shopInstagram.replace(/^@/, "");
    Linking.canOpenURL(`instagram://user?username=${handle}`).then((ok) =>
      Linking.openURL(ok ? `instagram://user?username=${handle}` : `https://instagram.com/${handle}`)
    );
  }

  function openWhatsApp() {
    if (!shopWhatsapp) return;
    const digits = shopWhatsapp.replace(/\D/g, "");
    const number = digits.startsWith("55") ? digits : `55${digits}`;
    Linking.openURL(`https://wa.me/${number}`);
  }

  function openGoogleMaps() {
    if (!shopGoogleMapsUrl) return;
    Linking.openURL(shopGoogleMapsUrl);
  }

  // ── Status aberto/fechado ──────────────────────────────────────────────────
  function renderOpenStatus() {
    if (!openStatus) return null;
    const { isOpen, opensAt, closesAt, lunchStart, lunchEnd } = openStatus;
    const toHM = (t: string) => t.slice(0, 5);
    let label = "";
    let color = "";
    let bg = "";

    if (isOpen) {
      // Verificar se está em almoço
      if (lunchStart && lunchEnd) {
        const now = new Date();
        const nowMin = now.getHours() * 60 + now.getMinutes();
        const lsMin = parseInt(lunchStart.split(":")[0]) * 60 + parseInt(lunchStart.split(":")[1]);
        const leMin = parseInt(lunchEnd.split(":")[0]) * 60 + parseInt(lunchEnd.split(":")[1]);
        if (nowMin >= lsMin && nowMin < leMin) {
          label = `Intervalo · volta às ${toHM(lunchEnd)}`;
          color = "#F59E0B";
          bg = "#1a1200";
        }
      }
      if (!label) {
        label = closesAt ? `Aberto · fecha às ${toHM(closesAt)}` : "Aberto agora";
        color = "#22C55E";
        bg = "#0a1a0a";
      }
    } else {
      label = opensAt ? `Fechado · abre às ${toHM(opensAt)}` : "Fechado no momento";
      color = "#EF4444";
      bg = "#1a0a0a";
    }

    return (
      <View style={[styles.statusPill, { backgroundColor: bg, borderColor: color }]}>
        <View style={[styles.statusDot, { backgroundColor: color }]} />
        <Text style={[styles.statusText, { color }]}>{label}</Text>
      </View>
    );
  }

  return (
    <ScreenContainer containerClassName="bg-black" edges={["left", "right"]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: tabBarHeight + 16 }}
      >
        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <Animated.View style={{ opacity: headerFade, transform: [{ translateY: headerSlide }] }}>
          <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          {/* Logo redondo */}
          <View style={styles.logoWrapper}>
            {shopLogoUrl ? (
              <Image source={{ uri: shopLogoUrl }} style={styles.logoImage} resizeMode="cover" />
            ) : (
              <View style={styles.logoFallback}>
                <Text style={styles.logoFallbackText}>✂️</Text>
              </View>
            )}
          </View>

          {/* Nome + saudação + status */}
          <View style={styles.headerInfo}>
            {/* Badge "MINHA BARBEARIA" quando o cliente tem barbearia favorita */}
            {hasPreferred && (
              <View style={styles.myShopBadge}>
                <Text style={styles.myShopBadgeText}>⭐ MINHA BARBEARIA</Text>
              </View>
            )}
            <Text style={styles.shopName} numberOfLines={1}>{shopName.toUpperCase()}</Text>
            <Text style={styles.greeting}>
              {isAuthenticated ? `Olá, ${client?.name.split(" ")[0]}! 👋` : "Bem-vindo!"}
            </Text>
            {renderOpenStatus()}
          </View>

          {/* Badge de pontos */}
          {isAuthenticated && (
            <View style={styles.pointsBadge}>
              <Text style={styles.pointsText}>⭐</Text>
              <Text style={styles.pointsValue}>{client?.totalPoints ?? 0}</Text>
              <Text style={styles.pointsLabel}>pts</Text>
            </View>
          )}
          </View>
        </Animated.View>

        {/* ── Carrossel de fotos ─────────────────────────────────────────────── */}
        <Animated.View style={{ opacity: carouselFade, transform: [{ translateY: carouselSlide }] }}>
          <View style={styles.carouselSection}>
            <PhotoCarousel images={galleryImages} />
          </View>
        </Animated.View>

        {/* ── Conteúdo restante com fade-in ──────────────────────────────────── */}
        <Animated.View style={{ opacity: contentFade }}>

        {/* ── Próximo Agendamento ───────────────────────────────────────── */}
        {isAuthenticated && nextAppt && (() => {
          const dateStr: string = nextAppt.date ?? "";
          const [yr, mo, dy] = dateStr.split("-").map(Number);
          const dateObj = new Date(yr, mo - 1, dy);
          const dayName = dateObj.toLocaleDateString("pt-BR", { weekday: "long" });
          const dayNum = dateObj.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
          const time = (nextAppt.startTime ?? "").slice(0, 5);
          const statusColors: Record<string, string> = { scheduled: "#C9A84C", confirmed: "#22C55E", in_progress: "#3B82F6" };
          const statusLabels: Record<string, string> = { scheduled: "Agendado", confirmed: "Confirmado", in_progress: "Em andamento" };
          const statusColor = statusColors[nextAppt.status] ?? "#C9A84C";
          const statusLabel = statusLabels[nextAppt.status] ?? nextAppt.status;
          function handleCancel() {
            Alert.alert(
              "Cancelar agendamento",
              "Tem certeza que deseja cancelar este agendamento?",
              [
                { text: "Não", style: "cancel" },
                { text: "Cancelar", style: "destructive", onPress: () => cancelApptMutation.mutate({ id: nextAppt.id, status: "cancelled" }) },
              ]
            );
          }
          return (
            <View style={styles.nextApptCard}>
              <View style={styles.nextApptHeader}>
                <Text style={styles.nextApptTitle}>Próximo agendamento</Text>
                <View style={[styles.nextApptBadge, { backgroundColor: statusColor + "22", borderColor: statusColor + "55" }]}>
                  <Text style={[styles.nextApptBadgeText, { color: statusColor }]}>{statusLabel}</Text>
                </View>
              </View>
              <View style={styles.nextApptBody}>
                <View style={styles.nextApptDateBox}>
                  <Text style={styles.nextApptDayNum}>{dayNum}</Text>
                  <Text style={styles.nextApptDayName}>{dayName}</Text>
                </View>
                <View style={styles.nextApptDivider} />
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.nextApptService} numberOfLines={1}>{nextAppt.serviceName ?? "Serviço"}</Text>
                  <Text style={styles.nextApptMeta}>✂️  {nextAppt.barberName ?? "Barbeiro"}</Text>
                  <Text style={styles.nextApptMeta}>🕐  {time}</Text>
                </View>
              </View>
              <View style={styles.nextApptActions}>
                <TouchableOpacity
                  style={styles.nextApptRescheduleBtn}
                  onPress={() => router.push(`/client/book?serviceId=${nextAppt.serviceId}` as any)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.nextApptRescheduleText}>🗓  Reagendar</Text>
                </TouchableOpacity>
                {nextAppt.status !== "in_progress" && (
                  <TouchableOpacity
                    style={styles.nextApptCancelBtn}
                    onPress={handleCancel}
                    activeOpacity={0.75}
                    disabled={cancelApptMutation.isPending}
                  >
                    <Text style={styles.nextApptCancelText}>{cancelApptMutation.isPending ? "Cancelando..." : "Cancelar"}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })()}
        {/* ── CTA de Login (não autenticado) ─────────────────────────────────── */}
        {!isAuthenticated && (
          <View style={styles.loginCta}>
            <Text style={styles.loginCtaTitle}>⭐ Programa de Fidelidade</Text>
            <Text style={styles.loginCtaSubtitle}>
              Crie sua conta e acumule pontos a cada visita para ganhar recompensas exclusivas!
            </Text>
            <View style={styles.loginCtaButtons}>
              <TouchableOpacity
                style={styles.loginCtaBtnPrimary}
                onPress={() => router.push("/client/register" as any)}
                activeOpacity={0.8}
              >
                <Text style={styles.loginCtaBtnPrimaryText}>Criar conta</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.loginCtaBtnSecondary}
                onPress={() => router.push("/client/login" as any)}
                activeOpacity={0.8}
              >
                <Text style={styles.loginCtaBtnSecondaryText}>Entrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Agende seu horário ─────────────────────────────────────────────── */}
        <View style={styles.bookSection}>
          <Text style={styles.sectionTitle}>Agende seu horário</Text>
          <Text style={styles.bookSubtitle}>Escolha seu barbeiro, data e horário preferido</Text>
          <TouchableOpacity
            style={styles.bookButton}
            onPress={() => router.push("/client/book" as any)}
            activeOpacity={0.85}
          >
            <Text style={styles.bookButtonText}>✂️  Agendar agora</Text>
          </TouchableOpacity>
        </View>

        {/* ── Avaliações em destaque ─────────────────────────────────────────── */}
        {recentReviews.length > 0 && (
          <View style={styles.reviewsSection}>
            <Text style={styles.sectionTitle}>O que dizem nossos clientes</Text>
            <FlatList
              data={recentReviews}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, gap: 12, paddingTop: 12 }}
              keyExtractor={(item: any) => String(item.id)}
              renderItem={({ item }: { item: any }) => (
                <View style={styles.reviewCard}>
                  <Stars rating={item.rating} />
                  {item.comment ? (
                    <Text style={styles.reviewComment} numberOfLines={3}>"{item.comment}"</Text>
                  ) : null}
                  <View style={styles.reviewFooter}>
                    <Text style={styles.reviewClient}>{item.clientName}</Text>
                    <Text style={styles.reviewService}>{item.serviceName}</Text>
                  </View>
                </View>
              )}
            />
          </View>
        )}

        {/* ── Nos Encontre ──────────────────────────────────────────────────── */}
        {(shopInstagram || shopGoogleMapsUrl || shopWhatsapp) && (
          <View style={styles.findUsSection}>
            <Text style={styles.sectionTitle}>Nos encontre</Text>
            <View style={styles.findUsGrid}>
              {shopWhatsapp && (
                <TouchableOpacity onPress={openWhatsApp} style={styles.findUsCardWhatsapp} activeOpacity={0.8}>
                  <WhatsAppIcon size={28} />
                  <View style={styles.findUsCardText}>
                    <Text style={styles.findUsCardTitle}>WhatsApp</Text>
                    <Text style={styles.findUsCardSub}>Fale conosco</Text>
                  </View>
                </TouchableOpacity>
              )}
              {shopInstagram && (
                <TouchableOpacity onPress={openInstagram} style={styles.findUsCardInstagram} activeOpacity={0.8}>
                  <InstagramIcon size={28} />
                  <View style={styles.findUsCardText}>
                    <Text style={styles.findUsCardTitle}>Instagram</Text>
                    <Text style={styles.findUsCardSub} numberOfLines={1}>
                      {shopInstagram.startsWith("@") ? shopInstagram : `@${shopInstagram}`}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
              {shopGoogleMapsUrl && (
                <TouchableOpacity onPress={openGoogleMaps} style={styles.findUsCardMaps} activeOpacity={0.8}>
                  <MapsIcon size={28} />
                  <View style={styles.findUsCardText}>
                    <Text style={styles.findUsCardTitle}>Como chegar</Text>
                    <Text style={styles.findUsCardSub}>Google Maps</Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
         </Animated.View>
      </ScrollView>

      {/* Modal de Avaliação Pós-Atendimento */}
      <Modal visible={!!pendingReviewAppt} animationType="slide" transparent>
        <View style={styles.reviewOverlay}>
          <View style={styles.reviewSheet}>
            <View style={styles.reviewHandle} />
            <Text style={styles.reviewTitle}>⭐ Como foi seu atendimento?</Text>
            <Text style={styles.reviewSubtitle}>
              {pendingReviewAppt?.serviceName ?? "Serviço"} • {pendingReviewAppt?.barberName ?? "Barbeiro"}
            </Text>
            {/* Estrelas interativas */}
            <View style={styles.reviewStarsRow}>
              {[1, 2, 3, 4, 5].map(s => (
                <TouchableOpacity key={s} onPress={() => setReviewRating(s)} activeOpacity={0.7}>
                  <Text style={[styles.reviewStar, { color: s <= reviewRating ? "#EAB308" : "#374151" }]}>★</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={styles.reviewInput}
              placeholder="Comentário opcional..."
              placeholderTextColor="#4B5563"
              value={reviewComment}
              onChangeText={setReviewComment}
              multiline
              numberOfLines={3}
              returnKeyType="done"
            />
            <View style={styles.reviewBtns}>
              <TouchableOpacity
                onPress={() => pendingReviewAppt && dismissReview(pendingReviewAppt.id)}
                style={styles.reviewBtnSkip}
              >
                <Text style={styles.reviewBtnSkipText}>Agora não</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  if (!client || !pendingReviewAppt) return;
                  createReviewMutation.mutate({
                    tenantId: client.tenantId ?? 0,
                    clientId: client.id,
                    serviceId: pendingReviewAppt.serviceId,
                    appointmentId: pendingReviewAppt.id,
                    rating: reviewRating,
                    comment: reviewComment || undefined,
                  });
                  dismissReview(pendingReviewAppt.id);
                }}
                disabled={createReviewMutation.isPending}
                style={styles.reviewBtnSend}
              >
                <Text style={styles.reviewBtnSendText}>
                  {createReviewMutation.isPending ? "Enviando..." : "Enviar avaliação"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
const styles = StyleSheet.create({
  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 14,
  },
  logoWrapper: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#EAB308",
    backgroundColor: "#1F2937",
    flexShrink: 0,
  },
  logoImage: {
    width: "100%",
    height: "100%",
  },
  logoFallback: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1F2937",
  },
  logoFallbackText: {
    fontSize: 26,
  },
  headerInfo: {
    flex: 1,
    gap: 2,
  },
  myShopBadge: {
    backgroundColor: "#1a1200",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: "#C9A84C",
    alignSelf: "flex-start",
    marginBottom: 2,
  },
  myShopBadgeText: {
    color: "#C9A84C",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  shopName: {
    color: "#EAB308",
    fontWeight: "800",
    fontSize: 17,
    letterSpacing: 1.5,
  },
  greeting: {
    color: "#9CA3AF",
    fontSize: 13,
    lineHeight: 18,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 4,
    gap: 5,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
  },
  pointsBadge: {
    backgroundColor: "#1F1500",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#EAB308",
    alignItems: "center",
    flexShrink: 0,
  },
  pointsText: {
    fontSize: 16,
    lineHeight: 20,
  },
  pointsValue: {
    color: "#EAB308",
    fontWeight: "800",
    fontSize: 15,
    lineHeight: 18,
  },
  pointsLabel: {
    color: "#EAB308",
    fontSize: 10,
    fontWeight: "600",
    opacity: 0.8,
  },

  // ── Carrossel ───────────────────────────────────────────────────────────────
  carouselSection: {
    marginBottom: 24,
  },
  carouselWrapper: {
    position: "relative",
  },
  carouselSlide: {
    width: SCREEN_W,
    height: CAROUSEL_H,
    position: "relative",
  },
  carouselImage: {
    width: "100%",
    height: "100%",
  },
  carouselGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  progressBarContainer: {
    position: "absolute",
    top: 10,
    left: 10,
    right: 10,
    flexDirection: "row",
    gap: 4,
  },
  progressBarTrack: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.25)",
    overflow: "hidden",
  },
  progressBarFill: {
    height: 3,
    borderRadius: 2,
    backgroundColor: "#EAB308",
  },
  carouselEmpty: {
    height: CAROUSEL_H,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  carouselEmptyText: {
    fontSize: 48,
  },
  carouselEmptyLabel: {
    color: "#4B5563",
    fontSize: 14,
  },

  // ── Lightbox ─────────────────────────────────────────────────────────────────
  lightboxBg: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
    justifyContent: "center",
  },
  lightboxClose: {
    position: "absolute",
    top: 52,
    right: 20,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  lightboxCloseText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  lightboxSlide: {
    width: SCREEN_W,
    flex: 1,
    justifyContent: "center",
  },
  lightboxImage: {
    width: SCREEN_W,
    height: SCREEN_W,
  },

  // ── Login CTA ────────────────────────────────────────────────────────────────
  loginCta: {
    marginHorizontal: 20,
    marginBottom: 24,
    backgroundColor: "#0f1a0f",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#22C55E",
  },
  loginCtaTitle: {
    color: "#22C55E",
    fontWeight: "700",
    fontSize: 15,
    marginBottom: 4,
  },
  loginCtaSubtitle: {
    color: "#9CA3AF",
    fontSize: 13,
    marginBottom: 12,
    lineHeight: 18,
  },
  loginCtaButtons: {
    flexDirection: "row",
    gap: 10,
  },
  loginCtaBtnPrimary: {
    flex: 1,
    backgroundColor: "#22C55E",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  loginCtaBtnPrimaryText: {
    color: "#000",
    fontWeight: "700",
    fontSize: 13,
  },
  loginCtaBtnSecondary: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#374151",
  },
  loginCtaBtnSecondaryText: {
    color: "#9CA3AF",
    fontSize: 13,
  },

  // ── Agendar ──────────────────────────────────────────────────────────────────
  bookSection: {
    marginHorizontal: 20,
    marginBottom: 28,
    backgroundColor: "#111827",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "#EAB308",
  },
  sectionTitle: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 18,
    marginBottom: 4,
  },
  bookSubtitle: {
    color: "#6B7280",
    fontSize: 13,
    marginBottom: 16,
    lineHeight: 18,
  },
  bookButton: {
    backgroundColor: "#EAB308",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  bookButtonText: {
    color: "#000",
    fontWeight: "800",
    fontSize: 16,
    letterSpacing: 0.3,
  },

  // ── Avaliações ───────────────────────────────────────────────────────────────
  reviewsSection: {
    marginBottom: 28,
    paddingHorizontal: 20,
  },
  starsRow: {
    flexDirection: "row",
    gap: 2,
    marginBottom: 8,
  },
  reviewCard: {
    width: 220,
    backgroundColor: "#111827",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#1F2937",
    gap: 6,
  },
  reviewComment: {
    color: "#D1D5DB",
    fontSize: 13,
    lineHeight: 19,
    fontStyle: "italic",
  },
  reviewFooter: {
    marginTop: 4,
    gap: 2,
  },
  reviewClient: {
    color: "#EAB308",
    fontWeight: "700",
    fontSize: 12,
  },
  reviewService: {
    color: "#6B7280",
    fontSize: 11,
  },

  // ── Nos Encontre ─────────────────────────────────────────────────────────────
  findUsSection: {
    paddingHorizontal: 20,
    marginBottom: 8,
    gap: 12,
  },
  findUsGrid: {
    gap: 10,
    marginTop: 12,
  },
  findUsCardWhatsapp: {
    backgroundColor: "#0a1a0e",
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: "#25D366",
  },
  findUsCardInstagram: {
    backgroundColor: "#1a0a1a",
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: "#7C3AED",
  },
  findUsCardMaps: {
    backgroundColor: "#0a1a0a",
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: "#16A34A",
  },
  findUsCardText: {
    flex: 1,
  },
  findUsCardTitle: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
  findUsCardSub: {
    color: "#9CA3AF",
    fontSize: 12,
    marginTop: 2,
  },
  // ── Próximo Agendamento ────────────────────────────────────────────────────
  nextApptCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: "#141414",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#C9A84C33",
    padding: 16,
    gap: 12,
    shadowColor: "#C9A84C",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  nextApptHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  nextApptTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#C9A84C",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  nextApptBadge: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  nextApptBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  nextApptBody: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  nextApptDateBox: {
    alignItems: "center",
    minWidth: 56,
  },
  nextApptDayNum: {
    fontSize: 18,
    fontWeight: "800",
    color: "#ECEDEE",
    lineHeight: 22,
  },
  nextApptDayName: {
    fontSize: 11,
    color: "#888880",
    textTransform: "capitalize",
    marginTop: 2,
  },
  nextApptDivider: {
    width: 1,
    height: 48,
    backgroundColor: "#2A2A2A",
  },
  nextApptService: {
    fontSize: 15,
    fontWeight: "700",
    color: "#ECEDEE",
    lineHeight: 20,
  },
  nextApptMeta: {
    fontSize: 13,
    color: "#888880",
    lineHeight: 18,
  },
  nextApptActions: {
    flexDirection: "row",
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: "#2A2A2A",
    marginTop: 4,
    paddingTop: 10,
  },
  nextApptRescheduleBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#C9A84C22",
    borderWidth: 1,
    borderColor: "#C9A84C55",
  },
  nextApptRescheduleText: {
    fontSize: 13,
    color: "#C9A84C",
    fontWeight: "600",
  },
  nextApptCancelBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#EF444411",
    borderWidth: 1,
    borderColor: "#EF444433",
  },
  nextApptCancelText: {
    fontSize: 13,
    color: "#EF4444",
    fontWeight: "600",
  },
  // ── Modal Avaliação Pós-Atendimento ────────────────────────────────────────
  reviewOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  reviewSheet: {
    backgroundColor: "#111",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderColor: "#2A2A2A",
  },
  reviewHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#333",
    alignSelf: "center",
    marginBottom: 20,
  },
  reviewTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#F5F5F0",
    textAlign: "center",
    marginBottom: 6,
  },
  reviewSubtitle: {
    fontSize: 14,
    color: "#888880",
    textAlign: "center",
    marginBottom: 20,
  },
  reviewStarsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    marginBottom: 20,
  },
  reviewStar: {
    fontSize: 40,
  },
  reviewInput: {
    backgroundColor: "#1E1E1E",
    borderWidth: 1,
    borderColor: "#2A2A2A",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#F5F5F0",
    marginBottom: 20,
    minHeight: 80,
    textAlignVertical: "top",
  },
  reviewBtns: {
    flexDirection: "row",
    gap: 12,
  },
  reviewBtnSkip: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2A2A2A",
    alignItems: "center",
  },
  reviewBtnSkipText: {
    fontSize: 14,
    color: "#888880",
    fontWeight: "600",
  },
  reviewBtnSend: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#C9A84C",
    alignItems: "center",
  },
  reviewBtnSendText: {
    fontSize: 14,
    color: "#0A0A0A",
    fontWeight: "800",
  },
});
