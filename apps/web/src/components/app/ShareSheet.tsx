"use client";

import { Check, Copy, Download, Link2, Mail, MessageSquare, MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { siFacebook, siInstagram, siLinkedin, siMessenger, siTelegram, siTiktok, siWhatsapp, siX, type SimpleIcon } from "simple-icons";

/** A network's logo (simple-icons), white on its brand colour. */
function Logo({ icon, size = 22 }: { icon: SimpleIcon; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden fill="#fff">
      <path d={icon.path} />
    </svg>
  );
}

/**
 * Sharing on every network from a computer. The link sent is the achievement's own page, whose preview is the
 * image: WhatsApp, Messenger, Telegram, LinkedIn, Facebook, X, SMS and e-mail all show the image with it.
 * Instagram and TikTok take only images posted from their app, so the image is saved (or copied) for them.
 */
/**
 * Phones and tablets share through the device's own sheet (every app installed); a computer shows Geardown's
 * sheet instead (format choice, Instagram, LinkedIn…), whose "More" tile still opens the system one.
 */
export const prefersNativeShare = () => typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches === true;

export function ShareSheet({ image, text, link }: { image: string; text: string; link: string }) {
  // the link is the achievement's public page: every network shows its image as the preview
  const SITE = link;
  const t = useTranslations("app.share");
  const [note, setNote] = useState<string | null>(null);
  const message = `${text} · ${SITE}`;
  const enc = encodeURIComponent;

  const download = () => {
    const a = document.createElement("a");
    a.href = image;
    a.download = "geardown.png";
    a.click();
  };
  const copyImage = async () => {
    try {
      const blob = await (await fetch(image)).blob();
      await navigator.clipboard.write([new ClipboardItem({ [blob.type || "image/png"]: blob })]);
      setNote(t("imageCopied"));
    } catch {
      download();
      setNote(t("imageSaved"));
    }
  };
  // Instagram and TikTok: no share page on the web; the image goes with the post made in their app
  const forApp = (name: string) => {
    download();
    setNote(t("postInApp", { app: name }));
  };
  // the computer's own share window (Windows, macOS): the image with the text and link
  const systemShare = async () => {
    try {
      const blob = await (await fetch(image)).blob();
      const file = new File([blob], "geardown.png", { type: blob.type || "image/png" });
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      await navigator.share(nav.canShare?.({ files: [file] }) ? { files: [file], text: message } : { text: message, url: SITE });
    } catch {
      /* closed */
    }
  };
  const open = (url: string) => window.open(url, "_blank", "noopener,noreferrer");

  const tiles: { key: string; label: string; bg: string; icon: React.ReactNode; onClick: () => void }[] = [
    { key: "instagram", label: "Instagram", bg: "linear-gradient(45deg,#F58529,#DD2A7B 45%,#8134AF 75%,#515BD4)", icon: <Logo icon={siInstagram} />, onClick: () => forApp("Instagram") },
    { key: "tiktok", label: "TikTok", bg: "#000", icon: <Logo icon={siTiktok} />, onClick: () => forApp("TikTok") },
    { key: "linkedin", label: "LinkedIn", bg: `#${siLinkedin.hex}`, icon: <Logo icon={siLinkedin} />, onClick: () => { download(); open(`https://www.linkedin.com/sharing/share-offsite/?url=${enc(SITE)}`); setNote(t("addImage")); } },
    { key: "facebook", label: "Facebook", bg: `#${siFacebook.hex}`, icon: <Logo icon={siFacebook} />, onClick: () => { download(); open(`https://www.facebook.com/sharer/sharer.php?u=${enc(SITE)}&quote=${enc(text)}`); setNote(t("addImage")); } },
    { key: "x", label: "X", bg: "#000", icon: <Logo icon={siX} size={20} />, onClick: () => { download(); open(`https://x.com/intent/post?text=${enc(text)}&url=${enc(SITE)}`); setNote(t("addImage")); } },
    { key: "whatsapp", label: "WhatsApp", bg: `#${siWhatsapp.hex}`, icon: <Logo icon={siWhatsapp} />, onClick: () => open(`https://wa.me/?text=${enc(message)}`) },
    { key: "messenger", label: "Messenger", bg: "linear-gradient(45deg,#0099FF,#A033FF 60%,#FF5280)", icon: <Logo icon={siMessenger} />, onClick: () => open(`fb-messenger://share/?link=${enc(SITE)}`) },
    { key: "telegram", label: "Telegram", bg: `#${siTelegram.hex}`, icon: <Logo icon={siTelegram} />, onClick: () => open(`https://t.me/share/url?url=${enc(SITE)}&text=${enc(text)}`) },
    { key: "sms", label: "SMS", bg: "#34C759", icon: <MessageSquare size={21} color="#fff" />, onClick: () => { window.location.href = `sms:?&body=${enc(message)}`; } },
    { key: "mail", label: t("mail"), bg: "#64748B", icon: <Mail size={21} color="#fff" />, onClick: () => { window.location.href = `mailto:?subject=${enc(text)}&body=${enc(message)}`; } },
    { key: "copy", label: t("copyImage"), bg: "#0E2A47", icon: <Copy size={20} color="#fff" />, onClick: () => void copyImage() },
    ...(typeof navigator !== "undefined" && "share" in navigator
      ? [{ key: "more", label: t("more"), bg: "#0E2A47", icon: <MoreHorizontal size={21} color="#fff" />, onClick: () => void systemShare() }]
      : []),
    { key: "link", label: t("copyLink"), bg: "#0E2A47", icon: <Link2 size={20} color="#fff" />, onClick: () => void navigator.clipboard.writeText(message).then(() => setNote(t("linkCopied"))) },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-x-2 gap-y-4 sm:grid-cols-6">
        {tiles.map((x) => (
          <button key={x.key} type="button" onClick={x.onClick} className="group flex flex-col items-center gap-1.5 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-2xl shadow-md transition group-hover:-translate-y-0.5 group-hover:shadow-lg" style={{ background: x.bg }}>
              {x.icon}
            </span>
            <span className="text-[11px] leading-tight text-muted group-hover:text-[color:var(--text)]">{x.label}</span>
          </button>
        ))}
      </div>
      {note && (
        <p className="flex items-start gap-2 rounded-lg bg-accent/10 px-3 py-2 text-xs text-accent">
          <Check size={14} className="mt-0.5 shrink-0" /> {note}
        </p>
      )}
      <button type="button" className="btn btn-primary btn-sm w-full" onClick={download}>
        <Download size={14} /> {t("download")}
      </button>
    </div>
  );
}
