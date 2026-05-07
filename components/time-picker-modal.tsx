import React, { useRef, useEffect } from "react";
import { useColors } from "@/hooks/use-colors";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Modal,
  TouchableOpacity,
} from "react-native";

const ITEM_HEIGHT = 48;
const VISIBLE_ITEMS = 5;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;

const HOURS = Array.from({ length: 24 }, (_, i) => i); // 0–23
const MINUTES = [0, 15, 30, 45]; // intervalos de 15 min

interface TimePickerModalProps {
  visible: boolean;
  title: string;
  value: string; // formato "HH:MM"
  onConfirm: (time: string) => void;
  onCancel: () => void;
  minTime?: string; // hora mínima permitida (ex: "09:00")
}

function WheelColumn({
  items,
  selectedIndex,
  onSelect,
  formatItem,
}: {
  items: number[];
  selectedIndex: number;
  onSelect: (index: number) => void;
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
    <View style={styles.wheelWrapper}>
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
  );
}

export function TimePickerModal({
  visible,
  title,
  value,
  onConfirm,
  onCancel,
}: TimePickerModalProps) {
  const colors = useColors();
  const styles = createStyles(colors);
  const parseTime = (t: string) => {
    const [h, m] = (t || "09:00").split(":").map(Number);
    return {
      hourIdx: Math.max(0, Math.min(h, HOURS.length - 1)),
      minIdx: Math.max(0, MINUTES.indexOf(Math.round(m / 15) * 15 % 60)),
    };
  };

  const init = parseTime(value);
  const [selectedHour, setSelectedHour] = React.useState(init.hourIdx);
  const [selectedMin, setSelectedMin] = React.useState(init.minIdx);

  useEffect(() => {
    if (visible) {
      const { hourIdx, minIdx } = parseTime(value);
      setSelectedHour(hourIdx);
      setSelectedMin(minIdx >= 0 ? minIdx : 0);
    }
  }, [visible, value]);

  function handleConfirm() {
    const h = String(HOURS[selectedHour]).padStart(2, "0");
    const m = String(MINUTES[selectedMin]).padStart(2, "0");
    onConfirm(`${h}:${m}`);
  }

  const previewH = String(HOURS[selectedHour]).padStart(2, "0");
  const previewM = String(MINUTES[selectedMin]).padStart(2, "0");

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
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={handleConfirm} style={styles.headerBtn}>
              <Text style={styles.confirmText}>OK</Text>
            </TouchableOpacity>
          </View>

          {/* Preview */}
          <View style={styles.preview}>
            <Text style={styles.previewText}>{previewH}:{previewM}</Text>
          </View>

          {/* Wheels */}
          <View style={styles.wheels}>
            <View style={styles.column}>
              <Text style={styles.columnLabel}>Hora</Text>
              <WheelColumn
                items={HOURS}
                selectedIndex={selectedHour}
                onSelect={setSelectedHour}
                formatItem={(v) => String(v).padStart(2, "0")}
              />
            </View>
            <Text style={styles.separator}>:</Text>
            <View style={styles.column}>
              <Text style={styles.columnLabel}>Min</Text>
              <WheelColumn
                items={MINUTES}
                selectedIndex={selectedMin}
                onSelect={setSelectedMin}
                formatItem={(v) => String(v).padStart(2, "0")}
              />
            </View>
          </View>

          {/* Atalhos rápidos */}
          <View style={styles.shortcuts}>
            {["07:00", "08:00", "09:00", "10:00", "12:00", "13:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00"].map((t) => {
              const { hourIdx, minIdx } = parseTime(t);
              const isActive = selectedHour === hourIdx && selectedMin === (minIdx >= 0 ? minIdx : 0);
              return (
                <TouchableOpacity
                  key={t}
                  style={[styles.shortcut, isActive && styles.shortcutActive]}
                  onPress={() => {
                    const { hourIdx: h, minIdx: m } = parseTime(t);
                    setSelectedHour(h);
                    setSelectedMin(m >= 0 ? m : 0);
                  }}
                >
                  <Text style={[styles.shortcutText, isActive && styles.shortcutTextActive]}>
                    {t}
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
  headerBtn: { minWidth: 72 },
  title: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  cancelText: { color: "#9CA3AF", fontSize: 15 },
  confirmText: { color: "#C9A84C", fontSize: 15, fontWeight: "700", textAlign: "right" },
  preview: { alignItems: "center", paddingVertical: 12 },
  previewText: { color: "#C9A84C", fontSize: 36, fontWeight: "700", letterSpacing: 4 },
  wheels: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    height: PICKER_HEIGHT,
  },
  column: { flex: 1, alignItems: "center" },
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
  item: { height: ITEM_HEIGHT, alignItems: "center", justifyContent: "center" },
  itemText: { color: "#4B5563", fontSize: 28, fontWeight: "400" },
  itemTextSelected: { color: "#FFFFFF", fontSize: 32, fontWeight: "700" },
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
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#374151",
    backgroundColor: c.surface,
  },
  shortcutActive: { borderColor: "#C9A84C", backgroundColor: "#2A2200" },
  shortcutText: { color: "#9CA3AF", fontSize: 13, fontWeight: "500" },
  shortcutTextActive: { color: "#C9A84C", fontWeight: "700" },
});
}
