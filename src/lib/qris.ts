import QRCode from "qrcode";

type TlvNode = { tag: string; value: string };

function parseTopLevelTlv(input: string): TlvNode[] {
  const nodes: TlvNode[] = [];
  let index = 0;

  while (index + 4 <= input.length) {
    const tag = input.slice(index, index + 2);
    const lengthStr = input.slice(index + 2, index + 4);
    const length = Number.parseInt(lengthStr, 10);

    if (!Number.isInteger(length) || length < 0) {
      throw new Error("Invalid TLV length");
    }

    const valueStart = index + 4;
    const valueEnd = valueStart + length;
    if (valueEnd > input.length) {
      throw new Error("TLV value exceeds payload length");
    }

    const value = input.slice(valueStart, valueEnd);
    nodes.push({ tag, value });
    index = valueEnd;
  }

  if (index !== input.length) {
    throw new Error("Invalid TLV payload format");
  }

  return nodes;
}

function encodeTlv(nodes: TlvNode[]) {
  return nodes
    .map((node) => {
      const length = node.value.length.toString().padStart(2, "0");
      return `${node.tag}${length}${node.value}`;
    })
    .join("");
}

function crc16Ccitt(input: string) {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i += 1) {
    crc ^= input.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      if (crc & 0x8000) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc <<= 1;
      }
      crc &= 0xffff;
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function normalizeAmount(amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Invalid QRIS amount");
  }

  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
}

export function buildDynamicQrisString(baseQrisString: string, amount: number) {
  const normalized = baseQrisString.trim();
  if (!normalized) {
    return null;
  }

  const nodes = parseTopLevelTlv(normalized).filter((node) => node.tag !== "63");
  const amountValue = normalizeAmount(amount);

  const amountIndex = nodes.findIndex((node) => node.tag === "54");
  if (amountIndex >= 0) {
    nodes[amountIndex] = { tag: "54", value: amountValue };
  } else {
    const currencyIndex = nodes.findIndex((node) => node.tag === "53");
    const insertAt = currencyIndex >= 0 ? currencyIndex + 1 : nodes.length;
    nodes.splice(insertAt, 0, { tag: "54", value: amountValue });
  }

  const poiIndex = nodes.findIndex((node) => node.tag === "01");
  if (poiIndex >= 0) {
    nodes[poiIndex] = { tag: "01", value: "12" };
  }

  const payloadWithoutCrc = `${encodeTlv(nodes)}6304`;
  const crc = crc16Ccitt(payloadWithoutCrc);
  return `${payloadWithoutCrc}${crc}`;
}

export async function buildQrisDataUrl(qrisString: string) {
  const normalized = qrisString.trim();
  if (!normalized) {
    return null;
  }

  return QRCode.toDataURL(normalized, {
    width: 360,
    margin: 1,
    errorCorrectionLevel: "M"
  });
}
