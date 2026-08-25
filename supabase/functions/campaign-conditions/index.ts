import {
  createClient,
} from "npm:@supabase/supabase-js@2.110.2";

import {
  corsHeaders as supabaseCorsHeaders,
} from "npm:@supabase/supabase-js@2.110.2/cors";


const CAMPAIGN_SEAT_USER_AGENT =
  "CampaignSeat/1.0 (https://campaignseat.com)";

const REQUEST_TIMEOUT_MS =
  12000;

const WEATHER_CACHE_MS =
  5 * 60 * 1000;

const LOCATION_CACHE_MS =
  24 * 60 * 60 * 1000;


const ALLOWED_ORIGINS =
  new Set([
    "https://campaignseat.com",
    "https://www.campaignseat.com",
    "https://app.campaignseat.com",
    "https://admin.campaignseat.com",
  ]);


type Coordinates = {
  latitude: number;
  longitude: number;
};


type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};


const coordinateCache =
  new Map<
    string,
    CacheEntry<Coordinates>
  >();


const weatherCache =
  new Map<
    string,
    CacheEntry<Record<string, unknown>>
  >();


function clean(
  value: unknown,
) {
  return String(
    value ?? "",
  ).trim();
}


function isUuid(
  value: unknown,
) {
  return (
    typeof value ===
      "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(
        value,
      )
  );
}


function isAllowedOrigin(
  origin: string,
) {
  if (
    ALLOWED_ORIGINS.has(
      origin,
    )
  ) {
    return true;
  }

  try {
    const parsed =
      new URL(
        origin,
      );

    return (
      parsed.protocol ===
        "http:" &&
      [
        "localhost",
        "127.0.0.1",
        "[::1]",
      ].includes(
        parsed.hostname,
      )
    );
  } catch {
    return false;
  }
}


function getCorsHeaders(
  request: Request,
) {
  const requestOrigin =
    request.headers.get(
      "origin",
    ) || "";

  const allowedOrigin =
    isAllowedOrigin(
      requestOrigin,
    )
      ? requestOrigin
      : "https://campaignseat.com";

  return {
    ...supabaseCorsHeaders,

    "Access-Control-Allow-Origin":
      allowedOrigin,

    "Access-Control-Allow-Methods":
      "POST, OPTIONS",

    "Access-Control-Max-Age":
      "86400",

    "Cache-Control":
      "no-store",

    Vary:
      "Origin",
  };
}


function createJsonResponse(
  corsHeaders:
    Record<string, string>,
) {
  return (
    body:
      Record<string, unknown>,
    status = 200,
  ) =>
    new Response(
      JSON.stringify(
        body,
      ),
      {
        status,

        headers: {
          ...corsHeaders,

          "Content-Type":
            "application/json",
        },
      },
    );
}


async function fetchJson(
  url: string,
  {
    accept =
      "application/json",
  } = {},
) {
  const controller =
    new AbortController();

  const timeoutId =
    setTimeout(
      () =>
        controller.abort(),
      REQUEST_TIMEOUT_MS,
    );

  try {
    const response =
      await fetch(
        url,
        {
          method:
            "GET",

          headers: {
            Accept:
              accept,

            "User-Agent":
              CAMPAIGN_SEAT_USER_AGENT,

            "Api-User-Agent":
              CAMPAIGN_SEAT_USER_AGENT,
          },

          signal:
            controller.signal,
        },
      );

    if (
      !response.ok
    ) {
      throw new Error(
        `External service returned HTTP ${response.status}.`,
      );
    }

    return await response.json();
  } finally {
    clearTimeout(
      timeoutId,
    );
  }
}


function coordinatesFromWikipediaPayload(
  payload: any,
): Coordinates | null {
  const pages =
    Array.isArray(
      payload
        ?.query
        ?.pages,
    )
      ? payload
          .query
          .pages
      : Object.values(
          payload
            ?.query
            ?.pages ||
            {},
        );

  for (
    const page
    of pages
  ) {
    const coordinate =
      page
        ?.coordinates
        ?.[0];

    const latitude =
      Number(
        coordinate
          ?.lat,
      );

    const longitude =
      Number(
        coordinate
          ?.lon,
      );

    if (
      Number.isFinite(
        latitude,
      ) &&
      Number.isFinite(
        longitude,
      )
    ) {
      return {
        latitude,
        longitude,
      };
    }
  }

  return null;
}


async function resolveCoordinates(
  location:
    string,
): Promise<Coordinates> {
  const normalized =
    clean(
      location,
    );

  const cacheKey =
    normalized
      .toLowerCase();

  const cached =
    coordinateCache.get(
      cacheKey,
    );

  if (
    cached &&
    cached.expiresAt >
      Date.now()
  ) {
    return cached.value;
  }


  const directParameters =
    new URLSearchParams({
      action:
        "query",

      format:
        "json",

      formatversion:
        "2",

      redirects:
        "1",

      prop:
        "coordinates",

      titles:
        normalized,
    });


  let payload =
    await fetchJson(
      `https://en.wikipedia.org/w/api.php?${directParameters.toString()}`,
    );


  let coordinates =
    coordinatesFromWikipediaPayload(
      payload,
    );


  if (
    !coordinates
  ) {
    const searchParameters =
      new URLSearchParams({
        action:
          "query",

        format:
          "json",

        formatversion:
          "2",

        generator:
          "search",

        gsrsearch:
          normalized,

        gsrnamespace:
          "0",

        gsrlimit:
          "5",

        prop:
          "coordinates",
      });


    payload =
      await fetchJson(
        `https://en.wikipedia.org/w/api.php?${searchParameters.toString()}`,
      );


    coordinates =
      coordinatesFromWikipediaPayload(
        payload,
      );
  }


  if (
    !coordinates
  ) {
    throw new Error(
      "Campaign location coordinates could not be resolved.",
    );
  }


  coordinateCache.set(
    cacheKey,
    {
      expiresAt:
        Date.now() +
        LOCATION_CACHE_MS,

      value:
        coordinates,
    },
  );


  return coordinates;
}


function quantityValue(
  value: any,
) {
  const number =
    Number(
      value
        ?.value,
    );

  return Number.isFinite(
    number,
  )
    ? number
    : null;
}


function quantityToFahrenheit(
  quantity: any,
) {
  const value =
    quantityValue(
      quantity,
    );

  if (
    value === null
  ) {
    return null;
  }

  const unit =
    clean(
      quantity
        ?.unitCode,
    ).toLowerCase();

  if (
    unit.includes(
      "degc",
    )
  ) {
    return (
      value *
        9 /
        5 +
      32
    );
  }

  if (
    unit.includes(
      "degf",
    )
  ) {
    return value;
  }

  return null;
}


function classifyWeather(
  value: unknown,
) {
  const description =
    clean(
      value,
    )
      .toLowerCase();

  if (
    /thunder|lightning|storm/.test(
      description,
    )
  ) {
    return "storm";
  }

  if (
    /snow|sleet|ice|flurr/.test(
      description,
    )
  ) {
    return "snow";
  }

  if (
    /rain|shower|drizzle/.test(
      description,
    )
  ) {
    return "rain";
  }

  if (
    /partly|mostly sunny|few clouds|scattered/.test(
      description,
    )
  ) {
    return "partly-cloudy";
  }

  if (
    /cloud|overcast|fog|mist|haze/.test(
      description,
    )
  ) {
    return "cloudy";
  }

  return "sunny";
}


async function loadWeather(
  coordinates:
    Coordinates,
) {
  const latitude =
    coordinates
      .latitude
      .toFixed(
        4,
      );

  const longitude =
    coordinates
      .longitude
      .toFixed(
        4,
      );


  const pointPayload =
    await fetchJson(
      `https://api.weather.gov/points/${latitude},${longitude}`,
      {
        accept:
          "application/geo+json",
      },
    );


  const pointProperties =
    pointPayload
      ?.properties ||
    {};


  const stationsUrl =
    clean(
      pointProperties
        .observationStations,
    );


  const hourlyUrl =
    clean(
      pointProperties
        .forecastHourly,
    );


  let temperatureF:
    number | null =
      null;

  let feelsLikeF:
    number | null =
      null;

  let humidity:
    number | null =
      null;

  let description =
    "";

  let observedAt:
    string | null =
      null;

  let station =
    "";


  if (
    stationsUrl
  ) {
    try {
      const stationPayload =
        await fetchJson(
          stationsUrl,
          {
            accept:
              "application/geo+json",
          },
        );


      const nearestStation =
        stationPayload
          ?.features
          ?.[0];


      const stationUrl =
        clean(
          nearestStation
            ?.id ||
          nearestStation
            ?."@id",
        );


      station =
        clean(
          nearestStation
            ?.properties
            ?.stationIdentifier,
        );


      if (
        stationUrl
      ) {
        const observationPayload =
          await fetchJson(
            `${stationUrl}/observations/latest`,
            {
              accept:
                "application/geo+json",
            },
          );


        const observation =
          observationPayload
            ?.properties ||
          {};


        temperatureF =
          quantityToFahrenheit(
            observation
              .temperature,
          );


        const heatIndex =
          quantityToFahrenheit(
            observation
              .heatIndex,
          );


        const windChill =
          quantityToFahrenheit(
            observation
              .windChill,
          );


        feelsLikeF =
          heatIndex ??
          windChill ??
          null;


        humidity =
          quantityValue(
            observation
              .relativeHumidity,
          );


        description =
          clean(
            observation
              .textDescription,
          );


        observedAt =
          clean(
            observation
              .timestamp,
          ) ||
          null;
      }
    } catch {
      // Hourly forecast below provides a graceful fallback.
    }
  }


  if (
    (
      temperatureF ===
        null ||
      !description
    ) &&
    hourlyUrl
  ) {
    const hourlyPayload =
      await fetchJson(
        hourlyUrl,
        {
          accept:
            "application/geo+json",
        },
      );


    const currentPeriod =
      hourlyPayload
        ?.properties
        ?.periods
        ?.[0];


    if (
      temperatureF ===
        null &&
      Number.isFinite(
        Number(
          currentPeriod
            ?.temperature,
        ),
      )
    ) {
      const value =
        Number(
          currentPeriod
            .temperature,
        );

      temperatureF =
        String(
          currentPeriod
            ?.temperatureUnit ||
          "",
        )
          .toUpperCase() ===
          "C"
          ? (
              value *
                9 /
                5 +
              32
            )
          : value;
    }


    if (
      !description
    ) {
      description =
        clean(
          currentPeriod
            ?.shortForecast,
        );
    }


    observedAt =
      observedAt ||
      clean(
        currentPeriod
          ?.startTime,
      ) ||
      null;
  }


  if (
    temperatureF ===
      null &&
    !description
  ) {
    throw new Error(
      "National Weather Service conditions were unavailable for this location.",
    );
  }


  return {
    temperatureF,

    feelsLikeF,

    humidity,

    description:
      description ||
      "Current conditions",

    kind:
      classifyWeather(
        description,
      ),

    observedAt,

    station,

    latitude:
      coordinates
        .latitude,

    longitude:
      coordinates
        .longitude,

    source:
      "National Weather Service",
  };
}


Deno.serve(
  async (
    request,
  ) => {
    const corsHeaders =
      getCorsHeaders(
        request,
      );

    const jsonResponse =
      createJsonResponse(
        corsHeaders,
      );


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
          ok:
            false,

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
          ok:
            false,

          error:
            "A signed-in Campaign Seat session is required.",
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
          ok:
            false,

          error:
            "Supabase environment configuration is unavailable.",
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
      data:
        authResult,
      error:
        authError,
    } =
      await supabase
        .auth
        .getUser();


    if (
      authError ||
      !authResult
        ?.user
    ) {
      return jsonResponse(
        {
          ok:
            false,

          error:
            "The Campaign Seat session could not be verified.",
        },
        401,
      );
    }


    let body:
      Record<
        string,
        unknown
      >;


    try {
      body =
        await request.json();
    } catch {
      return jsonResponse(
        {
          ok:
            false,

          error:
            "The request body must be valid JSON.",
        },
        400,
      );
    }


    const workspaceId =
      clean(
        body
          .workspaceId,
      );


    const location =
      clean(
        body
          .location,
      );


    if (
      !isUuid(
        workspaceId,
      )
    ) {
      return jsonResponse(
        {
          ok:
            false,

          error:
            "A valid workspace ID is required.",
        },
        400,
      );
    }


    if (
      !location ||
      location.length >
        180
    ) {
      return jsonResponse(
        {
          ok:
            false,

          error:
            "A valid campaign location is required.",
        },
        400,
      );
    }


    const {
      data:
        workspaceRecord,
      error:
        workspaceError,
    } =
      await supabase
        .from(
          "workspaces",
        )
        .select(
          "id",
        )
        .eq(
          "id",
          workspaceId,
        )
        .maybeSingle();


    if (
      workspaceError ||
      !workspaceRecord
    ) {
      return jsonResponse(
        {
          ok:
            false,

          error:
            "This campaign workspace is not available to the signed-in account.",
        },
        404,
      );
    }


    const weatherKey =
      [
        workspaceId,
        location
          .toLowerCase(),
      ].join(
        ":",
      );


    const cached =
      weatherCache.get(
        weatherKey,
      );


    if (
      cached &&
      cached.expiresAt >
        Date.now()
    ) {
      return jsonResponse(
        {
          ok:
            true,

          cached:
            true,

          conditions:
            cached
              .value,
        },
      );
    }


    try {
      const coordinates =
        await resolveCoordinates(
          location,
        );


      const weather =
        await loadWeather(
          coordinates,
        );


      const conditions = {
        ...weather,

        location,

        fetchedAt:
          new Date()
            .toISOString(),
      };


      weatherCache.set(
        weatherKey,
        {
          expiresAt:
            Date.now() +
            WEATHER_CACHE_MS,

          value:
            conditions,
        },
      );


      return jsonResponse(
        {
          ok:
            true,

          cached:
            false,

          conditions,
        },
      );
    } catch (
      error
    ) {
      console.error(
        "Campaign conditions failed:",
        error,
      );


      return jsonResponse(
        {
          ok:
            false,

          error:
            error instanceof Error
              ? error.message
              : "Campaign conditions could not be loaded.",
        },
        502,
      );
    }
  },
);
