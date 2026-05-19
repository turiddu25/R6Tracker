export function isAdminAuthorized(request: Request) {
  const password = process.env.ADMIN_PASSWORD;
  const provided = request.headers.get("x-admin-password");

  return Boolean(password && provided && provided === password);
}

export function isWorkerAuthorized(request: Request) {
  const token = process.env.SCRAPER_WORKER_TOKEN;
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  return Boolean(token && provided && provided === token);
}
