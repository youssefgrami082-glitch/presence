import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { QrCode as QrIcon } from 'lucide-react';

interface QrCodeCanvasProps {
  value: string;
  size?: number;
  className?: string;
}

export const QrCodeCanvas: React.FC<QrCodeCanvasProps> = ({
  value,
  size = 200,
  className = '',
}) => {
  const [svgMarkup, setSvgMarkup] = useState<string>('');
  const [hasError, setHasError] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    setHasError(false);

    QRCode.toString(
      value || 'https://iscae.rnu.tn',
      {
        type: 'svg',
        width: size,
        margin: 1,
        errorCorrectionLevel: 'M',
        color: {
          dark: '#141E46',
          light: '#FFFFFF',
        },
      },
      (err, svg) => {
        if (cancelled) return;
        if (err || !svg) {
          setHasError(true);
        } else {
          setSvgMarkup(svg);
        }
      }
    );

    return () => {
      cancelled = true;
    };
  }, [value, size]);

  if (hasError || !svgMarkup) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`flex flex-col items-center justify-center bg-white border border-slate-200 rounded-xl p-4 text-slate-500 ${className}`}
      >
        <QrIcon className="w-8 h-8 mb-2 text-[#233886]" />
        <span className="text-xs text-center">QR Code en cours…</span>
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center justify-center bg-white p-3.5 rounded-xl border border-slate-200/90 ${className}`}
      style={{ width: size + 28, height: size + 28 }}
      aria-label={`Code QR de pointage : ${value}`}
      dangerouslySetInnerHTML={{ __html: svgMarkup }}
    />
  );
};
