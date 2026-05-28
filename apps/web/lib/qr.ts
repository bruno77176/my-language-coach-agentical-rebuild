import QRCode from "qrcode";

export interface QrOptions {
  color?: string;
  size?: number;
}

export async function generateQrSvg(
  data: string,
  options: QrOptions = {},
): Promise<string> {
  const { color = "#2b1d12", size = 200 } = options;
  return QRCode.toString(data, {
    type: "svg",
    width: size,
    margin: 1,
    color: { dark: color, light: "#ffffff00" },
    errorCorrectionLevel: "M",
  });
}
