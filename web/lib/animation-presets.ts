export const SPRING = {
  type: "spring" as const,
  stiffness: 500,
  damping: 35,
  mass: 0.8,
};

export const ENTER_SPRING = {
  type: "spring" as const,
  stiffness: 350,
  damping: 28,
};

export const EXIT_SPRING = {
  type: "spring" as const,
  stiffness: 200,
  damping: 20,
};
