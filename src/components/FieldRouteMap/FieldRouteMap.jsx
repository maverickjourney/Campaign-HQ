import {
  ExternalLink,
  MapPin,
  Navigation,
  ShieldCheck,
} from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  useEffect,
  useRef,
} from "react";

import styles from "./FieldRouteMap.module.css";

const ROUTE_COLORS = [
  "#215f9c",
  "#d91e29",
  "#2a805c",
  "#7b4aa8",
  "#a76d16",
];

function numericCoordinate(value) {
  if (
    value === null ||
    value === undefined ||
    String(value).trim() === ""
  ) {
    return null;
  }

  const number =
    Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}

function getAddress(stop) {
  return [
    stop.address_line_1,
    stop.address_line_2,
    [
      stop.city,
      stop.state,
      stop.postal_code,
    ]
      .filter(Boolean)
      .join(" "),
  ]
    .filter(Boolean)
    .join(", ");
}

function sortedStops(route) {
  return (
    route.field_stops ||
    []
  )
    .slice()
    .sort(
      (left, right) =>
        Number(
          left.stop_order ||
            0,
        ) -
        Number(
          right.stop_order ||
            0,
        ),
    );
}

function mappedStops(routes) {
  return routes.flatMap(
    (route, routeIndex) =>
      sortedStops(route)
        .map((stop) => {
          const latitude =
            numericCoordinate(
              stop.latitude,
            );

          const longitude =
            numericCoordinate(
              stop.longitude,
            );

          if (
            latitude === null ||
            longitude === null ||
            latitude < -90 ||
            latitude > 90 ||
            longitude < -180 ||
            longitude > 180
          ) {
            return null;
          }

          return {
            ...stop,
            latitude,
            longitude,
            routeId:
              route.id,
            routeName:
              route.name ||
              `Route ${route.route_order}`,
            routeIndex,
          };
        })
        .filter(Boolean),
  );
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function routeFinishMode(route) {
  return [
    "final_stop",
    "return_start",
    "meeting_point",
  ].includes(
    route?.finish_mode,
  )
    ? route.finish_mode
    : "final_stop";
}

function routeFinishLabel(
  route,
  meetingLocation = "",
) {
  const finishMode =
    routeFinishMode(route);

  if (
    finishMode ===
    "return_start"
  ) {
    return "Loop to starting stop";
  }

  if (
    finishMode ===
    "meeting_point"
  ) {
    return meetingLocation
      ? "Return to meeting point"
      : "Meeting point unavailable";
  }

  return "End at final stop";
}

function googleMapsUrl(
  route,
  meetingLocation = "",
) {
  const addresses =
    sortedStops(route)
      .map(getAddress)
      .filter(Boolean);

  if (!addresses.length) {
    return "";
  }

  const finishMode =
    routeFinishMode(route);

  const hasMeetingPoint =
    finishMode ===
      "meeting_point" &&
    meetingLocation.trim();

  if (
    addresses.length === 1 &&
    !hasMeetingPoint
  ) {
    return (
      "https://www.google.com/maps/search/" +
      `?api=1&query=${encodeURIComponent(
        addresses[0],
      )}`
    );
  }

  let origin;
  let destination;
  let waypoints;

  if (
    finishMode ===
    "return_start"
  ) {
    const routeAddresses =
      addresses.slice(0, 9);

    origin =
      routeAddresses[0];

    destination =
      routeAddresses[0];

    waypoints =
      routeAddresses.slice(1);
  } else if (hasMeetingPoint) {
    const routeAddresses =
      addresses.slice(0, 9);

    origin =
      routeAddresses[0];

    destination =
      meetingLocation.trim();

    waypoints =
      routeAddresses.slice(1);
  } else {
    const routeAddresses =
      addresses.slice(0, 10);

    origin =
      routeAddresses[0];

    destination =
      routeAddresses[
        routeAddresses.length - 1
      ];

    waypoints =
      routeAddresses.slice(
        1,
        -1,
      );
  }

  const params =
    new URLSearchParams({
      api: "1",
      origin,
      destination,
      travelmode: "walking",
    });

  if (waypoints.length) {
    params.set(
      "waypoints",
      waypoints.join("|"),
    );
  }

  return (
    "https://www.google.com/maps/dir/?" +
    params.toString()
  );
}

function resultLabel(stop) {
  if (!stop.result_code) {
    return String(
      stop.status ||
        "pending",
    ).replaceAll("_", " ");
  }

  return [
    stop.status,
    stop.result_code,
  ]
    .filter(Boolean)
    .join(" · ")
    .replaceAll("_", " ");
}

export function FieldRouteMap({
  routes = [],
  meetingLocation = "",
  eyebrow = "Route map",
  title = "Field route map",
  privacyLabel = "Authorized route data",
}) {
  const mapNodeRef =
    useRef(null);

  const mapInstanceRef =
    useRef(null);

  const allStops =
    routes.flatMap(
      (route) =>
        sortedStops(route),
    );

  const locatedStops =
    mappedStops(routes);

  const missingLocationCount =
    Math.max(
      0,
      allStops.length -
        locatedStops.length,
    );

  const routeLinks =
    routes
      .map((route) => ({
        id: route.id,
        label:
          route.name ||
          `Route ${route.route_order}`,
        url:
          googleMapsUrl(
            route,
            meetingLocation,
          ),
        finishLabel:
          routeFinishLabel(
            route,
            meetingLocation,
          ),
        stopLimit:
          routeFinishMode(route) ===
          "final_stop"
            ? 10
            : 9,
        stopCount:
          (
            route.field_stops ||
            []
          ).length,
      }))
      .filter(
        (route) =>
          route.url,
      );

  useEffect(() => {
    if (
      !mapNodeRef.current ||
      !routes.length
    ) {
      return undefined;
    }

    const points =
      mappedStops(routes);

    if (!points.length) {
      return undefined;
    }

    if (
      mapInstanceRef.current
    ) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current =
        null;
    }

    const map =
      L.map(
        mapNodeRef.current,
        {
          zoomControl: true,
          scrollWheelZoom:
            false,
        },
      );

    mapInstanceRef.current =
      map;

    L.tileLayer(
      "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      },
    ).addTo(map);

    const bounds =
      L.latLngBounds([]);

    routes.forEach(
      (
        route,
        routeIndex,
      ) => {
        const routePoints =
          points.filter(
            (point) =>
              point.routeId ===
              route.id,
          );

        if (!routePoints.length) {
          return;
        }

        const color =
          ROUTE_COLORS[
            routeIndex %
              ROUTE_COLORS.length
          ];

        if (
          routePoints.length > 1
        ) {
          const linePoints =
            routePoints.map(
              (point) => [
                point.latitude,
                point.longitude,
              ],
            );

          if (
            routeFinishMode(
              route,
            ) ===
              "return_start"
          ) {
            linePoints.push(
              linePoints[0],
            );
          }

          L.polyline(
            linePoints,
            {
              color,
              weight: 4,
              opacity: 0.76,
            },
          ).addTo(map);
        }

        routePoints.forEach(
          (point) => {
            const marker =
              L.marker(
                [
                  point.latitude,
                  point.longitude,
                ],
                {
                  icon:
                    L.divIcon({
                      className:
                        styles.markerWrap,
                      html:
                        `<span class="${styles.markerBadge}" ` +
                        `style="--marker-color:${color}">` +
                        `<b>${escapeHtml(
                          point.stop_order,
                        )}</b>` +
                        "</span>",
                      iconSize:
                        [34, 42],
                      iconAnchor:
                        [17, 42],
                      popupAnchor:
                        [0, -38],
                    }),
                },
              );

            marker.bindPopup(
              `<strong>${escapeHtml(
                point.location_label ||
                  `Stop ${point.stop_order}`,
              )}</strong>` +
              `<span>${escapeHtml(
                getAddress(point),
              )}</span>` +
              `<small>${escapeHtml(
                point.routeName,
              )} · ${escapeHtml(
                resultLabel(point),
              )}</small>`,
              {
                className:
                  styles.mapPopup,
              },
            );

            marker.addTo(map);

            bounds.extend(
              [
                point.latitude,
                point.longitude,
              ],
            );
          },
        );
      },
    );

    if (bounds.isValid()) {
      if (
        points.length === 1
      ) {
        map.setView(
          bounds.getCenter(),
          16,
        );
      } else {
        map.fitBounds(
          bounds,
          {
            padding:
              [42, 42],
            maxZoom: 17,
          },
        );
      }
    }

    const resizeTimer =
      window.setTimeout(
        () => {
          map.invalidateSize();
        },
        0,
      );

    return () => {
      window.clearTimeout(
        resizeTimer,
      );

      map.remove();

      if (
        mapInstanceRef.current ===
        map
      ) {
        mapInstanceRef.current =
          null;
      }
    };
  }, [routes]);

  return (
    <section className={styles.card}>
      <header>
        <div>
          <span>
            {eyebrow}
          </span>

          <h3>
            {title}
          </h3>

          <p>
            View located stops in order,
            then open the walking route in
            Google Maps when needed.
          </p>
        </div>

        <div className={styles.privacyBadge}>
          <ShieldCheck
            size={15}
          />
          {privacyLabel}
        </div>
      </header>

      <div className={styles.summary}>
        <div>
          <span>
            Route stops
          </span>
          <strong>
            {allStops.length}
          </strong>
        </div>

        <div>
          <span>
            On map
          </span>
          <strong>
            {locatedStops.length}
          </strong>
        </div>

        <div>
          <span>
            Need coordinates
          </span>
          <strong>
            {missingLocationCount}
          </strong>
        </div>
      </div>

      {locatedStops.length ? (
        <div
          ref={mapNodeRef}
          className={styles.map}
          aria-label={title}
        />
      ) : (
        <div className={styles.emptyMap}>
          <div>
            <MapPin
              size={30}
            />
          </div>

          <strong>
            The route is ready, but its
            stops do not have map
            coordinates yet
          </strong>

          <p>
            Directions still work from
            each address. To place markers
            on the embedded map, add
            latitude and longitude when
            editing a stop or importing a
            spreadsheet.
          </p>
        </div>
      )}

      <footer>
        <div>
          <Navigation
            size={15}
          />

          <span>
            {locatedStops.length
              ? `${locatedStops.length} located stops displayed`
              : "Address directions remain available"}
          </span>
        </div>

        <div className={styles.routeLinks}>
          {routeLinks.map(
            (route) => (
              <a
                key={route.id}
                href={route.url}
                target="_blank"
                rel="noreferrer"
                title={
                  route.stopCount >
                  route.stopLimit
                    ? `Google Maps opens the first ${route.stopLimit} stops for this route.`
                    : `Open this route in Google Maps — ${route.finishLabel}.`
                }
              >
                <ExternalLink
                  size={14}
                />
                {route.label}
                {" · "}
                {route.finishLabel}
              </a>
            ),
          )}
        </div>
      </footer>

      {missingLocationCount > 0 && (
        <div className={styles.coordinateNotice}>
          <MapPin
            size={15}
          />

          <span>
            {missingLocationCount}{" "}
            {missingLocationCount === 1
              ? "stop needs"
              : "stops need"}{" "}
            latitude and longitude before
            appearing as embedded map
            markers.
          </span>
        </div>
      )}
    </section>
  );
}
