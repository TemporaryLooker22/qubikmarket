// Décompression LZ4 (format "block").
// Roblox compresse les morceaux ("chunks") de ses fichiers binaires .rbxm / .rbxl avec LZ4.
(function (root) {
  function decompressLZ4(input, outputLength) {
    const output = new Uint8Array(outputLength);
    let i = 0; // position de lecture dans input
    let o = 0; // position d'écriture dans output

    while (i < input.length) {
      const token = input[i++];

      // 1) Les octets "littéraux" : copiés tels quels
      let literalLength = token >> 4;
      if (literalLength === 15) {
        let b;
        do {
          b = input[i++];
          literalLength += b;
        } while (b === 255);
      }
      for (let k = 0; k < literalLength; k++) output[o++] = input[i++];

      // Le dernier bloc ne contient que des littéraux
      if (i >= input.length) break;

      // 2) Une "copie" : on recopie des octets déjà écrits plus tôt
      const offset = input[i] | (input[i + 1] << 8);
      i += 2;
      if (offset === 0) throw new Error("LZ4 : offset invalide");

      let matchLength = token & 0x0f;
      if (matchLength === 15) {
        let b;
        do {
          b = input[i++];
          matchLength += b;
        } while (b === 255);
      }
      matchLength += 4;

      let from = o - offset;
      if (from < 0) throw new Error("LZ4 : données corrompues");
      for (let k = 0; k < matchLength; k++) output[o++] = output[from++];
    }

    if (o !== outputLength) throw new Error("LZ4 : taille décompressée inattendue");
    return output;
  }

  root.QubikLZ4 = { decompressLZ4 };
  if (typeof module !== "undefined") module.exports = root.QubikLZ4;
})(typeof window !== "undefined" ? window : globalThis);
