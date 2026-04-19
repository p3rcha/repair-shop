import {
  OilBarrelIcon,
  CarAlertIcon,
  Car01Icon,
  BatteryFullIcon,
  SnowIcon,
  FlashlightIcon,
  Wrench01Icon,
  ToolsIcon,
} from "@hugeicons/core-free-icons"

type IconLike = typeof OilBarrelIcon

const ICON_MAP: Record<string, IconLike> = {
  OilIcon: OilBarrelIcon,
  OilBarrelIcon: OilBarrelIcon,
  BrakeWarningIcon: CarAlertIcon,
  CarAlertIcon: CarAlertIcon,
  WheelIcon: Wrench01Icon,
  Wrench01Icon: Wrench01Icon,
  CarIcon: Car01Icon,
  Car01Icon: Car01Icon,
  BatteryFullIcon: BatteryFullIcon,
  AirConditionerIcon: SnowIcon,
  SnowIcon: SnowIcon,
  FlashlightIcon: FlashlightIcon,
  ToolsIcon: ToolsIcon,
}

export function getCategoryIcon(name: string | null | undefined): IconLike {
  if (!name) return ToolsIcon
  return ICON_MAP[name] ?? ToolsIcon
}
