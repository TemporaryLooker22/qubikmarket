// Lecture des fichiers Roblox : .rbxm / .rbxl (binaire) et .rbxmx / .rbxlx (XML).
// Objectif : extraire tous les scripts (Script, LocalScript, ModuleScript) avec leur code.
(function (root) {
  const LZ4 = root.QubikLZ4 || (typeof require !== "undefined" ? require("./lz4.js") : null);
  // ZSTD : autre compression utilisée par les versions récentes de Roblox Studio
  const ZSTD = root.fzstd || (typeof require !== "undefined" ? require("./vendor/fzstd.js") : null);
  const utf8 = new TextDecoder("utf-8");

  const SCRIPT_CLASSES = ["Script", "LocalScript", "ModuleScript"];

  // ---------- Détection du type de fichier ----------

  function detectFormat(bytes) {
    const head = utf8.decode(bytes.subarray(0, 9));
    if (head.startsWith("<roblox!")) return "binary";
    if (head.startsWith("<roblox")) return "xml";
    return "text"; // un simple fichier .lua / .luau
  }

  // ---------- Format binaire ----------

  // Petit lecteur qui avance dans un tableau d'octets
  function createReader(bytes) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let pos = 0;
    return {
      get pos() { return pos; },
      skip(n) { pos += n; },
      u8() { return bytes[pos++]; },
      u32() { const v = view.getUint32(pos, true); pos += 4; return v; },
      bytes(n) { const b = bytes.subarray(pos, pos + n); pos += n; return b; },
      string() { const len = this.u32(); return utf8.decode(this.bytes(len)); },
      // Roblox stocke les tableaux d'entiers "entrelacés" : tous les 1ers octets, puis tous les 2es, etc.
      interleavedI32(count) {
        const raw = this.bytes(count * 4);
        const out = new Array(count);
        for (let i = 0; i < count; i++) {
          const v = ((raw[i] << 24) | (raw[i + count] << 16) | (raw[i + count * 2] << 8) | raw[i + count * 3]) >>> 0;
          out[i] = (v >>> 1) ^ -(v & 1); // décodage "zigzag"
        }
        return out;
      },
      referents(count) {
        const values = this.interleavedI32(count);
        for (let i = 1; i < count; i++) values[i] += values[i - 1]; // valeurs cumulées
        return values;
      },
    };
  }

  function readChunks(bytes) {
    const r = createReader(bytes);
    r.skip(8 + 6 + 2 + 4 + 4 + 8); // en-tête : "<roblox!", signature, version, compteurs, réservé
    const chunks = [];

    while (r.pos < bytes.length) {
      const name = utf8.decode(r.bytes(4)).replace(/\0/g, "");
      const compressedLength = r.u32();
      const uncompressedLength = r.u32();
      r.skip(4);

      let data;
      if (compressedLength === 0) {
        data = r.bytes(uncompressedLength);
      } else {
        const compressed = r.bytes(compressedLength);
        const isZstd = compressed[0] === 0x28 && compressed[1] === 0xb5 && compressed[2] === 0x2f && compressed[3] === 0xfd;
        data = isZstd
          ? ZSTD.decompress(compressed, new Uint8Array(uncompressedLength))
          : LZ4.decompressLZ4(compressed, uncompressedLength);
      }

      chunks.push({ name, data });
      if (name === "END") break;
    }
    return chunks;
  }

  function parseBinary(bytes) {
    const classes = {};   // classId -> { className, referents }
    const instances = {}; // referent -> { className, props, parent }

    for (const chunk of readChunks(bytes)) {
      const r = createReader(chunk.data);

      if (chunk.name === "INST") {
        const classId = r.u32();
        const className = r.string();
        r.u8(); // format (service ou non)
        const count = r.u32();
        const refs = r.referents(count);
        classes[classId] = { className, refs };
        for (const ref of refs) instances[ref] = { className, props: {}, parent: -1 };
      }

      if (chunk.name === "PROP") {
        const classId = r.u32();
        const propName = r.string();
        const type = r.u8();
        const cls = classes[classId];
        // On ne lit que les propriétés texte (type 0x01) "Name" et "Source"
        if (cls && type === 0x01 && (propName === "Name" || propName === "Source")) {
          for (const ref of cls.refs) instances[ref].props[propName] = r.string();
        }
      }

      if (chunk.name === "PRNT") {
        r.u8(); // version
        const count = r.u32();
        const children = r.referents(count);
        const parents = r.referents(count);
        for (let i = 0; i < count; i++) {
          if (instances[children[i]]) instances[children[i]].parent = parents[i];
        }
      }
    }

    // Construit le chemin complet, ex. "Model.Handler.Script"
    function pathOf(ref) {
      const parts = [];
      let guard = 0;
      while (ref !== -1 && instances[ref] && guard++ < 1000) {
        parts.unshift(instances[ref].props.Name || instances[ref].className);
        ref = instances[ref].parent;
      }
      return parts.join(".");
    }

    return Object.keys(instances).map((ref) => {
      const inst = instances[ref];
      return {
        className: inst.className,
        name: inst.props.Name || inst.className,
        path: pathOf(Number(ref)),
        source: inst.props.Source,
      };
    });
  }

  // ---------- Format XML ----------

  function decodeXmlText(text) {
    if (text.includes("<![CDATA[")) {
      return text.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
    }
    return text
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
      .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
      .replace(/&amp;/g, "&");
  }

  function parseXml(text) {
    const tokens = /<Item\s+class="([^"]+)"[^>]*>|<\/Item>|<(string|ProtectedString)\s+name="(Name|Source)"\s*>([\s\S]*?)<\/\2>/g;
    const stack = [];
    const result = [];
    let match;

    while ((match = tokens.exec(text))) {
      if (match[1]) {
        const item = { className: match[1], name: match[1], source: undefined, parentIndex: stack.length ? stack[stack.length - 1] : -1 };
        result.push(item);
        stack.push(result.length - 1);
      } else if (match[0] === "</Item>") {
        stack.pop();
      } else if (stack.length) {
        const current = result[stack[stack.length - 1]];
        if (match[3] === "Name") current.name = decodeXmlText(match[4]);
        else current.source = decodeXmlText(match[4]);
      }
    }

    return result.map((item) => {
      const parts = [];
      for (let it = item; it; it = it.parentIndex >= 0 ? result[it.parentIndex] : null) parts.unshift(it.name);
      return { className: item.className, name: item.name, path: parts.join("."), source: item.source };
    });
  }

  // ---------- Point d'entrée ----------

  // Renvoie { format, instances, scripts }
  function readRobloxFile(bytes, fileName) {
    const format = detectFormat(bytes);
    let instances;

    if (format === "binary") instances = parseBinary(bytes);
    else if (format === "xml") instances = parseXml(utf8.decode(bytes));
    else instances = [{ className: "Script", name: fileName || "script.lua", path: fileName || "script.lua", source: utf8.decode(bytes) }];

    const scripts = instances.filter((i) => SCRIPT_CLASSES.includes(i.className) && typeof i.source === "string");
    return { format, instances, scripts };
  }

  root.QubikRbxm = { readRobloxFile, SCRIPT_CLASSES };
  if (typeof module !== "undefined") module.exports = root.QubikRbxm;
})(typeof window !== "undefined" ? window : globalThis);
