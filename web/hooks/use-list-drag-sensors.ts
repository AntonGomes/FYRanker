import {
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import {
  DRAG_MOUSE_DISTANCE,
  DRAG_TOUCH_DELAY,
  DRAG_TOUCH_TOLERANCE,
} from "@/lib/constants";

export function useListDragSensors() {
  return useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: DRAG_MOUSE_DISTANCE },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: DRAG_TOUCH_DELAY,
        tolerance: DRAG_TOUCH_TOLERANCE,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
}
