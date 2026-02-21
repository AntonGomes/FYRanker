"use client"

import * as React from "react"
import * as RechartsPrimitive from "recharts"

import { cn } from "@/lib/utils"
import { useChart, getPayloadConfigFromPayload } from "./chart-utils"

function TooltipIndicator({
  indicator,
  indicatorColor,
  nestLabel,
}: {
  indicator: "line" | "dot" | "dashed"
  indicatorColor: string
  nestLabel: boolean
}): React.ReactNode {
  return (
    <div
      className={cn(
        "shrink-0 rounded-[2px] border-(--color-border) bg-(--color-bg)",
        {
          "h-2.5 w-2.5": indicator === "dot",
          "w-1": indicator === "line",
          "w-0 border-[1.5px] border-dashed bg-transparent":
            indicator === "dashed",
          "my-0.5": nestLabel && indicator === "dashed",
        }
      )}
      style={
        {
          "--color-bg": indicatorColor,
          "--color-border": indicatorColor,
        } as React.CSSProperties
      }
    />
  )
}

function TooltipItemIcon({
  item,
  hideIndicator,
  indicator,
  nestLabel,
  indicatorColor,
}: {
  item: NonNullable<React.ComponentProps<typeof RechartsPrimitive.Tooltip>["payload"]>[number]
  hideIndicator: boolean
  indicator: "line" | "dot" | "dashed"
  nestLabel: boolean
  indicatorColor: string
}): React.ReactNode {
  const { config } = useChart()
  const key = `${item.name || item.dataKey || "value"}`
  const itemConfig = getPayloadConfigFromPayload({ config, payload: item, key })

  if (itemConfig?.icon) {
    return <itemConfig.icon />
  }

  if (hideIndicator) {
    return null
  }

  return (
    <TooltipIndicator
      indicator={indicator}
      indicatorColor={indicatorColor}
      nestLabel={nestLabel}
    />
  )
}

function TooltipItemValue({
  item,
  nestLabel,
  tooltipLabel,
}: {
  item: NonNullable<React.ComponentProps<typeof RechartsPrimitive.Tooltip>["payload"]>[number]
  nestLabel: boolean
  tooltipLabel: React.ReactNode
}): React.ReactNode {
  const { config } = useChart()
  const key = `${item.name || item.dataKey || "value"}`
  const itemConfig = getPayloadConfigFromPayload({ config, payload: item, key })

  return (
    <div
      className={cn(
        "flex flex-1 justify-between leading-none",
        nestLabel ? "items-end" : "items-center"
      )}
    >
      <div className="grid gap-1.5">
        {nestLabel ? tooltipLabel : null}
        <span className="text-muted-foreground">
          {itemConfig?.label || item.name}
        </span>
      </div>
      {item.value && (
        <span className="text-foreground font-mono font-medium tabular-nums">
          {item.value.toLocaleString()}
        </span>
      )}
    </div>
  )
}

function TooltipItem({
  item,
  index,
  formatter,
  hideIndicator,
  indicator,
  nestLabel,
  tooltipLabel,
  color,
}: {
  item: NonNullable<React.ComponentProps<typeof RechartsPrimitive.Tooltip>["payload"]>[number]
  index: number
  formatter?: React.ComponentProps<typeof RechartsPrimitive.Tooltip>["formatter"]
  hideIndicator: boolean
  indicator: "line" | "dot" | "dashed"
  nestLabel: boolean
  tooltipLabel: React.ReactNode
  color?: string
}): React.ReactNode {
  const indicatorColor = color || item.payload.fill || item.color

  return (
    <div
      className={cn(
        "[&>svg]:text-muted-foreground flex w-full flex-wrap items-stretch gap-2 [&>svg]:h-2.5 [&>svg]:w-2.5",
        indicator === "dot" && "items-center"
      )}
    >
      {formatter && item?.value !== undefined && item.name ? (
        formatter(item.value, item.name, item, index, item.payload)
      ) : (
        <>
          <TooltipItemIcon
            item={item}
            hideIndicator={hideIndicator}
            indicator={indicator}
            nestLabel={nestLabel}
            indicatorColor={indicatorColor}
          />
          <TooltipItemValue
            item={item}
            nestLabel={nestLabel}
            tooltipLabel={tooltipLabel}
          />
        </>
      )}
    </div>
  )
}

export function TooltipItems({
  payload,
  nameKey,
  formatter,
  hideIndicator,
  indicator,
  nestLabel,
  tooltipLabel,
  color,
}: {
  payload: NonNullable<React.ComponentProps<typeof RechartsPrimitive.Tooltip>["payload"]>[number][]
  nameKey?: string
  formatter?: React.ComponentProps<typeof RechartsPrimitive.Tooltip>["formatter"]
  hideIndicator: boolean
  indicator: "line" | "dot" | "dashed"
  nestLabel: boolean
  tooltipLabel: React.ReactNode
  color?: string
}): React.ReactNode {
  return (
    <div className="grid gap-1.5">
      {payload
        .filter((item) => item.type !== "none")
        .map((item, index) => (
          <TooltipItem
            key={`${nameKey || item.name || item.dataKey || "value"}`}
            item={item}
            index={index}
            formatter={formatter}
            hideIndicator={hideIndicator}
            indicator={indicator}
            nestLabel={nestLabel}
            tooltipLabel={tooltipLabel}
            color={color}
          />
        ))}
    </div>
  )
}
