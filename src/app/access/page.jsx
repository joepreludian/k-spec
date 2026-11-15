import { AccessForm } from "./AccessForm.jsx";

export const metadata = { title: "k-spec · access" };

export default async function AccessPage({ searchParams }) {
  const params = await searchParams;
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <AccessForm error={params?.error === "1"} />
    </main>
  );
}
