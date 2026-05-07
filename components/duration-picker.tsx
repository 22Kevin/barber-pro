import React, { useRef, useEffect } from "react";
import { useColors } from "@/hooks/use-colors";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
} from "react-native";

const ITEM_HEIGHT = 48;
const VISIBLE_ITEMS = 5;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;

const HOURS = Array.from({ length: 9 }, (_, i) => i); // 0–8 horas
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

interface DurationPickerProps {
  visible: boolean;
  value: number; // duração em minutos
  onConfirm: (minutes: number) => void;
  onCancel: () => void;
}

function WheelColumn({
  items,
  selectedIndex,
  onSelect,
  label,
  formatItem,
}: {
  items: number[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  label: string;
  formatItem: (v: number) => string;
}) {
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      scrollRef.current?.scrollTo({
        y: selectedIndex * ITEM_HEIGHT,
        animated: false,
      });
    }, 50);
    return () => clearTimeout(timeout);
  }, [selectedIndex]);

  const colors = useColors();
  const styles = createStyles(colors);

  function handleScrollEnd(e: any) {
    const offsetY = e.nativeEvent.contentOffset.y;
    const index = Math.round(offsetY / ITEM_HEIGHT);
    const clamped = Math.max(0, Math.min(index, items.length - 1));
    onSelect(clamped);
    scrollRef.current?.scrollTo({ y: clamped * ITEM_HEIGHT, animated: true });
  }

  return (
    <View style={styles.column}>
      <Text style={styles.columnLabel}>{label}</Text>
      <View style={styles.wheelWrapper}>
        {/* Linha de seleção */}
        <View style={styles.selectionLine} pointerEvents="none" />
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          snapToInterval={ITEM_HEIGHT}
          decelerationRate="fast"
          onMomentumScrollEnd={handleScrollEnd}
          contentContainerStyle={{ paddingVertical: ITEM_HEIGHT * 2 }}
        >
          {items.map((val, idx) => {
            const isSelected = idx === selectedIndex;
            return (
              <View key={val} style={styles.item}>
                <Text
                  style={[
                    styles.itemText,
                    isSelected && styles.itemTextSelected,
                  ]}
                >
                  {formatItem(val)}
                </Text>
              </View>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

export function DurationPicker({
  visible,
  value,
  onConfirm,
  onCancel,
}: DurationPickerProps) {
  const colors = useColors();
  const styles = createStyles(colors);
  const totalMinutes = value || 30;
  const initHour = Math.floor(totalMinutes / 60);
  const initMin = totalMinutes % 60;

  const hourIdx = Math.max(0, Math.min(initHour, HOURS.length - 1));
  const minIdx = MINUTES.indexOf(Math.round(initMin / 5) * 5);
  const safeMinIdx = minIdx >= 0 ? minIdx : 0;

  const [selectedHour, setSelectedHour] = React.useState(hourIdx);
  const [selectedMin, setSelectedMin] = React.useState(safeMinIdx);

  // Reinicializa quando o modal abre
  useEffect(() => {
    if (visible) {
      const h = Math.floor(totalMinutes / 60);
      const m = totalMinutes % 60;
      setSelectedHour(Math.max(0, Math.min(h, HOURS.length - 1)));
      const mi = MINUTES.indexOf(Math.round(m / 5) * 5);
      setSelectedMin(mi >= 0 ? mi : 0);
    }
  }, [visible]);

  function handleConfirm() {
    const hours = HOURS[selectedHour];
    const mins = MINUTES[selectedMin];
    const total = hours * 60 + mins;
    onConfirm(total > 0 ? total : 5); // mínimo 5 minutos
  }

  const previewHours = HOURS[selectedHour];
  const previewMins = MINUTES[selectedMin];
  const previewText =
    previewHours > 0 && previewMins > 0
      ? `${previewHours}h ${previewMins}min`
      : previewHours > 0
      ? `${previewHours}h`
      : `${previewMins}min`;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onCancel} style={styles.headerBtn}>
              <Text style={styles.cancelText}>Cancelar</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Duração do Serviço</Text>
            <TouchableOpacity onPress={handleConfirm} style={styles.headerBtn}>
              <Text style={styles.confirmText}>OK</Text>
            </TouchableOpacity>
          </View>

          {/* Preview */}
          <View style={styles.preview}>
            <Text style={styles.previewText}>{previewText}</Text>
          </View>

          {/* Wheels */}
          <View style={styles.wheels}>
            <WheelColumn
              items={HOURS}
              selectedIndex={selectedHour}
              onSelect={setSelectedHour}
              label="Horas"
              formatItem={(v) => String(v).padStart(2, "0")}
            />
            <Text style={styles.separator}>:</Text>
            <WheelColumn
              items={MINUTES}
              selectedIndex={selectedMin}
              onSelect={setSelectedMin}
              label="Minutos"
              formatItem={(v) => String(v).padStart(2, "0")}
            />
          </View>

          {/* Atalhos rápidos */}
          <View style={styles.shortcuts}>
            {[15, 30, 45, 60, 90, 120].map((min) => {
              const h = Math.floor(min / 60);
              const m = min % 60;
              const label = h > 0 && m > 0 ? `${h}h${m}` : h > 0 ? `${h}h` : `${m}min`;
              const isActive = HOURS[selectedHour] * 60 + MINUTES[selectedMin] === min;
              return (
                <TouchableOpacity
                  key={min}
                  style={[styles.shortcut, isActive && styles.shortcutActive]}
                  onPress={() => {
                    setSelectedHour(Math.max(0, Math.min(Math.floor(min / 60), HOURS.length - 1)));
                    const mi = MINUTES.indexOf(min % 60);
                    setSelectedMin(mi >= 0 ? mi : 0);
                  }}
                >
                  <Text style={[styles.shortcutText, isActive && styles.shortcutTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function createStyles(c: ReturnType<typeof import("@/hooks/use-colors").useColors>) {
  return StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#111111",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1F2937",
  },
  headerBtn: {
    minWidth: 72,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  cancelText: {
    color: "#9CA3AF",
    fontSize: 15,
  },
  confirmText: {
    color: "#C9A84C",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "right",
  },
  preview: {
    alignItems: "center",
    paddingVertical: 12,
  },
  previewText: {
    color: "#C9A84C",
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: 1,
  },
  wheels: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    height: PICKER_HEIGHT,
  },
  column: {
    flex: 1,
    alignItems: "center",
  },
  columnLabel: {
    color: "#6B7280",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 4,
    position: "absolute",
    top: -18,
  },
  wheelWrapper: {
    height: PICKER_HEIGHT,
    width: 80,
    overflow: "hidden",
    position: "relative",
  },
  selectionLine: {
    position: "absolute",
    top: ITEM_HEIGHT * 2,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#C9A84C",
    zIndex: 10,
  },
  item: {
    height: ITEM_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  itemText: {
    color: "#4B5563",
    fontSize: 28,
    fontWeight: "400",
  },
  itemTextSelected: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "700",
  },
  separator: {
    color: "#C9A84C",
    fontSize: 32,
    fontWeight: "700",
    marginHorizontal: 8,
    marginTop: 16,
  },
  shortcuts: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  shortcut: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#374151",
    backgroundColor: c.surface,
  },
  shortcutActive: {
    borderColor: "#C9A84C",
    backgroundColor: "#2A2200",
  },
  shortcutText: {
    color: "#9CA3AF",
    fontSize: 13,
    fontWeight: "500",
  },
  shortcutTextActive: {
    color: "#C9A84C",
    fontWeight: "700",
  },
});
}
