// Shrinks one PDF in the visitor's browser with Ghostscript (WebAssembly); nothing leaves the device here.
// One worker per file: Ghostscript's main() is not meant to be called twice in one instance.
import load from "./vendor/ghostscript-1.1.0/gs.js";

onmessage = async (e) => {
  try {
    const gs = await load({ print() {}, printErr() {} });
    gs.FS.writeFile("in.pdf", new Uint8Array(e.data));
    gs.callMain(["-sDEVICE=pdfwrite", "-dPDFSETTINGS=/ebook", "-dCompatibilityLevel=1.5", "-dNOPAUSE", "-dQUIET", "-dBATCH", "-sOutputFile=out.pdf", "in.pdf"]);
    const out = gs.FS.readFile("out.pdf");
    postMessage(out, [out.buffer]);
  } catch (err) {
    postMessage(null);
  }
};
