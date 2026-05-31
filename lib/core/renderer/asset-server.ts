import http from "http";
import fs from "fs";
import path from "path";

export type AssetRouteResolver = (pathname: string) => string | null;

export class LocalAssetServer {
  private server: http.Server | null = null;
  private port = 0;

  constructor(
    private readonly rootDir: string,
    private readonly assetRouteResolver?: AssetRouteResolver,
  ) {}

  get baseUrl(): string {
    if (!this.port) throw new Error("Asset server is not started");
    return `http://127.0.0.1:${this.port}`;
  }

  async start(): Promise<string> {
    if (this.server) return this.baseUrl;

    this.server = http.createServer((req, res) => {
      try {
        const requestUrl = new URL(req.url ?? "/", this.baseUrl);
        let filePath: string | null = null;

        if (requestUrl.pathname.startsWith("/assets/") && this.assetRouteResolver) {
          filePath = this.assetRouteResolver(requestUrl.pathname);
        }

        if (!filePath) {
          const decodedPath = decodeURIComponent(requestUrl.pathname);
          const safePath = path.normalize(decodedPath).replace(/^(\.\.[/\\])+/, "");
          filePath = path.join(this.rootDir, safePath);
        }

        const normalizedRoot = path.resolve(this.rootDir);
        const resolved = path.resolve(filePath);
        if (!resolved.startsWith(normalizedRoot) && !this.assetRouteResolver) {
          res.statusCode = 403;
          res.end("Forbidden");
          return;
        }

        if (!fs.existsSync(resolved) || fs.statSync(resolved).isDirectory()) {
          res.statusCode = 404;
          res.end("Not found");
          return;
        }

        const ext = path.extname(resolved).toLowerCase();
        res.setHeader("Content-Type", contentTypeForExtension(ext));
        res.setHeader("Cache-Control", "no-store");
        fs.createReadStream(resolved).pipe(res);
      } catch {
        res.statusCode = 500;
        res.end("Server error");
      }
    });

    await new Promise<void>((resolve, reject) => {
      this.server!.once("error", reject);
      this.server!.listen(0, "127.0.0.1", () => resolve());
    });

    const address = this.server.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to start asset server");
    }

    this.port = address.port;
    return this.baseUrl;
  }

  async stop(): Promise<void> {
    if (!this.server) return;
    await new Promise<void>((resolve, reject) => {
      this.server!.close((error) => (error ? reject(error) : resolve()));
    });
    this.server = null;
    this.port = 0;
  }
}

function contentTypeForExtension(ext: string): string {
  switch (ext) {
    case ".html":
    case ".xhtml":
      return "application/xhtml+xml; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
      return "application/javascript; charset=utf-8";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    case ".svg":
      return "image/svg+xml";
    case ".woff":
      return "font/woff";
    case ".woff2":
      return "font/woff2";
    case ".otf":
      return "font/otf";
    case ".ttf":
      return "font/ttf";
    default:
      return "application/octet-stream";
  }
}

export function createFlatAssetRouteResolver(resourceSaveDir: string): AssetRouteResolver {
  return (pathname: string) => {
    const encoded = pathname.slice("/assets/".length);
    const href = decodeURIComponent(encoded);
    return path.join(resourceSaveDir, href.replace(/\//g, "_"));
  };
}
