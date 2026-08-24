import { useCallback, useEffect, useState } from "react";
import { Modal, Pressable, View } from "react-native";

import { AppText, AppTextInput } from "./AppText";
import { useThemeColor } from "../lib/useThemeColor";

export type TextInputDialogRequest = {
  readonly title: string;
  readonly initialValue: string;
  readonly confirmText: string;
  readonly onConfirm: (value: string) => void;
};

let presentRequest: ((request: TextInputDialogRequest) => void) | null = null;

export function showTextInputDialog(request: TextInputDialogRequest): void {
  presentRequest?.(request);
}

export function TextInputDialogHost() {
  const [request, setRequest] = useState<TextInputDialogRequest | null>(null);
  const [value, setValue] = useState("");
  const pressedOverlay = useThemeColor("--color-subtle");

  useEffect(() => {
    presentRequest = (nextRequest) => {
      setValue(nextRequest.initialValue);
      setRequest(nextRequest);
    };
    return () => {
      presentRequest = null;
    };
  }, []);

  const handleCancel = useCallback(() => setRequest(null), []);
  const handleConfirm = useCallback(() => {
    request?.onConfirm(value);
    setRequest(null);
  }, [request, value]);

  return (
    <Modal
      visible={request !== null}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={handleCancel}
    >
      {request === null ? null : (
        <View className="flex-1 items-center justify-center bg-backdrop px-8">
          <View className="w-full rounded-[24px] bg-card px-6 pb-4 pt-5">
            <AppText className="text-lg font-t3-medium">{request.title}</AppText>
            <AppTextInput
              autoFocus
              className="mt-4 rounded-xl bg-input px-3 py-2 text-base text-foreground"
              enterKeyHint="done"
              onChangeText={setValue}
              onSubmitEditing={handleConfirm}
              selectTextOnFocus
              value={value}
            />
            <View className="mt-4 flex-row justify-end gap-1">
              <View className="overflow-hidden rounded-full">
                <Pressable
                  accessibilityRole="button"
                  className="min-h-10 items-center justify-center px-4"
                  android_ripple={{ color: pressedOverlay }}
                  onPress={handleCancel}
                >
                  <AppText className="text-base font-t3-medium">Cancel</AppText>
                </Pressable>
              </View>
              <View className="overflow-hidden rounded-full">
                <Pressable
                  accessibilityRole="button"
                  className="min-h-10 items-center justify-center px-4"
                  android_ripple={{ color: pressedOverlay }}
                  onPress={handleConfirm}
                >
                  <AppText className="text-base font-t3-medium">{request.confirmText}</AppText>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      )}
    </Modal>
  );
}
