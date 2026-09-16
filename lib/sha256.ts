/**
 * SHA-256 en hexadecimal que también funciona sin origen seguro.
 *
 * `crypto.subtle` sólo existe en contexto seguro (HTTPS o localhost). El ERP se sirve además por
 * HTTP plano —`http://erp.161.97.85.216.sslip.io`, `http://100.101.207.88:3010`—, y ahí
 * `crypto.subtle` es `undefined`: adjuntar la evidencia de un requisito de onboarding moría con
 * «Cannot read properties of undefined (reading 'digest')» (2026-09-16). El almacén compara esta
 * huella con el objeto real, así que no vale un valor cualquiera: el respaldo es SHA-256 de verdad
 * (FIPS 180-4), calculado en JavaScript. Mismo criterio que `newUuid()` en `lib/uuid.ts`.
 */
export async function sha256Hex(data: ArrayBuffer): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle && typeof crypto.subtle.digest === 'function') {
    return aHex(new Uint8Array(await crypto.subtle.digest('SHA-256', data)));
  }
  return aHex(sha256EnJs(new Uint8Array(data)));
}

function aHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

/** SHA-256 puro. Se usa sólo cuando el navegador no ofrece `crypto.subtle`. */
export function sha256EnJs(mensaje: Uint8Array): Uint8Array {
  const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  // Relleno: 0x80, ceros hasta 56 mod 64, y la longitud en bits en 64 bits big-endian.
  const largoBits = mensaje.length * 8;
  const total = Math.ceil((mensaje.length + 9) / 64) * 64;
  const bloque = new Uint8Array(total);
  bloque.set(mensaje);
  bloque[mensaje.length] = 0x80;
  const vista = new DataView(bloque.buffer);
  vista.setUint32(total - 8, Math.floor(largoBits / 0x1_0000_0000), false);
  vista.setUint32(total - 4, largoBits >>> 0, false);

  const W = new Uint32Array(64);
  for (let inicio = 0; inicio < total; inicio += 64) {
    for (let t = 0; t < 16; t++) W[t] = vista.getUint32(inicio + t * 4, false);
    for (let t = 16; t < 64; t++) {
      const w15 = W[t - 15]!;
      const w2 = W[t - 2]!;
      const s0 = rotr(w15, 7) ^ rotr(w15, 18) ^ (w15 >>> 3);
      const s1 = rotr(w2, 17) ^ rotr(w2, 19) ^ (w2 >>> 10);
      W[t] = (W[t - 16]! + s0 + W[t - 7]! + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = H as unknown as [number, number, number, number, number, number, number, number];
    for (let t = 0; t < 64; t++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[t]! + W[t]!) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;
      h = g; g = f; f = e; e = (d + temp1) >>> 0;
      d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
    }
    H[0] = (H[0]! + a) >>> 0; H[1] = (H[1]! + b) >>> 0; H[2] = (H[2]! + c) >>> 0; H[3] = (H[3]! + d) >>> 0;
    H[4] = (H[4]! + e) >>> 0; H[5] = (H[5]! + f) >>> 0; H[6] = (H[6]! + g) >>> 0; H[7] = (H[7]! + h) >>> 0;
  }
  const salida = new Uint8Array(32);
  const dv = new DataView(salida.buffer);
  for (let i = 0; i < 8; i++) dv.setUint32(i * 4, H[i]!, false);
  return salida;
}

function rotr(x: number, n: number): number {
  return ((x >>> n) | (x << (32 - n))) >>> 0;
}
