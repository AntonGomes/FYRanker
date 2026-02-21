"use client"

import * as React from "react"
import * as RechartsPrimitive from "recharts"

import { cn } from "@/lib/utils"
import { useChart, getPayloadConfigFromPayload } from "./chart-utils"
import { TooltipItems } from "./chart-tooltip-items"

function TooltipLabel({
  hideLabel,
  payload,
  label,
  labelFormatter,
  labelClassName,
  labelKey,
}: {
  hideLabel: boolean
  payload: NonNullable<React.ComponentProps<typeof RechartsPrimitive.Tooltip>["payload"]>
  label?: React.ReactNode
  labelFormatter?: React.ComponentProps<typeof RechartsPrimitive.Tooltip>["labelFormatter"]
  labelClassName?: string
  labelKey?: string
}): React.ReactNode {
  const { config } = useChart()

  if (hideLabel || !payload.length) {
    return null
  }

  const [item] = payload
  const key = `${labelKey || item?.dataKey || item?.name || "value"}`
  const itemConfig = getPayloadConfigFromPayload({ config, payload: item, key })
  const value =
    !labelKey && typeof label === "string"
      ? config[label as keyof typeof config]?.label || label
      : itemConfig?.label

  if (labelFormatter) {
    return (
      <div className={cn("font-medium", labelClassName)}>
        {labelFormatter(value, payload)}
      </div>
    )
  }

  if (!value) {
    return null
  }

  return <div className={cn("font-medium", labelClassName)}>{value}</div>
}

type ChartTooltipContentProps = React.ComponentProps<typeof RechartsPrimitive.Tooltip> &
  React.ComponentProps<"div"> & {
    hideLabel?: boolean
    hideIndicator?: boolean
    indicator?: "line" | "dot" | "dashed"
    nameKey?: string
    labelKey?: string
  }

export function ChartTooltipContent({
  active, payload, className, indicator = "dot",
  hideLabel = false, hideIndicator = false,
  label, labelFormatter, labelClassName,
  formatter, color, nameKey, labelKey,
}: ChartTooltipContentProps): React.ReactNode {
  if (!active || !payload?.length) {
    return null
  }

  const nestLabel = payload.length === 1 && indicator !== "dot"

  const tooltipLabel = (
    <TooltipLabel
      hideLabel={hideLabel}
      payload={payload}
      label={label}
      labelFormatter={labelFormatter}
      labelClassName={labelClassName}
      labelKey={labelKey}
    />
  )

  return (
    <div
      className={cn(
        "border-border/50 bg-background grid min-w-[8rem] items-start gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl",
        className
      )}
    >
      {!nestLabel ? tooltipLabel : null}
      <TooltipItems
        payload={payload}
        nameKey={nameKey}
        formatter={formatter}
        hideIndicator={hideIndicator}
        indicator={indicator}
        nestLabel={nestLabel}
        tooltipLabel={tooltipLabel}
        color={color}
      />
    </div>
  )
}
