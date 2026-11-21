import React, { useEffect, useState } from "react";
import { Linking, Pressable, View } from "react-native";
import { Image } from "expo-image";
import Ionicons from "@expo/vector-icons/Ionicons";
import Storage from "expo-sqlite/kv-store";
import { API_URL } from "../api";
import { useApp } from "../state";
import { Txt } from "./ui";

interface Photo {
  city: string;
  landmark: string;
  url: string;
  width: number;
  height: number;
  author: string;
  authorUri?: string;
  count: number;
}

// what Geardown's server answered (the photo URL itself is Google's, short-lived): for this session only
const cache = new Map<string, Photo | null>();
const pickKey = (icao: string) => `cityphoto.${icao}`;

/**
 * A photo of the layover's city (its best-known landmark, from Google), as a banner across the top of a card:
 * the landmark's name, the photographer's credit as Google asks, and "another photo". Shown straight from
 * Google and not stored on the phone (expo-image, no cache). Nothing when Google has no photo.
 */
export function CityPhoto({ icao, height = 140 }: { icao: string; height?: number }) {
  const { t, locale } = useApp();
  const [n, setN] = useState<number | null>(null);
  const [photo, setPhoto] = useState<Photo | null | undefined>(undefined);
  useEffect(() => {
    void Storage.getItem(pickKey(icao)).then((v) => setN(Number(v) || 0)).catch(() => setN(0));
  }, [icao]);
  useEffect(() => {
    if (n === null) return;
    const k = `${icao}|${n}|${locale}`;
    if (cache.has(k)) return setPhoto(cache.get(k));
    let alive = true;
    fetch(`${API_URL}/api/city-photo?icao=${icao}&lang=${locale === "fr" ? "fr" : "en"}&n=${n}`)
      .then((r) => (r.ok ? r.json() : { photo: null }))
      .then((d: { photo: Photo | null }) => {
        cache.set(k, d.photo);
        if (alive) setPhoto(d.photo);
      })
      .catch(() => alive && setPhoto(null));
    return () => {
      alive = false;
    };
  }, [icao, n, locale]);
  if (photo === null) return null;
  const next = () => {
    const v = (n ?? 0) + 1;
    setN(v);
    void Storage.setItem(pickKey(icao), String(v)).catch(() => undefined);
  };
  return (
    <View style={{ height, backgroundColor: "#12304d", overflow: "hidden" }}>
      {photo ? (
        <Image source={{ uri: photo.url }} cachePolicy="none" contentFit="cover" transition={300} style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }} accessibilityLabel={photo.landmark} />
      ) : null}
      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: height * 0.55, backgroundColor: "rgba(0,0,0,0.35)" }} />
      {photo ? (
        <>
          <Txt numberOfLines={1} color="#fff" style={{ position: "absolute", left: 12, bottom: 8, right: 120, fontSize: 13, fontWeight: "700" }}>{photo.landmark}</Txt>
          <Pressable onPress={() => photo.authorUri && void Linking.openURL(photo.authorUri)} hitSlop={6} style={{ position: "absolute", right: 10, bottom: 9, maxWidth: 140 }}>
            <Txt numberOfLines={1} color="rgba(255,255,255,0.85)" style={{ fontSize: 9.5 }}>{t("lay.photoCredit", { name: photo.author || "Google" })}</Txt>
          </Pressable>
          {photo.count > 1 ? (
            <Pressable onPress={next} hitSlop={8} accessibilityLabel={t("lay.otherPhoto")} style={{ position: "absolute", right: 10, top: 10, width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.5)" }}>
              <Ionicons name="refresh" size={15} color="#fff" />
            </Pressable>
          ) : null}
        </>
      ) : null}
    </View>
  );
}
