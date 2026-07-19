import {
  createClient,
} from "npm:@supabase/supabase-js@2.110.2";
import {
  corsHeaders,
} from "npm:@supabase/supabase-js@2.110.2/cors";

const JSON_HEADERS = {
  ...corsHeaders,
  "Content-Type": "application/json",
};

const MAX_STOPS_PER_RUN = 100;
const CONCURRENCY = 4;
const REQUEST_TIMEOUT_MS = 12000;

type FieldStop = {
  id: string;
  route_id: string;
  stop_order: number;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
};

type GeocodeResult = {
  stopId: string;
  stopOrder: number;
  status:
    | "matched"
    | "unmatched"
    | "failed";
  latitude?: number;
  longitude?: number;
  matchedAddress?: string;
  reason?: string;
};

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: JSON_HEADERS,
    },
  );
}

function isUuid(value: unknown) {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(value)
  );
}

function hasCoordinate(
  value: unknown,
) {
  if (
    value === null ||
    value === undefined ||
    String(value).trim() === ""
  ) {
    return false;
  }

  return Number.isFinite(
    Number(value),
  );
}

function needsCoordinates(
  stop: FieldStop,
) {
  return (
    !hasCoordinate(
      stop.latitude,
    ) ||
    !hasCoordinate(
      stop.longitude,
    )
  );
}

function clean(value: unknown) {
  return String(value ?? "")
    .trim();
}

function censusParams(
  stop: FieldStop,
) {
  const street = [
    stop.address_line_1,
    stop.address_line_2,
  ]
    .map(clean)
    .filter(Boolean)
    .join(" ");

  return new URLSearchParams({
    street,
    city:
      clean(stop.city),
    state:
      clean(stop.state),
    zip:
      clean(stop.postal_code),
    benchmark:
      "Public_AR_Current",
    format:
      "json",
  });
}

async function fetchWithTimeout(
  url: string,
) {
  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () => controller.abort(),
      REQUEST_TIMEOUT_MS,
    );

  try {
    return await fetch(
      url,
      {
        method: "GET",
        headers: {
          Accept:
            "application/json",
        },
        signal:
          controller.signal,
      },
    );
  } finally {
    clearTimeout(timeout);
  }
}

async function geocodeStop(
  stop: FieldStop,
): Promise<GeocodeResult> {
  const street =
    clean(
      stop.address_line_1,
    );

  const city =
    clean(stop.city);

  const state =
    clean(stop.state);

  const postalCode =
    clean(
      stop.postal_code,
    );

  if (
    !street ||
    (
      !postalCode &&
      (
        !city ||
        !state
      )
    )
  ) {
    return {
      stopId:
        stop.id,
      stopOrder:
        stop.stop_order,
      status:
        "unmatched",
      reason:
        "The address is missing the street plus ZIP or city/state.",
    };
  }

  try {
    const endpoint =
      "https://geocoding.geo.census.gov/geocoder/locations/address";

    const response =
      await fetchWithTimeout(
        `${endpoint}?${censusParams(
          stop,
        ).toString()}`,
      );

    if (!response.ok) {
      return {
        stopId:
          stop.id,
        stopOrder:
          stop.stop_order,
        status:
          "failed",
        reason:
          `Census Geocoder returned HTTP ${response.status}.`,
      };
    }

    const payload =
      await response.json();

    const match =
      payload
        ?.result
        ?.addressMatches
        ?.[0];

    const longitude =
      Number(
        match
          ?.coordinates
          ?.x,
      );

    const latitude =
      Number(
        match
          ?.coordinates
          ?.y,
      );

    if (
      !Number.isFinite(
        latitude,
      ) ||
      !Number.isFinite(
        longitude,
      )
    ) {
      return {
        stopId:
          stop.id,
        stopOrder:
          stop.stop_order,
        status:
          "unmatched",
        reason:
          "No Census address match was found.",
      };
    }

    return {
      stopId:
        stop.id,
      stopOrder:
        stop.stop_order,
      status:
        "matched",
      latitude,
      longitude,
      matchedAddress:
        clean(
          match
            ?.matchedAddress,
        ),
    };
  } catch (error) {
    return {
      stopId:
        stop.id,
      stopOrder:
        stop.stop_order,
      status:
        "failed",
      reason:
        error instanceof Error
          ? error.message
          : "The geocoding request failed.",
    };
  }
}

function leadershipApproved(
  value: unknown,
) {
  if (
    value === true
  ) {
    return true;
  }

  if (
    Array.isArray(value)
  ) {
    return value.some(
      (entry) =>
        entry === true ||
        (
          entry &&
          typeof entry ===
            "object" &&
          Object.values(
            entry,
          ).some(
            (nested) =>
              nested === true,
          )
        ),
    );
  }

  if (
    value &&
    typeof value ===
      "object"
  ) {
    return Object.values(
      value,
    ).some(
      (entry) =>
        entry === true,
    );
  }

  return false;
}

Deno.serve(
  async (request) => {
    if (
      request.method ===
      "OPTIONS"
    ) {
      return new Response(
        "ok",
        {
          headers:
            corsHeaders,
        },
      );
    }

    if (
      request.method !==
      "POST"
    ) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Method not allowed.",
        },
        405,
      );
    }

    const authorization =
      request.headers.get(
        "Authorization",
      );

    if (
      !authorization
        ?.startsWith(
          "Bearer ",
        )
    ) {
      return jsonResponse(
        {
          ok: false,
          error:
            "A signed-in Campaign HQ session is required.",
        },
        401,
      );
    }

    const supabaseUrl =
      Deno.env.get(
        "SUPABASE_URL",
      );

    const publishableKeysValue =
      Deno.env.get(
        "SUPABASE_PUBLISHABLE_KEYS",
      );

    let clientKey =
      Deno.env.get(
        "SUPABASE_ANON_KEY",
      ) ||
      "";

    if (
      publishableKeysValue
    ) {
      try {
        const publishableKeys =
          JSON.parse(
            publishableKeysValue,
          );

        clientKey =
          publishableKeys
            ?.default ||
          Object.values(
            publishableKeys,
          )[0] ||
          clientKey;
      } catch {
        // Legacy anon key remains the fallback.
      }
    }

    if (
      !supabaseUrl ||
      !clientKey
    ) {
      return jsonResponse(
        {
          ok: false,
          error:
            "The Edge Function is missing its built-in Supabase environment variables.",
        },
        500,
      );
    }

    const supabase =
      createClient(
        supabaseUrl,
        clientKey,
        {
          global: {
            headers: {
              Authorization:
                authorization,
            },
          },
          auth: {
            persistSession:
              false,
            autoRefreshToken:
              false,
            detectSessionInUrl:
              false,
          },
        },
      );

    const {
      data: userResult,
      error: userError,
    } =
      await supabase
        .auth
        .getUser();

    if (
      userError ||
      !userResult.user
    ) {
      return jsonResponse(
        {
          ok: false,
          error:
            "The Campaign HQ session could not be verified.",
        },
        401,
      );
    }

    let body:
      Record<string, unknown>;

    try {
      body =
        await request.json();
    } catch {
      return jsonResponse(
        {
          ok: false,
          error:
            "The request body must be valid JSON.",
        },
        400,
      );
    }

    const routeId =
      body.routeId;

    if (
      !isUuid(routeId)
    ) {
      return jsonResponse(
        {
          ok: false,
          error:
            "A valid field route ID is required.",
        },
        400,
      );
    }

    const {
      data: routeRecord,
      error: routeError,
    } =
      await supabase
        .from(
          "field_routes",
        )
        .select(
          "id, assignment_id",
        )
        .eq(
          "id",
          routeId,
        )
        .single();

    if (
      routeError ||
      !routeRecord
        ?.assignment_id
    ) {
      return jsonResponse(
        {
          ok: false,
          error:
            "The field route could not be found or is not available to this account.",
          detail:
            routeError
              ?.message ||
            null,
        },
        404,
      );
    }

    const {
      data:
        assignmentRecord,
      error:
        assignmentError,
    } =
      await supabase
        .from(
          "field_assignments",
        )
        .select(
          "id, workspace_id",
        )
        .eq(
          "id",
          routeRecord
            .assignment_id,
        )
        .single();

    if (
      assignmentError ||
      !assignmentRecord
        ?.workspace_id
    ) {
      return jsonResponse(
        {
          ok: false,
          error:
            "The route workspace could not be verified.",
          detail:
            assignmentError
              ?.message ||
            null,
        },
        400,
      );
    }

    const {
      data:
        leadershipResult,
      error:
        leadershipError,
    } =
      await supabase
        .rpc(
          "is_field_leadership",
          {
            target_workspace_id:
              assignmentRecord
                .workspace_id,
          },
        );

    if (
      leadershipError
    ) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Campaign leadership authorization could not be verified.",
          detail:
            leadershipError.message,
        },
        500,
      );
    }

    if (
      !leadershipApproved(
        leadershipResult,
      )
    ) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Only authorized campaign leadership may geocode field routes.",
        },
        403,
      );
    }

    const {
      data: stopRows,
      error: stopError,
    } =
      await supabase
        .from(
          "field_stops",
        )
        .select(`
          id,
          route_id,
          stop_order,
          address_line_1,
          address_line_2,
          city,
          state,
          postal_code,
          latitude,
          longitude
        `)
        .eq(
          "route_id",
          routeId,
        )
        .order(
          "stop_order",
          {
            ascending: true,
          },
        );

    if (
      stopError
    ) {
      return jsonResponse(
        {
          ok: false,
          error:
            "The route stops could not be loaded.",
          detail:
            stopError.message,
        },
        400,
      );
    }

    const stops =
      (
        stopRows ||
        []
      ) as FieldStop[];

    const missing =
      stops.filter(
        needsCoordinates,
      );

    const batch =
      missing.slice(
        0,
        MAX_STOPS_PER_RUN,
      );

    const results:
      GeocodeResult[] =
      [];

    for (
      let index = 0;
      index < batch.length;
      index += CONCURRENCY
    ) {
      const group =
        batch.slice(
          index,
          index +
            CONCURRENCY,
        );

      const groupResults =
        await Promise.all(
          group.map(
            geocodeStop,
          ),
        );

      results.push(
        ...groupResults,
      );

      if (
        index +
          CONCURRENCY <
        batch.length
      ) {
        await new Promise(
          (resolve) =>
            setTimeout(
              resolve,
              250,
            ),
        );
      }
    }

    let updated = 0;

    const updateFailures:
      GeocodeResult[] =
      [];

    for (
      const result
      of results
    ) {
      if (
        result.status !==
        "matched" ||
        result.latitude ===
          undefined ||
        result.longitude ===
          undefined
      ) {
        continue;
      }

      const {
        error:
          updateError,
      } =
        await supabase
          .from(
            "field_stops",
          )
          .update({
            latitude:
              result.latitude,
            longitude:
              result.longitude,
          })
          .eq(
            "id",
            result.stopId,
          )
          .eq(
            "route_id",
            routeId,
          );

      if (
        updateError
      ) {
        updateFailures.push({
          ...result,
          status:
            "failed",
          reason:
            updateError.message,
        });
      } else {
        updated += 1;
      }
    }

    const unmatched =
      results.filter(
        (result) =>
          result.status ===
          "unmatched",
      ).length;

    const providerFailures =
      results.filter(
        (result) =>
          result.status ===
          "failed",
      ).length;

    const failed =
      providerFailures +
      updateFailures.length;

    return jsonResponse({
      ok: true,
      routeId,
      totalStops:
        stops.length,
      missingBefore:
        missing.length,
      attempted:
        batch.length,
      matched:
        results.filter(
          (result) =>
            result.status ===
            "matched",
        ).length,
      updated,
      unmatched,
      failed,
      remaining:
        Math.max(
          0,
          missing.length -
            batch.length,
        ),
      limitPerRun:
        MAX_STOPS_PER_RUN,
      results:
        results.map(
          (result) => ({
            stopId:
              result.stopId,
            stopOrder:
              result.stopOrder,
            status:
              result.status,
            matchedAddress:
              result.matchedAddress ||
              null,
            reason:
              result.reason ||
              null,
          }),
        ),
      updateFailures:
        updateFailures.map(
          (result) => ({
            stopId:
              result.stopId,
            stopOrder:
              result.stopOrder,
            reason:
              result.reason ||
              "The coordinate update failed.",
          }),
        ),
    });
  },
);
