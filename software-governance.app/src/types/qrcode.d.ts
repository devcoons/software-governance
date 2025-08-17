// types/qrcode.d.ts
declare module 'qrcode' {
  export interface QRCodeToDataURLOptions {
    margin?: number;
    width?: number;
    // add others if you need (errorCorrectionLevel, color, etc.)
  }
  export function toDataURL(
    text: string,
    options?: QRCodeToDataURLOptions
  ): Promise<string>;
}
