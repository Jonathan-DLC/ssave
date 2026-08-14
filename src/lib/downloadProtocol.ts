/**
 * Protocolo de /api/convert para video.
 *
 * La descarga real tarda mucho más que el envío del archivo, y ocurre entera
 * dentro de la misma petición. Para poder informar el avance sin un endpoint
 * de progreso aparte (que necesitaría estado compartido entre invocaciones,
 * algo que no se puede garantizar en serverless), la respuesta va en dos
 * tramos dentro del mismo cuerpo:
 *
 *   {"type":"progress","bytes":123,...}\n
 *   {"type":"merging"}\n
 *   {"type":"ready","sizeBytes":80530000,...}\n
 *   <bytes del archivo>
 *
 * Todo lo anterior a `ready` son líneas JSON. Lo que sigue al salto de línea
 * de `ready` es binario puro hasta el final.
 *
 * Este módulo no importa nada de Node para que pueda usarse desde el cliente.
 */

export const FRAMED_MEDIA_TYPE = "application/vnd.ssave.download";

export type DownloadFrame =
  | { type: "progress"; bytes: number; totalBytes?: number; speed?: number; eta?: number }
  | { type: "merging" }
  | { type: "ready"; sizeBytes: number; filename: string; contentType: string }
  | { type: "error"; message: string };

/** Los eventos que emite la descarga mientras corre yt-dlp. */
export type DownloadEvent = Extract<DownloadFrame, { type: "progress" | "merging" }>;

export type ReadyFrame = Extract<DownloadFrame, { type: "ready" }>;

/**
 * Lee las líneas JSON hasta encontrar `ready`. Devuelve ese frame junto con los
 * bytes de archivo que ya venían en el mismo chunk, porque el corte entre texto
 * y binario casi nunca coincide con un límite de chunk.
 *
 * Lanza si llega un frame `error` o si el cuerpo termina antes del `ready`.
 */
export async function readFrames(
  reader: ReadableStreamDefaultReader<Uint8Array<ArrayBuffer>>,
  onFrame: (frame: DownloadEvent) => void,
): Promise<{ ready: ReadyFrame; leftover: Uint8Array<ArrayBuffer> }> {
  const decoder = new TextDecoder();
  let buffer = new Uint8Array(0);

  for (;;) {
    const { done, value } = await reader.read();
    if (done) throw new Error("La descarga terminó antes de enviar el archivo");

    const merged = new Uint8Array(buffer.length + value.length);
    merged.set(buffer);
    merged.set(value, buffer.length);
    buffer = merged;

    for (;;) {
      const newline = buffer.indexOf(10);
      if (newline === -1) break;

      const frame = JSON.parse(decoder.decode(buffer.subarray(0, newline))) as DownloadFrame;
      buffer = buffer.subarray(newline + 1);

      if (frame.type === "error") throw new Error(frame.message);
      // Copia: `buffer` es una vista sobre memoria que se reemplaza en la
      // siguiente vuelta del bucle exterior.
      if (frame.type === "ready") return { ready: frame, leftover: new Uint8Array(buffer) };

      onFrame(frame);
    }
  }
}
