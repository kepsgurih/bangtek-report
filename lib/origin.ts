export function allowedOrigin(request: Request) {
  return request.headers.get("origin") === new URL(process.env.APP_URL || "http://localhost:3000").origin;
}
