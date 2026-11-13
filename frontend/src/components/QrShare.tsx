import { useEffect, useState } from "react";
import { Modal } from "./ui";
import { Icon } from "./Icon";

/**
 * Shareable payment-link modal with a scannable QR code. The QR library is
 * loaded lazily — it's only downloaded when a share modal is opened.
 */
export function QrShare({
  open,
  onClose,
  url,
  title,
}: {
  open: boolean;
  onClose: () => void;
  url: string | null;
  title: string;
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open || !url) {
      setDataUrl(null);
      setError(null);
      return;
    }
    let cancelled = false;
    import("qrcode")
      .then(({ default: QRCode }) =>
        QRCode.toDataURL(url, { width: 220, margin: 1, color: { dark: "#101828", light: "#ffffff" } }),
      )
      .then((generated) => {
        if (!cancelled) setDataUrl(generated);
      })
      .catch(() => {
        if (!cancelled) setError("Could not generate the QR code.");
      });
    return () => {
      cancelled = true;
    };
  }, [open, url]);

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("Copy the payment link:", url);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Share payment link"
      subtitle={title}
    >
      {error ? (
        <p className="form-error">
          <Icon name="info" size={15} />
          {error}
        </p>
      ) : dataUrl ? (
        <div className="qr-share">
          <img className="qr-image" src={dataUrl} alt="Payment link QR code" width={220} height={220} />
          <div className="qr-link mono" title={url ?? ""}>
            {url}
          </div>
          <div className="qr-actions">
            <button className="btn primary" onClick={copy}>
              <Icon name={copied ? "check" : "invoice"} size={15} />
              {copied ? "Copied" : "Copy link"}
            </button>
            <a
              className="btn ghost"
              href={`mailto:?subject=Invoice payment&body=${encodeURIComponent(
                `Pay this invoice online: ${url}`,
              )}`}
            >
              <Icon name="send" size={15} />
              Email it
            </a>
          </div>
          <p className="hint center">
            Customers can scan this with any phone camera and pay with a NEAR
            wallet or Google sign-in.
          </p>
        </div>
      ) : (
        <div className="empty">
          <div className="empty-icon">
            <Icon name="invoice" size={20} />
          </div>
          <div className="empty-title">Generating QR code…</div>
        </div>
      )}
    </Modal>
  );
}
