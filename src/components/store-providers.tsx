"use client";

import { useState } from "react";
import { SessionProvider } from "next-auth/react";
import { Provider } from "react-redux";

import { makeStore } from "@/store";

export default function StoreProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  // One store per request on the server, one per tab on the client.
  const [store] = useState(makeStore);
  return (
    <SessionProvider>
      <Provider store={store}>{children}</Provider>
    </SessionProvider>
  );
}
