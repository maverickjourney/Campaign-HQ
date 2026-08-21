export function clean(value: unknown) {
  return String(value || "").trim();
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}

function base64Bytes(bytes: Uint8Array) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary);
}

async function hmacSha1Base64(secret: string, value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value),
  );

  return base64Bytes(new Uint8Array(signature));
}

export function parseForm(rawBody: string) {
  return new URLSearchParams(rawBody);
}

export async function validTwilioSignature(
  request: Request,
  rawBody: string,
  authToken: string,
  canonicalUrl?: string,
) {
  const provided = clean(request.headers.get("x-twilio-signature"));
  if (!provided) return false;

  const entries = Array.from(parseForm(rawBody).entries()).sort(
    (left, right) => {
      const keyOrder = left[0].localeCompare(right[0]);
      return keyOrder !== 0 ? keyOrder : left[1].localeCompare(right[1]);
    },
  );

  let payload = canonicalUrl || request.url;
  for (const [key, value] of entries) {
    payload += `${key}${value}`;
  }

  const expected = await hmacSha1Base64(authToken, payload);

  return constantTimeEqual(
    new TextEncoder().encode(provided),
    new TextEncoder().encode(expected),
  );
}

export function twimlResponse(status = 200) {
  return new Response(
    '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
    {
      status,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "no-store",
      },
    },
  );
}

export function textResponse(value: string, status = 200) {
  return new Response(value, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
