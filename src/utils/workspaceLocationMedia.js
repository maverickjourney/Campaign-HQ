import {
  getWorkspaceLocationMediaQuery,
} from "./workspacePresentation";


const locationMediaCache =
  new Map();


function stripHtml(
  value,
) {
  return String(
    value ||
    "",
  )
    .replace(
      /<[^>]+>/g,
      " ",
    )
    .replace(
      /\s+/g,
      " ",
    )
    .trim();
}


function safeLicense(
  metadata = {},
) {
  const value =
    stripHtml(
      metadata
        ?.LicenseShortName
        ?.value ||
      metadata
        ?.License
        ?.value,
    )
      .toLowerCase();

  return (
    value.includes(
      "public domain",
    ) ||
    value === "cc0" ||
    value.includes(
      "cc0 1.0",
    )
  );
}


function unwantedFilename(
  title,
) {
  return /(?:seal|logo|flag|map|diagram|icon|coat.of.arms|portrait)/i.test(
    String(
      title ||
      "",
    ),
  );
}


export async function resolveWorkspaceLocationPhoto(
  workspace,
) {
  const query =
    getWorkspaceLocationMediaQuery(
      workspace,
    );

  if (!query) {
    return null;
  }


  if (
    locationMediaCache.has(
      query,
    )
  ) {
    return locationMediaCache.get(
      query,
    );
  }


  const pending =
    (async () => {
      try {
        const parameters =
          new URLSearchParams({
            action:
              "query",

            generator:
              "search",

            gsrsearch:
              `${query} -seal -logo -flag -map`,

            gsrnamespace:
              "6",

            gsrlimit:
              "12",

            prop:
              "imageinfo",

            iiprop:
              "url|extmetadata|mime|size",

            iiurlwidth:
              "1800",

            format:
              "json",

            origin:
              "*",
          });


        const response =
          await fetch(
            `https://commons.wikimedia.org/w/api.php?${parameters.toString()}`,
            {
              method:
                "GET",

              mode:
                "cors",

              credentials:
                "omit",

              referrerPolicy:
                "no-referrer",
            },
          );


        if (
          !response.ok
        ) {
          return null;
        }


        const payload =
          await response.json();


        const pages =
          Object.values(
            payload
              ?.query
              ?.pages ||
            {},
          );


        const selected =
          pages.find(
            (page) => {
              const info =
                page
                  ?.imageinfo
                  ?.[0];

              if (
                !info ||
                unwantedFilename(
                  page?.title,
                )
              ) {
                return false;
              }

              if (
                !safeLicense(
                  info.extmetadata,
                )
              ) {
                return false;
              }

              const mime =
                String(
                  info.mime ||
                  "",
                );

              return (
                mime ===
                  "image/jpeg" ||
                mime ===
                  "image/png" ||
                mime ===
                  "image/webp"
              );
            },
          );


        if (!selected) {
          return null;
        }


        const info =
          selected
            .imageinfo?.[0];


        const imageUrl =
          info?.thumburl ||
          info?.url ||
          "";


        if (!imageUrl) {
          return null;
        }


        return {
          query,

          imageUrl,

          sourceUrl:
            info
              ?.descriptionurl ||
            "",

          title:
            selected.title ||
            "",

          license:
            stripHtml(
              info
                ?.extmetadata
                ?.LicenseShortName
                ?.value,
            ) ||
            "Public domain / CC0",
        };
      } catch {
        return null;
      }
    })();


  locationMediaCache.set(
    query,
    pending,
  );


  return pending;
}
