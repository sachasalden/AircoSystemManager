import type { ServerResponse } from "node:http";

export function applyCorsHeaders(response: ServerResponse): void {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,PUT,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
}
