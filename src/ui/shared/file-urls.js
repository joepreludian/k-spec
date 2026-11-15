const encodePath = (path) => String(path).split("/").map(encodeURIComponent).join("/");

/** JSON endpoint for a project markdown file. */
export const apiFileUrl = (path) => `/api/files/${encodePath(path)}`;

/** Full-page view of a project markdown file ("open in new tab"). */
export const filePageUrl = (path) => `/files/${encodePath(path)}`;
