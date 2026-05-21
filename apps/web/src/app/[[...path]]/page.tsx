import { AppShell } from "../../components/app-shell";

export const dynamicParams = false;

export function generateStaticParams() {
  return [{ path: [] }];
}

export default function Page() {
  return <AppShell />;
}
