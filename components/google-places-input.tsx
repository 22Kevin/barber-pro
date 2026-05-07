import { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from "react-native";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

interface PlacePrediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

interface GooglePlacesInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onSelectAddress: (address: string, placeId: string) => void;
  placeholder?: string;
}

export function GooglePlacesInput({
  value,
  onChangeText,
  onSelectAddress,
  placeholder = "Digite o endereço...",
}: GooglePlacesInputProps) {
  const colors = useColors();
  const styles = createStyles(colors);
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function fetchPredictions(text: string) {
    if (text.length < 3) {
      setPredictions([]);
      setShowDropdown(false);
      return;
    }

    setLoading(true);
    try {
      const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(text)}&language=pt-BR&components=country:br&key=${GOOGLE_MAPS_API_KEY}`;
      const response = await fetch(url);
      const data = await response.json();
      if (data.status === "OK") {
        setPredictions(data.predictions ?? []);
        setShowDropdown(true);
      } else {
        setPredictions([]);
        setShowDropdown(false);
      }
    } catch {
      setPredictions([]);
    } finally {
      setLoading(false);
    }
  }

  function handleTextChange(text: string) {
    onChangeText(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchPredictions(text), 400);
  }

  function handleSelect(prediction: PlacePrediction) {
    onSelectAddress(prediction.description, prediction.place_id);
    onChangeText(prediction.description);
    setPredictions([]);
    setShowDropdown(false);
  }

  return (
    <View style={styles.container}>
      <View style={styles.inputWrapper}>
        <IconSymbol name="location.fill" size={16} color="#C9A84C" style={styles.icon} />
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={handleTextChange}
          placeholder={placeholder}
          placeholderTextColor="#555"
          autoCorrect={false}
          returnKeyType="done"
          onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
          onFocus={() => value.length >= 3 && predictions.length > 0 && setShowDropdown(true)}
        />
        {loading && <ActivityIndicator size="small" color="#C9A84C" style={{ marginRight: 10 }} />}
      </View>

      {showDropdown && predictions.length > 0 && (
        <View style={styles.dropdown}>
          <FlatList
            data={predictions}
            keyExtractor={(item) => item.place_id}
            keyboardShouldPersistTaps="handled"
            scrollEnabled={false}
            renderItem={({ item, index }) => (
              <Pressable
                style={[styles.predictionItem, index < predictions.length - 1 && styles.predictionBorder]}
                onPress={() => handleSelect(item)}
              >
                <IconSymbol name="mappin" size={14} color="#888880" style={{ marginTop: 2 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.predictionMain}>{item.structured_formatting.main_text}</Text>
                  <Text style={styles.predictionSecondary}>{item.structured_formatting.secondary_text}</Text>
                </View>
              </Pressable>
            )}
          />
        </View>
      )}
    </View>
  );
}

function createStyles(c: ReturnType<typeof import("@/hooks/use-colors").useColors>) {
  return StyleSheet.create({
  container: { position: "relative", zIndex: 100 },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: "#C9A84C44",
    borderRadius: 10,
  },
  icon: { marginLeft: 12 },
  input: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 12,
    fontSize: 15,
    color: c.foreground,
  },
  dropdown: {
    position: Platform.OS === "web" ? "absolute" : "relative",
    top: Platform.OS === "web" ? "100%" : undefined,
    left: 0,
    right: 0,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 10,
    marginTop: Platform.OS === "web" ? 4 : 0,
    overflow: "hidden",
    zIndex: 200,
  },
  predictionItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 12,
    gap: 10,
  },
  predictionBorder: {
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  predictionMain: { fontSize: 14, color: c.foreground, fontWeight: "600" },
  predictionSecondary: { fontSize: 12, color: c.muted, marginTop: 2 },
});
}
