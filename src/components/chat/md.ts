// Zelo majhen markdown (iz zaganjalnik/claude.html): bloki kode, `koda`, **krepko**, seznami, naslovi, odstavki.
// Vse besedilo je najprej escapano, zato je rezultat varen za dangerouslySetInnerHTML.

export function esc(s: string): string {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

export function md(text: string): string {
  const parts = String(text).split(/```[\w-]*\n?/);
  let out = "";
  parts.forEach((p, i) => {
    if (i % 2) {
      out += "<pre><code>" + esc(p.replace(/\n$/, "")) + "</code></pre>";
      return;
    }
    p.split(/\n{2,}/).forEach((para) => {
      if (!para.trim()) return;
      const h = esc(para).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
      const lines = h.split("\n");
      if (lines.every((l) => /^\s*([-*]|\d+\.)\s/.test(l))) {
        out += "<ul>" + lines.map((l) => "<li>" + l.replace(/^\s*([-*]|\d+\.)\s/, "") + "</li>").join("") + "</ul>";
      } else if (/^#{1,4}\s/.test(lines[0])) {
        out += "<h3>" + lines[0].replace(/^#+\s/, "") + "</h3>" + (lines.length > 1 ? "<p>" + lines.slice(1).join("<br>") + "</p>" : "");
      } else out += "<p>" + lines.join("<br>") + "</p>";
    });
  });
  return out;
}
