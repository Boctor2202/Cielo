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
import { isDemoAccount } from "@cielo/core";
import { api } from "../api";
import { useApp } from "../state";
import { Glass, Row, Txt } from "./ui";

export interface Photo {
  id: string;
  src: string;
  width: number;
  height: number;
  photographer: string;
  link: string;
}

// JSON only (allowed up to 24 h by the terms; here only for the app session)
const metadata = new Map<string, Photo | null>();

/** The Planespotters photo of an exact aircraft: undefined while loading, null when there is none. */
export function useAircraftPhoto(registration: string | undefined): Photo | null | undefined {
  const { access, pilot } = useApp();
  // demo data uses fictional registrations: a real aircraft wearing them would show the wrong photo
  const fictional = access.demo || isDemoAccount(pilot.email);
  const reg = registration?.trim().toUpperCase();
  const [photo, setPhoto] = useState<Photo | null | undefined>(reg ? metadata.get(reg) : null);
  useEffect(() => {
    if (fictional || !reg || reg.length < 3) return setPhoto(null);
    if (metadata.has(reg)) return setPhoto(metadata.get(reg)!);
    setPhoto(undefined);
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
  }, [reg, fictional]);
  return photo;
}

export function AircraftPhoto({ registration }: { registration?: string }) {
  const { t } = useApp();
  const reg = registration?.trim().toUpperCase();
  const photo = useAircraftPhoto(reg);
  if (!photo) return null;
  const open = () => void Linking.openURL(photo.link);
  // Planespotters' largest free size is about 420 px wide: shown at 160 pt it stays sharp on a Retina screen,
  // where stretching it across the screen made it blurry.
  const w = 160;
  return (
    <Glass radius={16}>
      <Row style={{ padding: 10, gap: 12, alignItems: "center" }}>
        <Pressable onPress={open} accessibilityRole="link" accessibilityLabel={t("photo.open")}>
          <Image
            source={{ uri: photo.src }}
            cachePolicy="none"
            contentFit="cover"
            transition={250}
            style={{ width: w, height: Math.round((w * photo.height) / photo.width), borderRadius: 10 }}
            accessibilityLabel={t("photo.alt", { reg: reg ?? "" })}
          />
        </Pressable>
        <View style={{ flex: 1, gap: 4 }}>
          <Txt mono style={{ fontSize: 18, fontWeight: "700" }}>{reg}</Txt>
          <Pressable onPress={open} hitSlop={8}>
            <Txt variant="small">
              {t("photo.credit", { name: photo.photographer })} <Txt variant="small" style={{ textDecorationLine: "underline" }}>Planespotters.net</Txt>
            </Txt>
          </Pressable>
        </View>
      </Row>
    </Glass>
  );
}
