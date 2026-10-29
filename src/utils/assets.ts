/** Resolves a file inside `public/assets` for both dev and GitHub Pages builds. */
export const assetUrl = (path: string): string => `${import.meta.env.BASE_URL}assets/${path}`;
