import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { AdminHeader } from "@/components/admin-header";
import { trpc } from "@/lib/trpc";
import { useBarberAuth } from "@/lib/auth-context";
import { useColors } from "@/hooks/use-colors";

function StarRating({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Text key={star} style={{ fontSize: size, color: star <= rating ? "#C9A84C" : "#444" }}>
          ★
        </Text>
      ))}
    </View>
  );
}

function formatDate(date: Date | string) {
  const d = new Date(date);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function ReviewsScreen() {
  const colors = useColors();
  const { barber } = useBarberAuth();
  const tenantId = barber?.tenantId ?? undefined;

  const reviewsQuery = trpc.reviews.recent.useQuery(
    { limit: 50, tenantId },
    { refetchInterval: 60000 }
  );

  const reviews = reviewsQuery.data ?? [];

  // Calcular estatísticas
  const totalReviews = reviews.length;
  const avgRating = totalReviews > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews
    : 0;
  const ratingCounts = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => r.rating === star).length,
  }));

  const dyn = StyleSheet.create({
    statsCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      margin: 16,
      padding: 16,
    },
    avgNumber: {
      fontSize: 48,
      fontWeight: "800",
      color: "#C9A84C",
      lineHeight: 56,
    },
    avgLabel: {
      fontSize: 12,
      color: colors.muted,
      marginTop: 2,
    },
    barRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 6,
    },
    barLabel: {
      fontSize: 12,
      color: colors.muted,
      width: 14,
      textAlign: "right",
    },
    barTrack: {
      flex: 1,
      height: 8,
      backgroundColor: colors.border,
      borderRadius: 4,
      overflow: "hidden",
    },
    barFill: {
      height: 8,
      backgroundColor: "#C9A84C",
      borderRadius: 4,
    },
    barCount: {
      fontSize: 11,
      color: colors.muted,
      width: 24,
      textAlign: "right",
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      marginHorizontal: 16,
      marginBottom: 10,
      padding: 14,
    },
    cardHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 6,
    },
    clientName: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.foreground,
      flex: 1,
    },
    dateText: {
      fontSize: 11,
      color: colors.muted,
    },
    serviceName: {
      fontSize: 12,
      color: colors.muted,
      marginBottom: 6,
    },
    comment: {
      fontSize: 13,
      color: colors.foreground,
      lineHeight: 19,
      fontStyle: "italic",
    },
    emptyContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingTop: 60,
    },
    emptyText: {
      fontSize: 15,
      color: colors.muted,
      textAlign: "center",
      marginTop: 12,
    },
  });

  if (reviewsQuery.isLoading) {
    return (
      <ScreenContainer>
        <AdminHeader title="Avaliações" />
        <View style={dyn.emptyContainer}>
          <ActivityIndicator color="#C9A84C" size="large" />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <AdminHeader title="Avaliações" />
      <FlatList
        data={reviews}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={() => (
          <View style={dyn.statsCard}>
            <View style={{ flexDirection: "row", gap: 24, alignItems: "flex-start" }}>
              {/* Nota média */}
              <View style={{ alignItems: "center" }}>
                <Text style={dyn.avgNumber}>{avgRating.toFixed(1)}</Text>
                <StarRating rating={Math.round(avgRating)} size={16} />
                <Text style={dyn.avgLabel}>{totalReviews} avaliação{totalReviews !== 1 ? "ões" : ""}</Text>
              </View>
              {/* Barras de distribuição */}
              <View style={{ flex: 1, justifyContent: "center" }}>
                {ratingCounts.map(({ star, count }) => (
                  <View key={star} style={dyn.barRow}>
                    <Text style={dyn.barLabel}>{star}</Text>
                    <View style={dyn.barTrack}>
                      <View
                        style={[
                          dyn.barFill,
                          { width: totalReviews > 0 ? `${(count / totalReviews) * 100}%` : "0%" },
                        ]}
                      />
                    </View>
                    <Text style={dyn.barCount}>{count}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}
        renderItem={({ item }) => (
          <View style={dyn.card}>
            <View style={dyn.cardHeader}>
              <Text style={dyn.clientName} numberOfLines={1}>
                {item.clientName}
              </Text>
              <Text style={dyn.dateText}>{formatDate(item.createdAt)}</Text>
            </View>
            <Text style={dyn.serviceName}>{item.serviceName}</Text>
            <StarRating rating={item.rating} />
            {item.comment ? (
              <Text style={[dyn.comment, { marginTop: 8 }]}>"{item.comment}"</Text>
            ) : null}
          </View>
        )}
        ListEmptyComponent={() => (
          <View style={dyn.emptyContainer}>
            <Text style={{ fontSize: 40 }}>⭐</Text>
            <Text style={dyn.emptyText}>Nenhuma avaliação ainda.{"\n"}As avaliações dos clientes aparecerão aqui.</Text>
          </View>
        )}
        contentContainerStyle={{ paddingBottom: 32 }}
      />
    </ScreenContainer>
  );
}
