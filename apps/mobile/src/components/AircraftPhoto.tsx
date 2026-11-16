/**
 * Photo of the exact aircraft (by registration) from the Planespotters.net public photo API, through the
 * Geardown API (https://www.planespotters.net/photo/api#terms):
 * - the image is loaded straight from the returned URL, unchanged, and NOT written to the device:
 *   expo-image with cachePolicy "none" (React Native's <Image> would keep it in the disk cache);
 * - the photographer is credited next to the image and a tap opens the photo page (`link`).
 */
import React, { useEffect, useState } from "react";
import { Linking, Pressable, View } from "react-native";
import { Image } from "expo-image";
import { api } from "../api";
import { useApp } from "../state";
import { Txt } from "./ui";

interface Photo {
  id: string;
  src: string;
  width: number;
  height: number;
  photographer: string;
  link: string;
}

// JSON only (allowed up to 24 h by the terms; here only for the app session)
const metadata = new Map<string, Photo | null>();

export function AircraftPhoto({ registration }: { registration?: string }) {
  const { t } = useApp();
  const reg = registration?.trim().toUpperCase();
  const [photo, setPhoto] = useState<Photo | null>(reg ? (metadata.get(reg) ?? null) : null);
  useEffect(() => {
    if (!reg || reg.length < 3) return setPhoto(null);
    if (metadata.has(reg)) return setPhoto(metadata.get(reg)!);
    let alive = true;
    api<{ photo: Photo | null }>(`/api/aircraft-photo?reg=${encodeURIComponent(reg)}`)
      .then((d) => {
        metadata.set(reg, d.photo);
        if (alive) setPhoto(d.photo);
      })
      .catch(() => alive && setPhoto(null));
    return () => {
      alive = false;
    };
  }, [reg]);
  if (!photo) return null;
  const open = () => void Linking.openURL(photo.link);
  return (
    <View style={{ gap: 6 }}>
      <Pressable onPress={open} accessibilityRole="link" accessibilityLabel={t("photo.open")}>
        <Image
          source={{ uri: photo.src }}
          cachePolicy="none"
          contentFit="contain"
          style={{ width: "100%", aspectRatio: photo.width / photo.height, borderRadius: 12 }}
          accessibilityLabel={t("photo.alt", { reg: reg ?? "" })}
        />
      </Pressable>
      <Pressable onPress={open} hitSlop={8}>
        <Txt variant="small">
          {t("photo.credit", { name: photo.photographer })} <Txt variant="small" style={{ textDecorationLine: "underline" }}>Planespotters.net</Txt>
        </Txt>
      </Pressable>
    </View>
  );
}
