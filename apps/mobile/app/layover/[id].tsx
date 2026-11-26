import React, { useEffect, useMemo, useState } from "react";
import { AirportWeather } from "../../src/components/Weather";
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, View } from "react-native";
import { Image } from "expo-image";
import { router, Stack, useLocalSearchParams } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import type { Layover } from "@cielo/core";
import { Button, Card, Chip, Field, Row, Screen, Txt } from "../../src/components/ui";
import { DateField, isValidDate } from "../../src/components/DateField";
import { lookupAirport } from "../../src/airports";
import { API_URL, api, ApiError, fmtDistance, PLACE_CATEGORIES, type HotelHit, type Place, type PlaceCategory } from "../../src/api";
import { formatDate, type I18nKey } from "../../src/i18n";
import { ReadOnlyError, useApp } from "../../src/state";
import { Requires } from "../../src/components/Access";
import { useTheme } from "../../src/theme";

type Load<T> = { state: "idle" | "loading" | "ok" | "error" | "not_configured"; data: T };

/** One layover: the crew hotel, then the best-rated places around it and the shows during the stay. */
export default function LayoverRoute() {
  return (
    <Requires feature="layovers">
      <LayoverScreen />
    </Requires>
  );
}

function LayoverScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, layovers, put, remove, locale } = useApp();
  const c = useTheme();
  const l = layovers.find((x) => x.id === id);
  const airport = l ? lookupAirport(l.airportIcao) : undefined;
  const [hotel, setHotel] = useState<HotelHit | null>(null);
  const [searching, setSearching] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Load<HotelHit[]>>({ state: "idle", data: [] });
  const [cat, setCat] = useState<PlaceCategory>("restaurants");
  const [places, setPlaces] = useState<Load<Place[]>>({ state: "idle", data: [] });
  const [shownCount, setShownCount] = useState(8);

  // the saved hotel's position (only its Google place id is stored)
  useEffect(() => {
    if (!l?.hotelPlaceId) return setHotel(null);
    api<{ hotel: HotelHit }>(`/api/escale/hotel?id=${encodeURIComponent(l.hotelPlaceId)}&lang=${locale}`)
      .then((d) => setHotel(d.hotel))
      .catch(() => setHotel(null));
  }, [l?.hotelPlaceId, locale]);

  const center = useMemo(() => (hotel ? { lat: hotel.lat, lng: hotel.lng } : airport ? { lat: airport.lat, lng: airport.lon } : null), [hotel, airport]);

  const fail = (e: unknown) => (e instanceof ApiError && e.code === "not_configured" ? "not_configured" : "error") as "error" | "not_configured";

  useEffect(() => {
    if (!center) return;
    setPlaces({ state: "loading", data: [] });
    setShownCount(8);
    api<{ places: Place[] }>(`/api/escale/places?lat=${center.lat}&lng=${center.lng}&cat=${cat}&lang=${locale}`)
      .then((d) => setPlaces({ state: "ok", data: d.places }))
      .catch((e) => setPlaces({ state: fail(e), data: [] }));
  }, [center, cat, locale]);


  const searchHotels = (near: boolean) => {
    if (!airport) return;
    setHits({ state: "loading", data: [] });
    const qs = near ? `near=1&lat=${airport.lat}&lng=${airport.lon}` : `q=${encodeURIComponent(q)}&lat=${airport.lat}&lng=${airport.lon}`;
    api<{ hotels: HotelHit[] }>(`/api/escale/hotel?${qs}&lang=${locale}`)
      .then((d) => setHits({ state: "ok", data: d.hotels }))
      .catch((e) => setHits({ state: fail(e), data: [] }));
  };
  useEffect(() => {
    if (searching && hits.state === "idle") searchHotels(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searching]);

  if (!l) return <Screen backdrop><Txt variant="muted">…</Txt></Screen>;

  const pickHotel = async (h: HotelHit) => {
    // the hotel's own address and phone, unless the search has none (then what the pilot typed stays), as on the web
    await put("layovers", { ...l, hotelName: h.name, hotelPlaceId: h.id, address: h.address ?? l.address, phone: h.phone ?? l.phone });
    setSearching(false);
    setHits({ state: "idle", data: [] });
  };

  const status = (s: Load<unknown>["state"]) =>
    s === "loading" ? <ActivityIndicator color={c.accent} style={{ marginVertical: 24 }} /> : s === "error" ? <Txt variant="muted">{t("lay.error")}</Txt> : s === "not_configured" ? <Txt variant="muted">{t("lay.notConfigured")}</Txt> : null;

  return (
    <>
      <Stack.Screen options={{ title: airport?.city || airport?.name || l.airportIcao }} />
      <Screen backdrop>
        <View style={{ gap: 2 }}>
          <Txt variant="title">{airport?.city || airport?.name || l.airportIcao}</Txt>
          <Txt variant="muted">
            {l.airportIcao}
            {l.arrivalUtc ? ` · ${formatDate(l.arrivalUtc, locale)}` : ""}
            {l.departureUtc ? ` → ${formatDate(l.departureUtc, locale)}` : ""}
          </Txt>
        </View>

        <Card>
          <Txt variant="h2">{t("wx.title", { icao: l.airportIcao })}</Txt>
          <AirportWeather icao={l.airportIcao} />
        </Card>

        <Card>
          <Row style={{ justifyContent: "space-between" }}>
            <Txt variant="h2">{t("lay.hotel")}</Txt>
            <Button small kind="ghost" title={l.hotelName ? t("lay.change") : t("lay.searchHotel")} onPress={() => setSearching(!searching)} />
          </Row>
          {l.hotelName || l.address || l.phone ? (
            <View style={{ gap: 2 }}>
              {l.hotelName ? <Txt style={{ fontWeight: "600" }}>{l.hotelName}</Txt> : null}
              {l.address ? <Txt variant="small">{l.address}</Txt> : null}
              {l.phone ? (
                <Pressable onPress={() => void Linking.openURL(`tel:${l.phone!.replace(/\s/g, "")}`)}>
                  <Txt variant="small" color={c.accent}>{l.phone}</Txt>
                </Pressable>
              ) : null}
            </View>
          ) : null}
          {searching ? (
            <View style={{ gap: 10 }}>
              <Field placeholder={t("lay.searchHotel")} value={q} onChangeText={setQ} returnKeyType="search" onSubmitEditing={() => q.trim().length > 1 && searchHotels(false)} />
              {hits.state === "ok" && !q ? <Txt variant="label">{t("lay.hotelsNear")}</Txt> : null}
              {status(hits.state)}
              {hits.state === "ok" && hits.data.length === 0 ? <Txt variant="muted">{t("lay.noResults")}</Txt> : null}
              {hits.data.map((h) => (
                <Pressable key={h.id} onPress={() => void pickHotel(h)} style={({ pressed }) => [{ paddingVertical: 8, opacity: pressed ? 0.6 : 1 }]}>
                  <Txt style={{ fontWeight: "600" }}>{h.name}</Txt>
                  <Txt variant="small" numberOfLines={1}>
                    {[h.rating ? `★ ${h.rating.toFixed(1)}` : null, fmtDistance(h.distanceM), h.address].filter(Boolean).join(" · ")}
                  </Txt>
                </Pressable>
              ))}
            </View>
          ) : null}
        </Card>

        <LayoverDetails l={l} />

        <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {PLACE_CATEGORIES.map((k) => (
                <Chip key={k} label={t(`lay.cat.${k}` as I18nKey)} selected={cat === k} onPress={() => setCat(k)} />
              ))}
            </ScrollView>
            {status(places.state)}
            {places.state === "ok" && places.data.length === 0 ? <Txt variant="muted">{t("lay.noResults")}</Txt> : null}
            {/* 8 at a time: each card loads one Google photo */}
            {places.data.slice(0, shownCount).map((p, i) => (
              <PlaceCard key={p.id} p={p} rank={i + 1} cat={cat} />
            ))}
            {places.data.length > shownCount ? <Button kind="secondary" small title={t("lay.more")} onPress={() => setShownCount((n) => n + 8)} /> : null}
            {places.data.length ? <Txt variant="small" style={{ textAlign: "center" }}>{t("lay.google")}</Txt> : null}
        </>

        <Button
          kind="danger"
          title={t("lay.delete")}
          onPress={() =>
            Alert.alert(t("lay.delete"), "", [
              { text: t("common.cancel"), style: "cancel" },
              { text: t("common.delete"), style: "destructive", onPress: () => void remove("layovers", l.id).then(() => router.back()) },
            ])
          }
        />
      </Screen>
    </>
  );
}

type Contact = Layover["contacts"][number];
const day = (iso?: string | null) => iso?.slice(0, 10) ?? "";
/** Back to a stored instant: an unchanged day keeps its time (roster imports), a new day is noon UTC as on the web. */
const toIso = (d: string, prev?: string | null) => (!d ? null : prev && prev.slice(0, 10) === d ? prev : `${d}T12:00:00.000Z`);
const dial = (phone: string) => void Linking.openURL(`tel:${phone.replace(/\s/g, "")}`);

/** Dates, phone, address, notes and contacts: shown here, edited in place, saved together (same fields as the web). */
function LayoverDetails({ l }: { l: Layover }) {
  const { t, put, locale } = useApp();
  const c = useTheme();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [arr, setArr] = useState("");
  const [dep, setDep] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);

  const start = () => {
    setArr(day(l.arrivalUtc));
    setDep(day(l.departureUtc));
    setPhone(l.phone ?? "");
    setAddress(l.address ?? "");
    setNotes(l.notes ?? "");
    setContacts(l.contacts.map((x) => ({ ...x })));
    setEditing(true);
  };
  // a hotel picked while the form is open brings its address and phone into it
  useEffect(() => {
    if (!editing) return;
    if (l.address) setAddress(l.address);
    if (l.phone) setPhone(l.phone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [l.hotelPlaceId]);

  const badDate = (!!arr && !isValidDate(arr)) || (!!dep && !isValidDate(dep));
  const depBeforeArr = !!arr && !!dep && !badDate && dep < arr;
  const updContact = (i: number, patch: Partial<Contact>) => setContacts(contacts.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const save = async () => {
    setSaving(true);
    try {
      const clean = (s: string) => s.trim() || undefined;
      await put("layovers", {
        ...l,
        arrivalUtc: toIso(arr, l.arrivalUtc),
        departureUtc: toIso(dep, l.departureUtc),
        phone: clean(phone),
        address: clean(address),
        notes: clean(notes),
        // a blank row is dropped; one with only a phone number is kept
        contacts: contacts
          .map((x) => ({ name: x.name.trim(), role: clean(x.role ?? ""), phone: clean(x.phone ?? "") }))
          .filter((x) => x.name || x.phone),
      });
      setEditing(false);
    } catch (e) {
      Alert.alert(t("common.error"), e instanceof ReadOnlyError ? t("access.readOnlyBanner") : e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    const empty = !l.arrivalUtc && !l.departureUtc && !l.notes && l.contacts.length === 0;
    return (
      <Card>
        <Row style={{ justifyContent: "space-between" }}>
          <Txt variant="h2">{t("lay.details")}</Txt>
          <Button small kind="ghost" title={t("common.edit")} onPress={start} />
        </Row>
        {empty ? <Txt variant="muted">{t("lay.detailsEmpty")}</Txt> : null}
        {l.arrivalUtc || l.departureUtc ? (
          <Txt mono variant="small">
            {l.arrivalUtc ? formatDate(l.arrivalUtc, locale) : "…"} → {l.departureUtc ? formatDate(l.departureUtc, locale) : "…"}
          </Txt>
        ) : null}
        {l.notes ? <Txt>{l.notes}</Txt> : null}
        {l.contacts.length ? (
          <View style={{ gap: 6 }}>
            <Txt variant="label">{t("lay.contacts")}</Txt>
            {l.contacts.map((x, i) => (
              <Row key={i} style={{ justifyContent: "space-between" }}>
                <View style={{ flex: 1 }}>
                  <Txt style={{ fontWeight: "600" }}>{x.name || "—"}</Txt>
                  {x.role ? <Txt variant="small">{x.role}</Txt> : null}
                </View>
                {x.phone ? (
                  <Pressable onPress={() => dial(x.phone!)} hitSlop={8}>
                    <Txt variant="small" mono color={c.accent}>{x.phone}</Txt>
                  </Pressable>
                ) : null}
              </Row>
            ))}
          </View>
        ) : null}
      </Card>
    );
  }

  return (
    <Card>
      <Txt variant="h2">{t("lay.details")}</Txt>
      <Row style={{ alignItems: "flex-start" }}>
        <DateField style={{ flex: 1 }} label={t("lay.arrivalDate")} value={arr} onChange={setArr} />
        <DateField style={{ flex: 1 }} label={t("lay.departureDate")} value={dep} onChange={setDep} hint={depBeforeArr ? t("lay.departureBeforeArrival") : undefined} />
      </Row>
      <Field label={t("lay.phone")} value={phone} onChangeText={setPhone} keyboardType="phone-pad" monoValue />
      <Field label={t("lay.address")} value={address} onChangeText={setAddress} />
      <Field label={t("lay.notes")} value={notes} onChangeText={setNotes} multiline placeholder={t("lay.notesPh")} />

      <Txt variant="label">{t("lay.contacts")}</Txt>
      {contacts.map((x, i) => (
        <View key={i} style={{ gap: 6, borderTopWidth: i ? 1 : 0, borderColor: c.border, paddingTop: i ? 10 : 0 }}>
          <Row>
            <Field style={{ flex: 1 }} placeholder={t("lay.contactName")} value={x.name} onChangeText={(v) => updContact(i, { name: v })} autoCapitalize="words" />
            <Pressable accessibilityRole="button" accessibilityLabel={t("lay.removeContact")} hitSlop={8} onPress={() => setContacts(contacts.filter((_, j) => j !== i))}>
              <Ionicons name="close-circle-outline" size={22} color={c.muted} />
            </Pressable>
          </Row>
          <Row>
            <Field style={{ flex: 1 }} placeholder={t("lay.contactRole")} value={x.role ?? ""} onChangeText={(v) => updContact(i, { role: v })} />
            <Field style={{ flex: 1 }} placeholder={t("lay.phone")} value={x.phone ?? ""} onChangeText={(v) => updContact(i, { phone: v })} keyboardType="phone-pad" monoValue />
          </Row>
        </View>
      ))}
      <Button kind="secondary" small title={t("lay.addContact")} onPress={() => setContacts([...contacts, { name: "" }])} />

      <Row gap={12}>
        <Button style={{ flex: 1 }} kind="secondary" title={t("common.cancel")} onPress={() => setEditing(false)} />
        <Button style={{ flex: 1 }} title={t("common.save")} loading={saving} disabled={badDate || depBeforeArr} onPress={() => void save()} />
      </Row>
    </Card>
  );
}



const CAT_LOOK: Record<PlaceCategory, { icon: React.ComponentProps<typeof Ionicons>["name"]; color: string }> = {
  restaurants: { icon: "restaurant", color: "#C2410C" },
  bars: { icon: "wine", color: "#7E22CE" },
  nightlife: { icon: "musical-notes", color: "#4338CA" },
  cafes: { icon: "cafe", color: "#92400E" },
  beaches: { icon: "umbrella", color: "#0369A1" },
  culture: { icon: "library", color: "#334155" },
  shows: { icon: "ticket", color: "#9D174D" },
  cinema: { icon: "film", color: "#1E293B" },
  parks: { icon: "leaf", color: "#15803D" },
  wellness: { icon: "sparkles", color: "#0F766E" },
  shopping: { icon: "bag-handle", color: "#B91C1C" },
};

/** One place: its Google photo with the name over it, rank, rating, then the walk from the hotel; opens Google Maps. */
function PlaceCard({ p, rank, cat }: { p: Place; rank: number; cat: PlaceCategory }) {
  const { t } = useApp();
  const c = useTheme();
  const [failed, setFailed] = useState(false);
  const look = CAT_LOOK[cat];
  const uri = p.photo && !failed ? `${API_URL}/api/escale/photo?name=${encodeURIComponent(p.photo.name)}` : null;
  const meta = [p.type, p.priceLevel ? "€".repeat(p.priceLevel) : null, fmtDistance(p.distanceM), p.openNow === undefined ? null : p.openNow ? t("lay.openNow") : t("lay.closedNow")].filter(Boolean).join(" · ");
  return (
    <Pressable
      onPress={p.mapsUrl ? () => void Linking.openURL(p.mapsUrl!) : undefined}
      style={({ pressed }) => ({ borderRadius: 18, overflow: "hidden", borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, opacity: pressed ? 0.9 : 1 })}
    >
      <View style={{ height: 170, backgroundColor: look.color, alignItems: "center", justifyContent: "center" }}>
        {uri ? (
          <Image source={{ uri }} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} contentFit="cover" transition={200} onError={() => setFailed(true)} />
        ) : (
          <Ionicons name={look.icon} size={44} color="rgba(255,255,255,0.8)" />
        )}
        <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 12, paddingTop: 22, paddingBottom: 10, backgroundColor: "rgba(0,0,0,0.45)" }}>
          <Txt numberOfLines={1} color="#fff" style={{ fontSize: 17, fontWeight: "800" }}>{p.name}</Txt>
          {p.photo?.author && !failed ? <Txt numberOfLines={1} color="rgba(255,255,255,0.75)" style={{ fontSize: 10 }}>© {p.photo.author}</Txt> : null}
        </View>
        <View style={{ position: "absolute", top: 10, left: 10, minWidth: 28, height: 28, borderRadius: 14, paddingHorizontal: 6, alignItems: "center", justifyContent: "center", backgroundColor: rank <= 3 ? "#F5B301" : "rgba(0,0,0,0.55)" }}>
          <Txt mono color={rank <= 3 ? "#000" : "#fff"} style={{ fontSize: 13, fontWeight: "800" }}>{rank}</Txt>
        </View>
        {p.rating ? (
          <View style={{ position: "absolute", top: 10, right: 10, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 14, backgroundColor: "rgba(0,0,0,0.55)" }}>
            <Ionicons name="star" size={12} color="#F5B301" />
            <Txt mono color="#fff" style={{ fontSize: 13, fontWeight: "700" }}>{p.rating.toFixed(1)}</Txt>
            <Txt color="rgba(255,255,255,0.75)" style={{ fontSize: 11 }}>({p.reviews ?? 0})</Txt>
          </View>
        ) : null}
      </View>
      <Row style={{ paddingHorizontal: 12, paddingVertical: 10, alignItems: "center" }} gap={8}>
        <Txt variant="small" numberOfLines={1} style={{ flex: 1 }}>{meta}</Txt>
        {p.mapsUrl ? <Ionicons name="open-outline" size={16} color={c.accent} /> : null}
      </Row>
    </Pressable>
  );
}
