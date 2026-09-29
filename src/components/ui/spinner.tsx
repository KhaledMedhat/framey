"use client"

import { cn } from "cn"
import { Loader as Loader2Icon } from "reicon-react"
import { useT } from "../i18n-provider"

function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  const t = useT()
  return (
    <Loader2Icon data-slot="spinner" role="status" aria-label={t("loading")} className={cn("size-4 animate-spin", className)} {...props} />
  )
}

export { Spinner }
