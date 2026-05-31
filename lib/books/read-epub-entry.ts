import AdmZip from "adm-zip";

export function readEpubEntryByHref(buffer: Buffer, href: string): Buffer | null {
  const zip = new AdmZip(buffer);
  const target = href.replace(/\\/g, "/").replace(/^\/+/, "");

  for (const entry of zip.getEntries()) {
    const name = entry.entryName.replace(/\\/g, "/");
    if (name === target || name.endsWith(`/${target}`)) {
      return entry.getData();
    }
  }

  return null;
}
