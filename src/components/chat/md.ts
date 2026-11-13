// Majhen markdown za odgovore Clauda: bloki kode (z oznako jezika), naslovi, seznami (označeni, oštevilčeni,
// ugnezdeni, naloge), tabele, citati, črte, **krepko**, *ležeče*, `koda`, povezave.
// Vse besedilo je najprej escapano, zato je rezultat varen za dangerouslySetInnerHTML.

export function esc(s: string): string {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

// vrstično oblikovanje (vhod je že escapan)
function inline(h: string): string {
  const codes: string[] = [];
  h = h.replace(/`([^`]+)`/g, (_, c) => "\u0000" + (codes.push("<code>" + c + "</code>") - 1) + "\u0000");
  h = h
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
    .replace(/(^|[\s(])\*([^*\s][^*]*)\*(?=$|[\s).,;:!?])/g, "$1<i>$2</i>");
  return h.replace(/\u0000(\d+)\u0000/g, (_, i) => codes[+i]);
}

const LI = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;

function cells(line: string): string[] {
  return line.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
}

function list(lines: string[]): string {
  // ugnezdenost po zamiku (2+ presledka = nova raven)
  let out = "";
  const stack: { indent: number; tag: string }[] = [];
  for (const l of lines) {
    const m = LI.exec(l)!;
    const indent = m[1].replace(/\t/g, "  ").length;
    const tag = /\d/.test(m[2]) ? "ol" : "ul";
    while (stack.length && indent < stack[stack.length - 1].indent) {
      out += "</li></" + stack.pop()!.tag + ">";
    }
    const top = stack[stack.length - 1];
    if (!top || indent > top.indent) {
      out += "<" + tag + ">";
      stack.push({ indent, tag });
    } else out += "</li>";
    let body = inline(esc(m[3]));
    const t = /^\[( |x|X)\]\s+(.*)$/.exec(m[3]);
    if (t) body = '<span class="chk' + (t[1] === " " ? "" : " on") + '"></span>' + inline(esc(t[2]));
    out += "<li>" + body;
  }
  while (stack.length) out += "</li></" + stack.pop()!.tag + ">";
  return out;
}

function blocks(text: string): string {
  const lines = text.split("\n");
  let out = "";
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) { i++; continue; }

    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(l)) { out += "<hr>"; i++; continue; }

    const h = /^(#{1,6})\s+(.*)$/.exec(l);
    if (h) {
      const lvl = Math.min(h[1].length, 3);
      out += "<h" + lvl + ">" + inline(esc(h[2])) + "</h" + lvl + ">";
      i++;
      continue;
    }

    if (/^\s*>/.test(l)) {
      const q: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) q.push(lines[i++].replace(/^\s*>\s?/, ""));
      out += "<blockquote>" + blocks(q.join("\n")) + "</blockquote>";
      continue;
    }

    if (l.includes("|") && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(lines[i + 1])) {
      const head = cells(l);
      const aligns = cells(lines[i + 1]).map((c) => (/^:-*:$/.test(c) ? "center" : /-:$/.test(c) ? "right" : ""));
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim()) rows.push(cells(lines[i++]));
      const td = (t: string, c: string, k: number) =>
        "<" + t + (aligns[k] ? ' style="text-align:' + aligns[k] + '"' : "") + ">" + inline(esc(c)) + "</" + t + ">";
      out +=
        '<div class="tbl"><table><thead><tr>' + head.map((c, k) => td("th", c, k)).join("") + "</tr></thead><tbody>" +
        rows.map((r) => "<tr>" + head.map((_, k) => td("td", r[k] ?? "", k)).join("") + "</tr>").join("") +
        "</tbody></table></div>";
      continue;
    }

    if (LI.test(l)) {
      const items: string[] = [];
      while (i < lines.length && (LI.test(lines[i]) || (/^\s+\S/.test(lines[i]) && items.length))) {
        if (LI.test(lines[i])) items.push(lines[i]);
        else items[items.length - 1] += " " + lines[i].trim(); // nadaljevanje točke
        i++;
      }
      out += list(items);
      continue;
    }

    // odstavek: do prazne vrstice ali začetka drugega bloka
    const p: string[] = [];
    while (
      i < lines.length && lines[i].trim() && !/^(#{1,6}\s|\s*>)/.test(lines[i]) && !LI.test(lines[i]) &&
      !/^\s*([-*_])(\s*\1){2,}\s*$/.test(lines[i])
    ) p.push(lines[i++]);
    if (!p.length) { out += "<p>" + inline(esc(lines[i++])) + "</p>"; continue; }
    out += "<p>" + p.map((x) => inline(esc(x))).join("<br>") + "</p>";
  }
  return out;
}

export function md(text: string): string {
  // ograje ``` jezik … ``` (nezaprta ograja med pretakanjem velja do konca)
  const re = /```([\w+#.-]*)[ \t]*\n?([\s\S]*?)(?:```|$)/g;
  let out = "";
  let last = 0;
  let m: RegExpExecArray | null;
  const src = String(text);
  while ((m = re.exec(src))) {
    out += blocks(src.slice(last, m.index));
    out +=
      '<pre><div class="code-h"><span>' + esc(m[1] || "koda") + '</span><button type="button" class="copy">Kopiraj</button></div>' +
      "<code>" + esc(m[2].replace(/\n$/, "")) + "</code></pre>";
    last = re.lastIndex;
    if (m[0] === "") re.lastIndex++;
  }
  return out + blocks(src.slice(last));
}
