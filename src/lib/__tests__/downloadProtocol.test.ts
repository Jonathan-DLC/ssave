import { describe, it, expect, vi } from "vitest";
import { readFrames, type DownloadEvent, type DownloadFrame } from "../downloadProtocol";

const encoder = new TextEncoder();

function frameLine(frame: DownloadFrame): Uint8Array<ArrayBuffer> {
  return new Uint8Array(encoder.encode(`${JSON.stringify(frame)}\n`));
}

function concat(parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/** Reparte un cuerpo completo en chunks de tamaño fijo, como haría la red. */
function readerOf(body: Uint8Array, chunkSize: number): ReadableStreamDefaultReader<Uint8Array<ArrayBuffer>> {
  let cursor = 0;
  return {
    async read() {
      if (cursor >= body.length) return { done: true, value: undefined };
      const slice = new Uint8Array(body.subarray(cursor, cursor + chunkSize));
      cursor += chunkSize;
      return { done: false, value: slice };
    },
  } as unknown as ReadableStreamDefaultReader<Uint8Array<ArrayBuffer>>;
}

const READY: DownloadFrame = {
  type: "ready",
  sizeBytes: 4,
  filename: "video.mp4",
  contentType: "video/mp4",
};

const FILE_BYTES = new Uint8Array([0x00, 0x01, 0x02, 0x03]);

describe("readFrames", () => {
  it("devuelve el frame ready y los bytes que lo siguen", async () => {
    const body = concat([
      frameLine({ type: "progress", bytes: 10, totalBytes: 100 }),
      frameLine(READY),
      FILE_BYTES,
    ]);

    const seen: DownloadEvent[] = [];
    const { ready, leftover } = await readFrames(readerOf(body, 4096), (f) => seen.push(f));

    expect(ready).toEqual(READY);
    expect(Array.from(leftover)).toEqual([0x00, 0x01, 0x02, 0x03]);
    expect(seen).toEqual([{ type: "progress", bytes: 10, totalBytes: 100 }]);
  });

  it("reconstruye frames partidos entre chunks", async () => {
    const body = concat([
      frameLine({ type: "progress", bytes: 1, totalBytes: 100 }),
      frameLine({ type: "progress", bytes: 50, totalBytes: 100 }),
      frameLine({ type: "merging" }),
      frameLine(READY),
      FILE_BYTES,
    ]);

    // Un byte por chunk parte cada línea JSON en el peor lugar posible.
    const seen: DownloadEvent[] = [];
    const { ready, leftover } = await readFrames(readerOf(body, 1), (f) => seen.push(f));

    expect(ready).toEqual(READY);
    expect(Array.from(leftover)).toEqual([]);
    expect(seen).toEqual([
      { type: "progress", bytes: 1, totalBytes: 100 },
      { type: "progress", bytes: 50, totalBytes: 100 },
      { type: "merging" },
    ]);
  });

  it("separa bien cuando el binario empieza en el mismo chunk que ready", async () => {
    const body = concat([frameLine(READY), FILE_BYTES]);

    // Un solo chunk con todo: el corte cae a mitad de chunk, no en su borde.
    const { leftover } = await readFrames(readerOf(body, body.length), () => {});

    expect(Array.from(leftover)).toEqual([0x00, 0x01, 0x02, 0x03]);
  });

  it("no confunde un salto de línea dentro del binario con un frame", async () => {
    // 0x0A es un byte perfectamente válido dentro de un mp4.
    const binaryWithNewlines = new Uint8Array([0x0a, 0xff, 0x0a, 0x0a, 0x42]);
    const body = concat([frameLine(READY), binaryWithNewlines]);

    // `leftover` solo trae lo que quedaba en el chunk donde apareció `ready`;
    // el resto lo sigue leyendo quien llama. Se comprueba el contrato completo.
    const reader = readerOf(body, 3);
    const { leftover } = await readFrames(reader, () => {});

    const rest: Uint8Array[] = [leftover];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      rest.push(value);
    }

    expect(Array.from(concat(rest))).toEqual([0x0a, 0xff, 0x0a, 0x0a, 0x42]);
  });

  it("lanza con el mensaje del frame error", async () => {
    const body = concat([
      frameLine({ type: "progress", bytes: 5 }),
      frameLine({ type: "error", message: "YouTube está bloqueando al servidor." }),
    ]);

    await expect(readFrames(readerOf(body, 8), vi.fn())).rejects.toThrow(
      "YouTube está bloqueando al servidor."
    );
  });

  it("lanza si el cuerpo termina antes del ready", async () => {
    const body = concat([frameLine({ type: "progress", bytes: 5 })]);

    await expect(readFrames(readerOf(body, 8), vi.fn())).rejects.toThrow(
      "La descarga terminó antes de enviar el archivo"
    );
  });
});
