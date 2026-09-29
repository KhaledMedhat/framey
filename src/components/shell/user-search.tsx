"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search } from "reicon-react";

import { getFullName } from "@/lib/utils";
import { useSearchUsersQuery } from "@/store/api";
import { useT } from "../i18n-provider";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Input } from "../ui/input";
import { Spinner } from "../ui/spinner";

/** Search bar over every account; results drop down beneath it. */
export default function UserSearch() {
  const t = useT();
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const q = query.trim();
  const { data, isFetching } = useSearchUsersQuery(q, { skip: !q });

  // Wait for a pause in typing before asking the server.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(text), 250);
    return () => clearTimeout(timer);
  }, [text]);

  return (
    <div className="relative mx-auto w-full max-w-xl">
      <Search
        aria-hidden
        className="pointer-events-none absolute start-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        type="search"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={t("search")}
        aria-label={t("searchPeople")}
        className="h-11 rounded-lg ps-10"
      />
      {text.trim() && (
        <div className="absolute inset-x-0 top-full z-30 mt-2 max-h-96 overflow-y-auto rounded-lg border bg-popover p-1.5 shadow-lg">
          {isFetching && !data ? (
            <div className="flex h-16 items-center justify-center">
              <Spinner />
            </div>
          ) : data?.length ? (
            <ul>
              {data.map((user) => (
                <li key={user.id}>
                  <Link
                    href={`/${user.username}`}
                    className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                  >
                    <Avatar>
                      <AvatarImage src={user.profilePicture?.url} alt="" />
                      <AvatarFallback>
                        {user.username.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="flex min-w-0 flex-col text-sm">
                      <span className="truncate font-semibold">
                        {user.username}
                      </span>
                      <span className="truncate text-muted-foreground">
                        {getFullName(user.firstName, user.lastName)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-3 py-4 text-center text-sm text-muted-foreground">
              {t("noResults")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
