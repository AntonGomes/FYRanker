"use client"

import * as React from "react"
import * as RechartsPrimitive from "recharts"

import { cn } from "@/lib/utils"
import { useChart, getPayloadConfigFromPayload } from "./chart-utils"

function LegendItem({
  item,
  hideIcon,
  nameKey,
}: {
  item: NonNullable<RechartsPrimitive.LegendProps["payload"]>[number]
  hideIcon: boolean
  nameKey?: string
}): React.ReactNode {
  const { config } = useChart()
  const key = `${nameKey || item.dataKey || "value"}`
  const itemConfig = getPayloadConfigFromPayload({ config, payload: item, key })

  return (
    <div
      key={item.value}
      className="[&>svg]:text-muted-foreground flex items-center gap-1.5 [&>svg]:h-3 [&>svg]:w-3"
    >
      {itemConfig?.icon && !hideIcon ? (
        <itemConfig.icon />
      ) : (
        <div
          className="h-2 w-2 shrink-0 rounded-[2px]"
          style={{ backgroundColor: item.color }}
        />
      )}
      {itemConfig?.label}
    </div>
  )
}

export function ChartLegendContent({
  className,
  hideIcon = false,
  payload,
  verticalAlign = "bottom",
  nameKey,
}: React.ComponentProps<"div"> &
  Pick<RechartsPrimitive.LegendProps, "payload" | "verticalAlign"> & {
    hideIcon?: boolean
    nameKey?: string
  }): React.ReactNode {
  const filteredItems = payload?.filter((item) => item.type !== "none") ?? []

  if (!filteredItems.length) {
    return null
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center gap-4",
        verticalAlign === "top" ? "pb-3" : "pt-3",
        className
      )}
    >
      {filteredItems.map((item) => (
        <LegendItem key={item.value} item={item} hideIcon={hideIcon} nameKey={nameKey} />
      ))}
    </div>
  )
}
