export interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
}

const CANONICAL_HOST = "dx-styles.dev";
const REDIRECT_HOSTS = new Set(["css-in-js.dev", "www.css-in-js.dev", "www.dx-styles.dev"]);

const worker = {
  fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (REDIRECT_HOSTS.has(url.hostname)) {
      url.hostname = CANONICAL_HOST;
      url.protocol = "https:";
      url.port = "";
      return Promise.resolve(Response.redirect(url.toString(), 301));
    }
    return env.ASSETS.fetch(request);
  },
};

export default worker;
