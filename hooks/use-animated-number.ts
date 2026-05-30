import { useEffect, useRef } from "react";
import { Animated } from "react-native";

/**
 * Animates a number from 0 to the target value.
 * Returns an Animated.Value — use with Animated.Text via interpolation.
 */
export function useAnimatedNumber(value: number, duration = 800) {
  const anim = useRef(new Animated.Value(0)).current;
  const displayValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!value) return;
    Animated.timing(anim, {
      toValue: value,
      duration,
      useNativeDriver: false, // needs JS driver for number interpolation
    }).start();
  }, [value]);

  return anim;
}

/**
 * Simple hook that returns a rounded integer that animates from 0 to target.
 * Use inside a component with useState + useEffect.
 */
export function useCountUp(target: number, duration = 900) {
  const animRef = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!target && target !== 0) return;
    animRef.setValue(0);
    Animated.timing(animRef, {
      toValue: target,
      duration,
      useNativeDriver: false,
    }).start();
  }, [target]);

  return animRef;
}
