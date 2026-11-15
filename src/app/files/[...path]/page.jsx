import { FilePage } from "../FilePage.jsx";

export const metadata = { title: "k-spec · file" };

/** /files/<relative markdown path>: the file's location in the project is its URL. */
export default async function FileRoutePage({ params }) {
  const { path: segments = [] } = await params;
  return <FilePage path={segments.map(decodeURIComponent).join("/")} />;
}
