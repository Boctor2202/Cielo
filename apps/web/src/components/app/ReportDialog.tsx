"use client";

import { Bug, Lightbulb, Loader2 } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { sendReport } from "@/lib/report";
import { Modal, Segmented } from "./ui";

/** "Report a problem / suggest an idea": goes to the admin back office with the page and device context. */
export function ReportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations("app.report");
  const [kind, setKind] = useState<"bug" | "idea">("bug");
  const [text, setText] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "sent" | "error">("idle");
  const close = () => {
    onClose();
    setTimeout(() => (setState("idle"), setText("")), 300);
  };
  return (
    <Modal open={open} onClose={close} title={t("title")}>
      {state === "sent" ? (
        <div className="space-y-4">
          <p>{t("thanks")}</p>
          <button type="button" className="btn btn-primary" onClick={close}>{t("close")}</button>
        </div>
      ) : (
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setState("busy");
            try {
              await sendReport(kind, text.trim());
              setState("sent");
            } catch {
              setState("error");
            }
          }}
        >
          <Segmented
            value={kind}
            onChange={setKind}
            options={[
              { value: "bug", label: <span className="flex items-center gap-1.5"><Bug size={14} /> {t("bug")}</span> },
              { value: "idea", label: <span className="flex items-center gap-1.5"><Lightbulb size={14} /> {t("idea")}</span> },
            ]}
          />
          <textarea className="input min-h-36" required maxLength={4000} placeholder={kind === "bug" ? t("bugPlaceholder") : t("ideaPlaceholder")} value={text} onChange={(e) => setText(e.target.value)} />
          <p className="text-xs text-muted">{t("context")}</p>
          {state === "error" && <p className="text-sm text-warning">{t("error")}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-secondary" onClick={close}>{t("cancel")}</button>
            <button type="submit" className="btn btn-primary" disabled={!text.trim() || state === "busy"}>
              {state === "busy" && <Loader2 size={15} className="animate-spin" />} {t("send")}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
