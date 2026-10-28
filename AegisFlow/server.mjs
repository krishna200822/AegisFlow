import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";

const clientDirectory = fileURLToPath(new URL("./dist/client/", import.meta.url));
const { default: app } = await import("./dist/server/server.js");
const port = Number(process.env.PORT ?? 3000);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error(`Invalid PORT value: ${process.env.PORT}`);
}

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"],
  [".webp", "image/webp"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
]);

async function serveAsset(request, response, pathname) {
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    response.writeHead(400).end("Bad request");
    return true;
  }

  if (
    (request.method !== "GET" && request.method !== "HEAD") ||
    !(
      decodedPath === "/favicon.svg" ||
      decodedPath === "/robots.txt" ||
      decodedPath.startsWith("/assets/")
    )
  ) {
    return false;
  }

  const filePath = resolve(clientDirectory, `.${decodedPath}`);
  if (!filePath.startsWith(`${resolve(clientDirectory)}${sep}`)) {
    response.writeHead(404).end("Not found");
    return true;
  }

  let fileInfo;
  try {
    fileInfo = await stat(filePath);
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "ENOTDIR") return false;
    throw error;
  }

  if (!fileInfo.isFile()) return false;

  response.writeHead(200, {
    "Cache-Control": decodedPath.startsWith("/assets/")
      ? "public, max-age=31536000, immutable"
      : "public, max-age=3600",
    "Content-Length": fileInfo.size,
    "Content-Type": contentTypes.get(extname(filePath)) ?? "application/octet-stream",
  });

  if (request.method === "HEAD") {
    response.end();
  } else {
    createReadStream(filePath).pipe(response);
  }
  return true;
}

const server = createServer(async (incoming, outgoing) => {
  try {
    const protocol = incoming.headers["x-forwarded-proto"]?.split(",")[0] ?? "http";
    const requestUrl = new URL(
      incoming.url ?? "/",
      `${protocol}://${incoming.headers.host ?? "localhost"}`,
    );

    if (await serveAsset(incoming, outgoing, requestUrl.pathname)) return;

    const headers = new Headers();
    for (let index = 0; index < incoming.rawHeaders.length; index += 2) {
      headers.append(incoming.rawHeaders[index], incoming.rawHeaders[index + 1]);
    }

    const method = incoming.method ?? "GET";
    const hasBody = method !== "GET" && method !== "HEAD";
    const request = new Request(requestUrl, {
      method,
      headers,
      ...(hasBody ? { body: Readable.toWeb(incoming), duplex: "half" } : {}),
    });
    const result = await app.fetch(request, {}, {});
    outgoing.writeHead(result.status, Object.fromEntries(result.headers));

    if (method === "HEAD" || !result.body) {
      outgoing.end();
    } else {
      const body = Readable.fromWeb(result.body);
      body.on("error", (error) => {
        console.error("Failed to stream the frontend response", error);
        outgoing.destroy(error);
      });
      body.pipe(outgoing);
    }
  } catch (error) {
    console.error("Frontend request failed", error);
    if (!outgoing.headersSent) {
      outgoing.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      outgoing.end("Internal server error");
    } else {
      outgoing.destroy(error);
    }
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`AegisFlow frontend listening on port ${port}`);
});
