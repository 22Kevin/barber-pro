/**
 * SortableGallery — galeria de fotos com reordenação por arrastar e soltar.
 *
 * Implementação baseada em posições absolutas + Gesture Handler.
 * Cada item pode ser pressionado longamente para entrar no modo de arrasto.
 */
import { useCallback, useRef, useState } from "react";
import {
  Image,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  Text,
  UIManager,
  View,
} from "react-native";
import { SingleImageUploader } from "@/components/media-uploader";

// Habilita LayoutAnimation no Android
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const ITEM_SIZE = 80;
const ITEM_GAP = 10;

interface SortableGalleryProps {
  images: string[];
  onChange: (newImages: string[]) => void;
  maxImages?: number;
}

export function SortableGallery({ images, onChange, maxImages = 8 }: SortableGalleryProps) {
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const dragStartX = useRef(0);
  const dragStartScrollX = useRef(0);
  const scrollRef = useRef<ScrollView>(null);

  // Reordena o array movendo o item de `from` para `to`
  const reorder = useCallback(
    (from: number, to: number) => {
      if (from === to) return;
      const next = [...images];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      onChange(next);
    },
    [images, onChange],
  );

  function removeImage(index: number) {
    const next = images.filter((_, i) => i !== index);
    onChange(next);
  }

  function addImage(url: string) {
    onChange([...images, url]);
  }

  // Calcula o índice alvo com base na posição X do toque
  function getTargetIndex(x: number): number {
    const idx = Math.round(x / (ITEM_SIZE + ITEM_GAP));
    return Math.max(0, Math.min(images.length - 1, idx));
  }

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      scrollEventThrottle={16}
      onScroll={(e) => {
        dragStartScrollX.current = e.nativeEvent.contentOffset.x;
      }}
    >
      <View style={{ flexDirection: "row", gap: ITEM_GAP, alignItems: "center" }}>
        {images.map((url, i) => {
          const isBeingDragged = draggingIndex === i;
          const isHover = hoverIndex === i && draggingIndex !== null && draggingIndex !== i;

          return (
            <View
              key={`${url}-${i}`}
              style={{
                position: "relative",
                opacity: isBeingDragged ? 0.4 : 1,
                transform: [{ scale: isHover ? 1.05 : 1 }],
              }}
            >
              {/* Drag handle (pressão longa) */}
              <Pressable
                onLongPress={() => {
                  setDraggingIndex(i);
                  setHoverIndex(i);
                }}
                onPressOut={() => {
                  if (draggingIndex !== null && hoverIndex !== null) {
                    reorder(draggingIndex, hoverIndex);
                  }
                  setDraggingIndex(null);
                  setHoverIndex(null);
                }}
                onTouchMove={(e) => {
                  if (draggingIndex === null) return;
                  const touchX = e.nativeEvent.pageX - dragStartScrollX.current;
                  const target = getTargetIndex(touchX);
                  if (target !== hoverIndex) setHoverIndex(target);
                }}
                delayLongPress={200}
                style={{ borderRadius: 10, overflow: "hidden" }}
              >
                <Image
                  source={{ uri: url }}
                  style={{
                    width: ITEM_SIZE,
                    height: ITEM_SIZE,
                    borderRadius: 10,
                    backgroundColor: "#1A1A1A",
                    borderWidth: isBeingDragged ? 2 : 0,
                    borderColor: "#C9A84C",
                  }}
                />
                {/* Ícone de arrastar */}
                <View
                  style={{
                    position: "absolute",
                    bottom: 4,
                    left: 0,
                    right: 0,
                    alignItems: "center",
                    opacity: 0.7,
                  }}
                >
                  <Text style={{ color: "#fff", fontSize: 10, textShadowColor: "#000", textShadowRadius: 4 }}>
                    ⠿
                  </Text>
                </View>
              </Pressable>

              {/* Botão remover */}
              <Pressable
                style={{
                  position: "absolute",
                  top: -6,
                  right: -6,
                  backgroundColor: "#EF4444",
                  borderRadius: 10,
                  width: 20,
                  height: 20,
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 10,
                }}
                onPress={() => removeImage(i)}
              >
                <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800" }}>✕</Text>
              </Pressable>

              {/* Indicador de posição alvo */}
              {isHover && draggingIndex !== null && draggingIndex !== i && (
                <View
                  style={{
                    position: "absolute",
                    left: -5,
                    top: 0,
                    bottom: 0,
                    width: 3,
                    backgroundColor: "#C9A84C",
                    borderRadius: 2,
                  }}
                />
              )}
            </View>
          );
        })}

        {/* Botão adicionar foto */}
        {images.length < maxImages && (
          <SingleImageUploader
            value={null}
            onUpload={addImage}
            imageType="gallery"
            label="+ Foto"
            size={ITEM_SIZE}
          />
        )}
      </View>
    </ScrollView>
  );
}
