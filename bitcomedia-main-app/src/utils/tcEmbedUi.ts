/** UI vidrio iOS en embed: el widget añade ?tc_ui=glass junto a ?tc_embed=1 */

export const TC_UI_GLASS = "glass";

/** Rutas del flujo embebido (alto del iframe según contenido) */
export const TC_EMBED_SPA_ROUTES =
  /^\/(evento\/[^/]+|compra\/[^/]+|compra-finalizada)$/;

export function isTcEmbedFrameMode(
  searchParams: URLSearchParams,
  pathname: string
): boolean {
  return (
    searchParams.get("tc_embed") === "1" && TC_EMBED_SPA_ROUTES.test(pathname)
  );
}

/** Documento “hueco” solo en iframe embed cristal: deja ver el fondo del sitio anfitrión tras el blur */
export function isTcEmbedGlassChromeMode(
  searchParams: URLSearchParams,
  pathname: string
): boolean {
  return (
    searchParams.get("tc_embed") === "1" &&
    isTcGlassUi(searchParams) &&
    TC_EMBED_SPA_ROUTES.test(pathname)
  );
}

export function isTcGlassUi(searchParams: URLSearchParams): boolean {
  return searchParams.get("tc_ui") === TC_UI_GLASS;
}
