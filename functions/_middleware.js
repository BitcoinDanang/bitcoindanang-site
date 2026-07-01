// Cloudflare Pages root middleware: canonical-domain 301 redirect.
//
// This Pages project serves BOTH bitcoindanang.com and bitcoindanang.org.
// .com is canonical. Any request to the .org apex or its www subdomain gets
// a permanent (301) redirect to the same path + query on https://bitcoindanang.com.
//
// Everything else (bitcoindanang.com, www.bitcoindanang.com) falls through via
// context.next() untouched, so static assets, functions/api/*, the _redirects
// clean-URL rewrites, and the SPA fallback all behave exactly as before.
export const onRequest = async (context) => {
  const url = new URL(context.request.url);
  const h = url.hostname;

  if (h === "bitcoindanang.org" || h === "www.bitcoindanang.org") {
    url.protocol = "https:";
    url.hostname = "bitcoindanang.com";
    return Response.redirect(url.toString(), 301);
  }

  return context.next();
};
