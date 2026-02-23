import React, { useState, useRef } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
} from "react-native";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 5;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function getDaysInMonth(month: number, year: number) {
  return new Date(year, month, 0).getDate();
}

function WheelColumn({
  items,
  selectedIndex,
  onSelect,
  width,
}: {
  items: string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  width: number;
}) {
  const scrollRef = useRef<ScrollView>(null);

  const handleMomentumEnd = (e: any) => {
    const offset = e.nativeEvent.contentOffset.y;
    const index = Math.round(offset / ITEM_HEIGHT);
    const clamped = Math.max(0, Math.min(index, items.length - 1));
    onSelect(clamped);
    scrollRef.current?.scrollTo({ y: clamped * ITEM_HEIGHT, animated: true });
  };

  return (
    <View style={{ width, height: PICKER_HEIGHT, overflow: "hidden" }}>
      {/* Highlight strip */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: ITEM_HEIGHT * 2,
          left: 0,
          right: 0,
          height: ITEM_HEIGHT,
          backgroundColor: "rgba(234,179,8,0.12)",
          borderTopWidth: 1,
          borderBottomWidth: 1,
          borderColor: "#EAB308",
          zIndex: 1,
        }}
      />
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        contentOffset={{ x: 0, y: selectedIndex * ITEM_HEIGHT }}
        onMomentumScrollEnd={handleMomentumEnd}
        contentContainerStyle={{ paddingVertical: ITEM_HEIGHT * 2 }}
      >
        {items.map((item, i) => (
          <TouchableOpacity
            key={i}
            onPress={() => {
              onSelect(i);
              scrollRef.current?.scrollTo({ y: i * ITEM_HEIGHT, animated: true });
            }}
            style={{ height: ITEM_HEIGHT, justifyContent: "center", alignItems: "center" }}
          >
            <Text
              style={{
                color: i === selectedIndex ? "#EAB308" : "#9CA3AF",
                fontSize: i === selectedIndex ? 17 : 15,
                fontWeight: i === selectedIndex ? "700" : "400",
              }}
            >
              {item}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

interface DatePickerModalProps {
  visible: boolean;
  value: string | null; // "YYYY-MM-DD"
  onConfirm: (date: string) => void;
  onCancel: () => void;
}

export function DatePickerModal({ visible, value, onConfirm, onCancel }: DatePickerModalProps) {
  const currentYear = new Date().getFullYear();

  // Parse initial value
  const parseInitial = () => {
    if (value) {
      const parts = value.split("-");
      if (parts.length === 3) {
        return {
          day: parseInt(parts[2], 10) - 1,
          month: parseInt(parts[1], 10) - 1,
          year: currentYear - parseInt(parts[0], 10) <= 0
            ? currentYear - 25
            : parseInt(parts[0], 10),
        };
      }
    }
    return { day: 0, month: 0, year: currentYear - 25 };
  };

  const initial = parseInitial();
  const [selectedDay, setSelectedDay] = useState(initial.day);
  const [selectedMonth, setSelectedMonth] = useState(initial.month);
  const [selectedYear, setSelectedYear] = useState(initial.year);

  // Generate years: 1930 to current year
  const years = Array.from({ length: currentYear - 1929 }, (_, i) => String(currentYear - i));
  const yearIndex = years.indexOf(String(selectedYear));

  const daysInMonth = getDaysInMonth(selectedMonth + 1, selectedYear);
  const days = Array.from({ length: daysInMonth }, (_, i) => String(i + 1).padStart(2, "0"));

  // Clamp day if month/year changes reduce max days
  const clampedDay = Math.min(selectedDay, daysInMonth - 1);

  const handleConfirm = () => {
    const y = selectedYear;
    const m = String(selectedMonth + 1).padStart(2, "0");
    const d = String(clampedDay + 1).padStart(2, "0");
    onConfirm(`${y}-${m}-${d}`);
  };

  const formatPreview = () => {
    const d = String(clampedDay + 1).padStart(2, "0");
    const m = String(selectedMonth + 1).padStart(2, "0");
    return `${d}/${m}/${selectedYear}`;
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} onPress={onCancel} />
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onCancel}>
              <Text style={styles.cancelText}>Cancelar</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Data de Nascimento</Text>
            <TouchableOpacity onPress={handleConfirm}>
              <Text style={styles.confirmText}>Confirmar</Text>
            </TouchableOpacity>
          </View>

          {/* Preview */}
          <View style={styles.preview}>
            <Text style={styles.previewText}>{formatPreview()}</Text>
          </View>

          {/* Wheels */}
          <View style={styles.wheelsRow}>
            {/* Dia */}
            <WheelColumn
              items={days}
              selectedIndex={clampedDay}
              onSelect={setSelectedDay}
              width={60}
            />
            {/* Mês */}
            <WheelColumn
              items={MONTHS}
              selectedIndex={selectedMonth}
              onSelect={setSelectedMonth}
              width={140}
            />
            {/* Ano */}
            <WheelColumn
              items={years}
              selectedIndex={yearIndex >= 0 ? yearIndex : 0}
              onSelect={(i) => setSelectedYear(parseInt(years[i], 10))}
              width={80}
            />
          </View>

          <View style={{ height: 20 }} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  sheet: {
    backgroundColor: "#0F172A",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: "#1F2937",
    paddingTop: 8,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1F2937",
  },
  title: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  cancelText: {
    color: "#9CA3AF",
    fontSize: 15,
  },
  confirmText: {
    color: "#EAB308",
    fontWeight: "700",
    fontSize: 15,
  },
  preview: {
    alignItems: "center",
    paddingVertical: 12,
  },
  previewText: {
    color: "#EAB308",
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 1,
  },
  wheelsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
  },
});
